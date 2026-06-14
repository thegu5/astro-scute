import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { ScuteConfig } from "./types.ts";
import { buildPublicationUri, getConfig } from "./util.ts";

export function defineConfig(options: ScuteConfig): ScuteConfig {
	return options;
}

const createPlugin = (_options?: object): AstroIntegration => {
	return {
		name: "astro-scute",
		hooks: {
			"astro:config:setup": async ({
				addWatchFile,
				addMiddleware,
				updateConfig,
			}) => {
				// atcute has some invalid PURE annotations
				updateConfig({
					vite: {
						build: {
							rolldownOptions: {
								checks: {
									invalidAnnotation: false,
								},
							},
						},
					},
				});

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

export default createPlugin;
