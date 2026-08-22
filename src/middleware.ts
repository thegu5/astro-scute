import { defineMiddleware } from "astro:middleware";
import { h, parse, renderSync } from "ultrahtml";
import { querySelector } from "ultrahtml/selector";
import { scuteSchema } from "./schema.ts";
import {
	buildPublicationUri,
	createTid,
	getConfig,
	getDataStore,
} from "./util.ts";

export const onRequest = defineMiddleware(async (ctx, next) => {
	const scuteConfig = await getConfig();

	const reqPath = new URL(ctx.request.url).pathname;

	for (const publication of scuteConfig.publications) {
		const pubPath = new URL(`${publication.record.url}/`).pathname;

		const contentBasePath = `${pubPath.slice(0, -1)}${publication.baseContentPath ?? ""}/`;

		const publicationUri = buildPublicationUri(
			scuteConfig.identity,
			publication,
		);

		if (reqPath === pubPath) {
			const response = await next();
			const ast = parse(await response.text());
			querySelector(ast, "head").children.push(
				h("link", {
					rel: "site.standard.publication",
					href: publicationUri,
				}),
				h("meta", {
					name: "at:canonical",
					content: publicationUri,
				}),
			);

			return new Response(renderSync(ast), response);
		} else if (
			reqPath.startsWith(contentBasePath) &&
			!(reqPath === contentBasePath) &&
			// not sure if this is a good idea
			Object.entries(ctx.props).length > 0
		) {
			const response = await next();
			const ast = parse(await response.text());

			const rkey = reqPath
				.split("/")
				.filter((p) => p)
				.at(-1)!;

			const dataStore = await getDataStore(true);
			const entry = dataStore.get(publication.collectionName)!.get(rkey)!;
			const frontmatter = scuteSchema.parse(entry?.data);
			const publishedAt = frontmatter.publishedAt ?? frontmatter.pubDate;
			if (!publishedAt) {
				throw new Error(
					`${entry.id} must have either have pubDate or publishedAt`,
				);
			}

			const documentUri = `at://${scuteConfig.identity}/site.standard.document/${createTid(`${publication.collectionName}-${entry.id}`, publishedAt)}`;

			querySelector(ast, "head").children.push(
				h("link", {
					rel: "site.standard.document",
					href: documentUri,
				}),
				h("meta", {
					name: "at:canonical",
					content: documentUri,
				}),
				h("meta", {
					name: "at:alternate",
					content: publicationUri,
				}),
			);

			return new Response(renderSync(ast), response);
		}
	}

	return next();
});
