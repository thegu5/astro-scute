import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type ActorIdentifier,
	isActorIdentifier,
	isHandle,
} from "@atcute/lexicons/syntax";
import { SiteStandardPublication } from "@atcute/standard-site";
import {
	cancel,
	intro,
	log,
	multiselect,
	outro,
	path,
	select,
	spinner,
	text,
} from "@clack/prompts";
import type { PublicationConfig, ScuteConfig } from "../types.ts";
import {
	actorResolver,
	cancelIfNeeded,
	getAstroConfig,
	getDataStore,
} from "../util.ts";

export async function init() {
	const prelimConfig: ScuteConfig = {
		identity: "did:plc:FILL ME IN!",
		publications: [],
	};

	const astroConfig = await getAstroConfig();

	intro("Welcome to astro-scute!");
	if (astroConfig.site === undefined) {
		cancel(
			"Set 'site' in your astro config. See: https://docs.astro.build/en/reference/configuration-reference/#site",
		);
		process.exit(1);
	}

	const dataStore = await getDataStore();

	const actor = (await text({
		message: "What is your Atmosphere Account handle (or DID)?",
		placeholder: "jonbois.bsky.social",
		validate(value) {
			if (!isActorIdentifier(value)) {
				return "Please enter a valid identifier (handle or DID)";
			}
		},
	})) as ActorIdentifier | symbol;
	cancelIfNeeded(actor);

	if (isHandle(actor)) {
		const spin = spinner();
		spin.start("Resolving handle...");
		try {
			const data = await actorResolver.resolve(actor);
			prelimConfig.identity = data.did;
			spin.stop("Handle resolved");
		} catch (e) {
			spin.error((e as Error).message);
			process.exit(1);
		}
	} else {
		// TODO: is this necessary? (and if so, also resolve did returned from handleResolver)
		// const spin = spinner();
		// spin.start("Validating DID...");
		// try {
		// 	await didDocumentResolver.resolve(
		// 		actor as Parameters<(typeof didDocumentResolver)["resolve"]>[0],
		// 	);
		// 	spin.stop("DID validated");
		// } catch (e) {
		// 	spin.error(`Failed to validate DID: ${(e as Error).message}`);
		// }
		prelimConfig.identity = actor;
	}

	const collections = await multiselect({
		message: "Pick the content collection(s) you want to publish",
		options: Array.from(
			dataStore
				.keys()
				.filter((name) => !name.includes(":meta"))
				.map((name) => ({ value: name })),
		),
	});
	cancelIfNeeded(collections);

	for (const collectionName of collections) {
		log.message(
			`Now configuring publication for "${collectionName}" collection`,
		);

		const name = await text({
			message: "What is this publication's name?",
			validate: SiteStandardPublication.mainSchema.object.shape.name,
		});
		cancelIfNeeded(name);

		const srcDir = fileURLToPath(astroConfig.srcDir)
			.replace(`${process.cwd()}/`, "")
			.slice(0, -1);

		let contentPath = await path({
			message:
				"Where does this collection appear on your site? (the part before the slug)",
			root: `${srcDir}/pages/`,
			directory: true,
		});
		cancelIfNeeded(contentPath);
		contentPath = contentPath.replace(`${srcDir}/pages/`, "");

		let pubUrl: URL = new URL(astroConfig.base, astroConfig.site);

		const listingUrl = new URL(`./${contentPath}`, pubUrl);

		if (
			existsSync(`${srcDir}/pages/${contentPath}.astro`) ||
			existsSync(`${srcDir}/pages/${contentPath}.ts`)
		) {
			const res = await select({
				message: "What should this publication's home page be?",
				options: [
					{
						value: pubUrl,
						label: pubUrl.toString(),
					},
					{
						value: listingUrl,
						label: listingUrl.toString(),
					},
				],
			});
			cancelIfNeeded(res);
			pubUrl = res;
		}

		let contentType: PublicationConfig["contentType"] = "html";

		const pubEntries = dataStore.get(collectionName);
		if (pubEntries?.values().every((v) => v.filePath?.endsWith(".md"))) {
			contentType = "markdown";
		}

		const publicationConfig: PublicationConfig = {
			collectionName,
			baseContentPath: pubUrl !== listingUrl ? `/${contentPath}` : undefined,
			contentType,
			record: {
				$type: "site.standard.publication",
				name,
				url: pubUrl.toString().replace(/\/$/, "") as `${string}:${string}`,
				description: "A description! (optional)",
				preferences: {
					showInDiscover: true,
				},
			},
		};

		prelimConfig.publications.push(publicationConfig);
	}

	writeFileSync(
		join(process.cwd(), "scute.config.ts"),
		`import { defineConfig } from "astro-scute";

export default defineConfig(${JSON.stringify(prelimConfig, null, "	")});`,
	);
	outro("Initial configuration saved to scute.config.ts");
}
