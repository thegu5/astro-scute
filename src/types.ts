import type { InferOutput } from "@atcute/lexicons";
import type { Did } from "@atcute/lexicons/syntax";
import type { SiteStandardPublication } from "@atcute/standard-site";

export type PublicationConfig = {
	collectionName: string;
	baseContentPath?: string;
	record: InferOutput<typeof SiteStandardPublication.mainSchema>;
};

export type ScuteConfig = {
	identity: Did;
	publications: PublicationConfig[];
};
