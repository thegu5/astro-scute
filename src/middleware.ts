import { defineMiddleware } from "astro:middleware";
import { h, parse, renderSync } from "ultrahtml";
import { querySelector } from "ultrahtml/selector";
import { buildPublicationUri, getConfig } from "./util.ts";

export const onRequest = defineMiddleware(async (ctx, next) => {
	const scuteConfig = await getConfig();

	const reqPath = new URL(ctx.request.url).pathname;

	for (const publication of scuteConfig.publications) {
		const pubPath = new URL(`${publication.record.url}/`).pathname;

		const contentBasePath = `${pubPath.slice(0, -1)}${publication.baseContentPath ?? ""}/`;

		if (reqPath === pubPath) {
			const response = await next();
			const ast = parse(await response.text());
			querySelector(ast, "head").children.push(
				h("link", {
					rel: "site.standard.publication",
					href: buildPublicationUri(scuteConfig.identity, publication),
				}),
			);

			return new Response(renderSync(ast), response);
		} else if (
			reqPath.startsWith(contentBasePath) &&
			!(reqPath === contentBasePath)
		) {
			// assume it's a document? todo look for alternatives
			const response = await next();
			const ast = parse(await response.text());

			const rkey = reqPath
				.split("/")
				.filter((p) => p)
				.at(-1);

			querySelector(ast, "head").children.push(
				h("link", {
					rel: "site.standard.document",
					href: `at://${scuteConfig.identity}/site.standard.document/scute-${publication.collectionName}-${rkey}`,
				}),
			);

			return new Response(renderSync(ast), response);
		}
	}

	return next();
});
