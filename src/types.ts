import type { Did } from "@atcute/lexicons/syntax";
import type { SiteStandardPublication } from "@atcute/standard-site";
import type { MarkdownHeading } from "astro";

export type PublicationConfig = {
	collectionName: string;
	baseContentPath?: string;
	contentType: "html" | "markdown" | null;
	record: SiteStandardPublication.Main;
};
export type ScuteConfig = {
	identity: Did;
	publications: PublicationConfig[];
};


// https://github.com/withastro/astro/blob/4c4a91c3ef3e3316cb9faa32e37c69d69902b956/packages/astro/src/content/data-store.ts

export interface RenderedContent {
	/** Rendered HTML string. If present then `render(entry)` will return a component that renders this HTML. */
	html: string;
	metadata?: {
		/** Any images that are present in this entry. Relative to the {@link DataEntry} filePath. */
		imagePaths?: Array<string>;
		/** Any headings that are present in this file. */
		headings?: MarkdownHeading[];
		/** Raw frontmatter, parsed from the file. This may include data from remark plugins. */
		// biome-ignore lint/suspicious/noExplicitAny: same as original src
		frontmatter?: Record<string, any>;
		/** Any other metadata that is present in this file. */
		[key: string]: unknown;
	};
}

export interface DataEntry<
	TData extends Record<string, unknown> = Record<string, unknown>,
> {
	/** The ID of the entry. Unique per collection. */
	id: string;
	/** The parsed entry data */
	data: TData;
	/** The file path of the content, if applicable. Relative to the site root. */
	filePath?: string;
	/** The raw body of the content, if applicable. */
	body?: string;
	/** An optional content digest, to check if the content has changed. */
	digest?: number | string;
	/** The rendered content of the entry, if applicable. */
	rendered?: RenderedContent;
	/**
	 * If an entry is a deferred, its rendering phase is delegated to a virtual module during the runtime phase when calling `renderEntry`.
	 */
	deferredRender?: boolean;
	assetImports?: Array<string>;
}
