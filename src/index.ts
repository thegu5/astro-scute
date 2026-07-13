import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { buildPublicationUri, getConfig } from "./util.ts";

const createPlugin = (_options?: object): AstroIntegration => {
	return {
		name: "astro-scute",
		hooks: {
			"astro:config:setup": async ({ addWatchFile, addMiddleware }) => {
				addWatchFile("./scute.config.ts");

				addMiddleware({
					entrypoint: join(import.meta.dirname, "./middleware.js"),
					order: "pre",
				});
			},
			"astro:build:done": async ({ dir }) => {
				// avoid giving the user login prompts when building
				// (not using blobs here anyways)
				process.env.NO_BLOBS = "true";
				const scuteConfig = await getConfig();
				process.env.NO_BLOBS = "";

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
