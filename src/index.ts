import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { buildPublicationUri, getConfig } from "./util.ts";

const createPlugin = (_options?: object): AstroIntegration => {
	return {
		name: "astro-scute",
		hooks: {
			"astro:config:setup": async ({ addWatchFile, addMiddleware, config }) => {
				if (config.experimental.collectionStorage === "chunked") {
					throw new Error("astro-scute doesn't support chunked content collection data storage")
				}
				addWatchFile("./scute.config.ts");

				addMiddleware({
					entrypoint: join(import.meta.dirname, "./middleware.js"),
					order: "pre",
				});
			},
			"astro:build:done": async ({ dir }) => {
				const scuteConfig = await getConfig();

				for (const publication of scuteConfig.publications) {
					const outFile = fileURLToPath(
						new URL(
							`./.well-known/site.standard.publication${new URL(publication.record.url).pathname.replace(/\/$/, "")}`,
							dir,
						),
					);
					mkdirSync(dirname(outFile), { recursive: true });
					writeFileSync(
						outFile,
						buildPublicationUri(scuteConfig.identity, publication),
					);
				}
			},
		},
	};
};

export * from "./config.ts";
export { scuteSchema } from "./schema.ts";

export default createPlugin;
