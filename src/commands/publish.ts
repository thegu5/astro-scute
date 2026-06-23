import { isDeepStrictEqual } from "node:util";
import type { SatteriMarkdownProcessorOptions } from "@astrojs/markdown-satteri";
import {
	ComAtprotoRepoCreateRecord,
	ComAtprotoRepoDeleteRecord,
	ComAtprotoRepoListRecords,
	ComAtprotoRepoPutRecord,
} from "@atcute/atproto";
import { type CallRequestOptions, Client, ok } from "@atcute/client";
import {
	type Did,
	parse,
	parseResourceUri,
	ValidationError,
} from "@atcute/lexicons";
import type {
	RecordKeySchema,
	RecordObjectSchema,
	RecordSchema,
	XRPCProcedureMetadata,
} from "@atcute/lexicons/validations";
import {
	SiteStandardDocument,
	SiteStandardPublication,
} from "@atcute/standard-site";
import { cancel, confirm, log, outro, spinner } from "@clack/prompts";
import type { AtMarkpubMarkdown, OrgWordpressHtml } from "../lexicons/index.ts";
import { scuteSchema } from "../schema.ts";
import type { DataEntry, PublicationConfig } from "../types.ts";
import {
	buildPublicationUri,
	cancelIfNeeded,
	createSession,
	getAstroConfig,
	getConfig,
	getDataStore,
	processHtml,
} from "../util.ts";

async function listRecords<
	TObject extends RecordObjectSchema,
	TKey extends RecordKeySchema,
	TSchema extends RecordSchema<TObject, TKey>,
>(rpc: Client, did: Did, lex: TSchema) {
	const nsid = lex.object.shape.$type.expected;

	const response = await ok(
		rpc.call(ComAtprotoRepoListRecords, {
			params: {
				collection: nsid,
				repo: did,
			},
		}),
	);

	return new Map(
		response.records.flatMap((record) => {
			try {
				return [[parseResourceUri(record.uri).rkey!, parse(lex, record.value)]];
			} catch (e) {
				if (e instanceof ValidationError) {
					log.warn(
						`Failed to parse record as ${nsid}: ${record.uri}: ${e.message}`,
					);
					log.warn(e.issues.map((i) => `  ${i.path}: ${i.code}`).join("\n"));
				}
				return [];
			}
		}),
	);
}

// todo: better documentation for what frontmatter data astro-scute uses
async function makeSiteStandardDocument(
	entry: DataEntry,
	publication: PublicationConfig,
) {
	const scuteConfig = await getConfig();
	const { markdown: mdConfig, site } = await getAstroConfig();
	const mdFeatures =
		(mdConfig.processor.options as SatteriMarkdownProcessorOptions).features ??
		{};

	let content: AtMarkpubMarkdown.Main | OrgWordpressHtml.Main | undefined;

	if (publication.contentType === "html") {
		if (!entry.rendered) {
			throw new Error(`${entry.id}'s content isn't rendered?`);
		}
		content = {
			$type: "org.wordpress.html",
			html: processHtml(entry.rendered.html, site),
		};
	} else if (publication.contentType === "markdown") {
		if (!entry.body) {
			throw new Error(`${entry.id}'s body doesn't exist?`);
		}
		content = {
			$type: "at.markpub.markdown",
			flavor: mdFeatures.gfm !== false ? "gfm" : "commonmark",
			renderingRules: mdConfig.processor.name,
			// biome-ignore lint/suspicious/noExplicitAny: atcute bug? typing is wrong here
			frontMatter: entry.data as any,
			text: {
				$type: "at.markpub.text",
				markdown: entry.body,
			},
		};
	}

	const frontmatter = scuteSchema.parse(entry.data);

	const publishedAt = frontmatter.publishedAt ?? frontmatter.pubDate;
	if (!publishedAt) {
		throw new Error(`${entry.id} must have either have pubDate or publishedAt`);
	}

	return {
		$type: "site.standard.document",
		title: frontmatter.title,
		description: frontmatter.description,
		tags: frontmatter.categories ?? frontmatter.tags,
		site: buildPublicationUri(scuteConfig.identity, publication),
		publishedAt: publishedAt.toISOString(),
		path: `${publication.baseContentPath ?? ""}/${entry.id}`,
		// biome-ignore lint/suspicious/noExplicitAny: atcute bug? typing is wrong here
		content: content as any,
		// todo: bskyPostRef, coverImage...
	} satisfies SiteStandardDocument.Main;
}

