import type { InferOutput } from "@atcute/lexicons";
import type { Did } from "@atcute/lexicons/syntax";
import type { SiteStandardPublication } from "@atcute/standard-site";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Loader } from "astro/loaders";

export type PublicationConfig = {
	collectionName: string;
	baseContentPath?: string;
	record: InferOutput<typeof SiteStandardPublication.mainSchema>;
};

export type ScuteConfig = {
	identity: Did;
	publications: PublicationConfig[];
};

export type CollectionConfig = {
	type: "content" | "data" | "content_layer";
	schema: StandardSchemaV1 | ((context: object) => StandardSchemaV1);
	loader: Loader;
};
