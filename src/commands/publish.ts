import { isDeepStrictEqual } from "node:util";
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
	InferOutput,
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
import type { DataEntry } from "astro/content/config";
import {
	buildPublicationUri,
	cancelIfNeeded,
	createOAuthSession,
	getConfig,
	getDataStore,
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
function makeSiteStandardDocument(
	entry: DataEntry,
	baseContentPath: string | undefined,
	pubUri: string,
) {
	const publishedAtSrc = entry.data.pubDate ?? entry.data.publishedAt;
	const publishedAt =
		publishedAtSrc instanceof Date
			? publishedAtSrc.toISOString()
			: (publishedAtSrc as string);

	return {
		$type: "site.standard.document",
		// would be _real nice_ to have astro:content typing here !!
		title: entry.data.title as string,
		site: pubUri as `${string}:${string}`,
		publishedAt,
		path: `${baseContentPath ?? ""}/${entry.id}`,
		// TODO: CONTENT, ETC
	} satisfies InferOutput<typeof SiteStandardDocument.mainSchema>;
}

export async function publish() {
	const scuteConfig = await getConfig();

	const dataStore = await getDataStore();

	const loginSpin = spinner();
	loginSpin.start("Logging in");
	const session = await createOAuthSession(scuteConfig.identity);
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
		// so, we delete them (after confirmation..? todo)
		publishedDocumentRkeys.difference(localDocumentRkeys).forEach((rkey) => {
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
		});

		// these documents exist in the content collection, but not on the user's PDS
		localDocumentRkeys.difference(publishedDocumentRkeys).forEach((rkey) => {
			// cursed
			const entry = dataStore
				.get(publication.collectionName)
				?.get(rkey.replace(`scute-${publication.collectionName}-`, ""));
			if (!entry) {
				// todo better error message / make sure this can't happen
				cancel("Something has gone wrong...");
				process.exit(1);
			}

			const record = makeSiteStandardDocument(
				entry,
				publication.baseContentPath,
				pubUri,
			);

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
		});

		// these documents exist in both the content collection, as well as the user's PDS
		localDocumentRkeys.intersection(publishedDocumentRkeys).forEach((rkey) => {
			// cursed
			const entry = dataStore
				.get(publication.collectionName)
				?.get(rkey.replace(`scute-${publication.collectionName}-`, ""));
			if (!entry) {
				// todo better error message / make sure this can't happen
				cancel("Something has gone wrong...");
				process.exit(1);
			}

			const newDocument = makeSiteStandardDocument(
				entry,
				publication.baseContentPath,
				pubUri,
			);

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
		});
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
				`creating ${(op.init as CallRequestOptions<ComAtprotoRepoDeleteRecord.mainSchema>).input.rkey}`,
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
}