export async function publish() {
	const scuteConfig = await getConfig();

	const dataStore = await getDataStore();

	const loginSpin = spinner();
	loginSpin.start("Logging in");
	const session = await createSession(scuteConfig.identity);
	loginSpin.stop("Logged in");

	const rpc = new Client({
		handler: session,
	});

	const fetchSpin = spinner();
	fetchSpin.start("Fetching publication records");
	const publicationRecords = await listRecords(
		rpc,
		session.did,
		SiteStandardPublication.mainSchema,
	);
	fetchSpin.message("Fetching document records");
	const documentRecords = await listRecords(
		rpc,
		session.did,
		SiteStandardDocument.mainSchema,
	);
	fetchSpin.stop("Records fetched");

	type Namespaced<T> = {
		mainSchema: T;
	};

	type Operation<T extends XRPCProcedureMetadata = XRPCProcedureMetadata> = {
		type: Namespaced<T>;
		init: CallRequestOptions<T>;
	};

	const queuedOperations: Operation[] = [];

	// make sure site.standard.publication records are up to date
	for (const publication of scuteConfig.publications) {
		// todo include site info here so it's unique enough
		const rkey = `scute-${publication.collectionName}`;

		if (isDeepStrictEqual(publicationRecords.get(rkey), publication.record)) {
			continue;
		}

		queuedOperations.push({
			type: publicationRecords.get(rkey)
				? ComAtprotoRepoPutRecord
				: ComAtprotoRepoCreateRecord,
			init: {
				input: {
					repo: scuteConfig.identity,
					collection: "site.standard.publication",
					record: publication.record,
					rkey,
				},
			} satisfies CallRequestOptions<ComAtprotoRepoPutRecord.mainSchema> satisfies CallRequestOptions<ComAtprotoRepoCreateRecord.mainSchema>,
		});
	}

	// make sure site.standard.document records are up to date
	for (const publication of scuteConfig.publications) {
		const pubUri = buildPublicationUri(scuteConfig.identity, publication);

		const publishedDocumentRkeys = new Set(
			documentRecords
				.keys()
				.filter((k) => documentRecords.get(k)?.site === pubUri),
		);
		const localDocumentRkeys = new Set(
			dataStore
				.get(publication.collectionName)
				?.keys()
				.map((k) => `scute-${publication.collectionName}-${k}`),
		);

		// these documents exist on the user's PDS, tied to a scute-managed publication, but no longer exist in the content collection
		// so, we delete them
		for (const rkey of publishedDocumentRkeys.difference(localDocumentRkeys)) {
			queuedOperations.push({
				type: ComAtprotoRepoDeleteRecord,
				init: {
					input: {
						collection: "site.standard.document",
						repo: scuteConfig.identity,
						rkey,
					},
				} satisfies CallRequestOptions<ComAtprotoRepoDeleteRecord.mainSchema>,
			});
		}

		// these documents exist in the content collection, but not on the user's PDS

		for await (const rkey of localDocumentRkeys.difference(
			publishedDocumentRkeys,
		)) {
			// cursed
			const entry = dataStore
				.get(publication.collectionName)
				?.get(rkey.replace(`scute-${publication.collectionName}-`, ""));
			if (!entry) {
				// todo better error message / make sure this can't happen
				cancel("Something has gone wrong...");
				process.exit(1);
			}

			const record = await makeSiteStandardDocument(entry, publication);

			queuedOperations.push({
				type: ComAtprotoRepoCreateRecord,
				init: {
					input: {
						collection: "site.standard.document",
						repo: scuteConfig.identity,
						rkey,
						record,
					},
				} satisfies CallRequestOptions<ComAtprotoRepoCreateRecord.mainSchema>,
			});
		}

		// these documents exist in both the content collection, as well as the user's PDS
		for await (const rkey of localDocumentRkeys.intersection(
			publishedDocumentRkeys,
		)) {
			// cursed
			const entry = dataStore
				.get(publication.collectionName)
				?.get(rkey.replace(`scute-${publication.collectionName}-`, ""));
			if (!entry) {
				// todo better error message / make sure this can't happen
				cancel("Something has gone wrong...");
				process.exit(1);
			}

			const newDocument = await makeSiteStandardDocument(entry, publication);

			// are they identical? if so, skip
			if (isDeepStrictEqual(documentRecords.get(rkey), newDocument)) {
				return;
			}

			queuedOperations.push({
				type: ComAtprotoRepoPutRecord,
				init: {
					input: {
						collection: "site.standard.document",
						record: newDocument,
						repo: scuteConfig.identity,
						rkey,
					},
				} satisfies CallRequestOptions<ComAtprotoRepoPutRecord.mainSchema>,
			});
		}
	}

	if (queuedOperations.length === 0) {
		outro("Everything's already up to date!");
		process.exit(0);
	}

	// summary of queued ops

	queuedOperations.forEach((op) => {
		if (op.type === ComAtprotoRepoCreateRecord) {
			log.success(
				`creating ${(op.init as CallRequestOptions<ComAtprotoRepoCreateRecord.mainSchema>).input.rkey}`,
			);
		}
		if (op.type === ComAtprotoRepoPutRecord) {
			log.warning(
				`updating ${(op.init as CallRequestOptions<ComAtprotoRepoPutRecord.mainSchema>).input.rkey}`,
			);
		}
		if (op.type === ComAtprotoRepoDeleteRecord) {
			log.warning(
				`deleting ${(op.init as CallRequestOptions<ComAtprotoRepoDeleteRecord.mainSchema>).input.rkey}`,
			);
		}
	});

	const confirmed = await confirm({
		message: "Do you want to continue?",
	});
	cancelIfNeeded(confirmed);
	if (!confirmed) {
		cancel("Cancelled");
		process.exit(1);
	}
	for (const op of queuedOperations) {
		await ok(rpc.call(op.type, op.init));
	}
	outro("Done!");
	process.exit(0);
}
