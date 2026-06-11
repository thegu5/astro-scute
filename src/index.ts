import type { AstroIntegration } from "astro";
import type { ScuteConfig } from "./types.ts";

export function defineConfig(options: ScuteConfig): ScuteConfig {
	return options;
}


// TODO: inject .well-known routes and link tags
const createPlugin = (options?: object): AstroIntegration => {
	return {
		name: "astro-scute",
		hooks: {
			"astro:config:setup": async ({
				config,
				addWatchFile,
				injectRoute,
				updateConfig,
			}) => {
				addWatchFile("./scute.config.ts");
				updateConfig({
					vite: {
						plugins: [
							{
								name: "astro-scute",
								transformIndexHtml(html, ctx) {
									return [];
								},
							},
						],
					},
				});
			},
			"astro:config:done": async ({ config }) => {},
			"astro:build:done": async ({ dir, pages, logger }) => {},
		},
	};
};

export default createPlugin;
