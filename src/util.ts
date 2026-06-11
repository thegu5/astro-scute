import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import {
	CompositeDidDocumentResolver,
	CompositeHandleResolver,
	DohJsonHandleResolver,
	LocalActorResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	WellKnownHandleResolver,
} from "@atcute/identity-resolver";
import { type ActorIdentifier, isDid } from "@atcute/lexicons/syntax";
import type { Store } from "@atcute/oauth-node-client";
import {
	MemoryStore,
	OAuthClient,
	type OAuthSession,
	type StoredState,
} from "@atcute/oauth-node-client";
import { cancel, isCancel, log, spinner } from "@clack/prompts";
import { dev } from "astro";
import { validateConfig } from "astro/config";
import type { DataEntry } from "astro/content/config";
import * as devalue from "devalue";
import envPaths from "env-paths";
import { getRandomPort } from "get-port-please";
import type { ScuteConfig } from "./types.ts";

export const hexToRGB = (hex: string) => {
	let parseString = hex;
	if (hex.startsWith("#")) {
		parseString = hex.slice(1, 7);
	}
	if (parseString.length !== 6) {
		return null;
	}
	const r = parseInt(parseString.slice(0, 2), 16);
	const g = parseInt(parseString.slice(2, 4), 16);
	const b = parseInt(parseString.slice(4, 6), 16);
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
		return null;
	}
	return { r, g, b };
};

type DiskStoreOptions = {
	name: string;
};

export async function getConfig(): Promise<ScuteConfig> {
	return (await import(join(process.cwd(), "scute.config.ts"))).default;
}

export function pidIsRunning(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export async function getDataStore(): Promise<
	Map<string, Map<string, DataEntry>>
> {
	const devLock = JSON.parse(
		readFileSync(join(process.cwd(), ".astro/dev.json"), "utf-8"),
	);
	if (!pidIsRunning(devLock.pid)) {
		const spin = spinner();
		spin.start("Building your site");
		// ideally we'd use devOutput, but that doesn't generate data-store.json for some reason
		// await build({ root: process.cwd(), logLevel: "error" }, { devOutput: true });
		// also, vite dumps extra stuff into stdout which is annoying
		// also, would be nice if there was an api to check if the store was up to date :pensive:
		const devServer = await dev({
			root: process.cwd(),
			logLevel: "error",
		});
		await devServer.stop();

		spin.stop("Build complete");
	}
	return devalue.parse(
		readFileSync(join(process.cwd(), ".astro/data-store.json"), "utf-8"),
	);
}

export async function getAstroConfig() {
	// todo different file extensions
	const module = await import(join(process.cwd(), "astro.config.ts"));
	return validateConfig(module.default, process.cwd(), "build"); // uhhhh
}

export const handleResolver = new CompositeHandleResolver({
	methods: {
		dns: new DohJsonHandleResolver({
			dohUrl: "https://mozilla.cloudflare-dns.com/dns-query",
		}),
		http: new WellKnownHandleResolver(),
	},
});

export const didDocumentResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
});

export async function createOAuthSession(
	identity: ActorIdentifier,
): Promise<OAuthSession> {
	const port = await getRandomPort();
	const redirectUri = `http://127.0.0.1:${port}/callback`;

	const oauth = new OAuthClient({
		metadata: {
			redirect_uris: [redirectUri],
			scope: ["include:site.standard.authFull"],
		},
		actorResolver: new LocalActorResolver({
			handleResolver,
			didDocumentResolver,
		}),
		stores: {
			sessions: new DiskStore({ name: "sessions.json" }),
			states: new MemoryStore<string, StoredState>({
				maxSize: 10,
				// ttl: TEN_MINUTES_MS,
				// ttlAutopurge: true,
			}),
		},
	});

	try {
		const session = await oauth.restore(
			isDid(identity) ? identity : await handleResolver.resolve(identity),
		);
		await session.getTokenInfo();
		return session;
	} catch {
		const deferred = Promise.withResolvers<URLSearchParams>();

		const server = createServer((req, res) => {
			const url = new URL(`http://localhost${req.url ?? "/"}`);
			if (url.pathname === "/callback") {
				deferred.resolve(url.searchParams);
				res.statusCode = 200;
				res.setHeader("Content-Type", "text/html");
				res.end(`<!doctype html>
<html>
<head><title>success</title></head>
<body>
<h1>authenticated!</h1>
<p>you can close this window and return to the terminal.</p>
</body>
</html>`);
				server.close();
				return;
			}
			res.statusCode = 404;
			return res.end();
		});

		server.listen(port);
		const { url } = await oauth.authorize({
			target: { type: "account", identifier: identity },
			redirectUri,
		});

		log.info(`open this URL in your browser to authorize:\n${url.href}\n`);

		const params = await deferred.promise;
		const callback = await oauth.callback(params, { redirectUri });
		return callback.session;
	}
}

export class DiskStore<K extends string, V> implements Store<K, V> {
	#filePath;
	#data: Partial<Record<K, V>> = {};

	constructor(options: DiskStoreOptions) {
		const folderPath = envPaths("astro-scute").data;
		this.#filePath = join(folderPath, options.name);
		mkdirSync(folderPath, { recursive: true });
		if (existsSync(this.#filePath)) {
			this.#data = JSON.parse(readFileSync(this.#filePath, "utf-8"));
		}
	}

	get(key: K) {
		return this.#data[key];
	}

	set(key: K, value: V) {
		this.#data[key] = value;
		writeFileSync(this.#filePath, JSON.stringify(this.#data));
	}

	delete(key: K) {
		delete this.#data[key];
		writeFileSync(this.#filePath, JSON.stringify(this.#data));
	}

	clear() {
		this.#data = {};
		writeFileSync(this.#filePath, JSON.stringify(this.#data));
	}
}

export function cancelIfNeeded<T>(val: T | symbol): asserts val is T {
	if (isCancel(val)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}
}
