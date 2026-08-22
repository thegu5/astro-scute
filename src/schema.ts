import { z } from "astro/zod";
import type { CallExpression, SourceFile } from "ts-morph";
import { maxGraphemes } from "./util.ts";

// see https://github.com/withastro/astro/blob/675d11d0859478f0a31132e2ca1371b1afe5651d/packages/astro-rss/src/schema.ts#L6
const dateSchema = z
	.union([z.string(), z.number(), z.date()])
	.transform((value) => new Date(value))
	.refine((value) => !Number.isNaN(value.getTime()));

/** Base schema for frontmatter properties relevant to scute */
export const scuteSchema = z.object({
	title: z.string(),
	description: z.string().optional(),

	/* one of these must exist (enforced when publishing) */
	pubDate: dateSchema.optional(),
	publishedAt: dateSchema.optional(),

	categories: z.array(z.string()).optional(),

	tags: z.array(z.string()).optional(),

	labels: z.optional(z.array(z.string().max(128)).max(10)),

	contributors: z.optional(
		z.array(
			z.object({
				did: z.templateLiteral(["did:", z.string(), ":", z.string()]),
				role: z.optional(z.string().check(maxGraphemes(100)).max(1000)),
				displayName: z.string().check(maxGraphemes(100)).max(1000),
			}),
		),
	),
});

export async function addScuteSchema(
	collectionName: string,
	sourceFile?: SourceFile,
) {
	const { Node, Project } = await import("ts-morph");

	let file = sourceFile;
	if (!file) {
		const project = new Project({
			tsConfigFilePath: "./tsconfig.json",
		});
		file = project.getSourceFileOrThrow("content.config.ts");
	}

	const initializer = file
		.getVariableDeclarationOrThrow(collectionName)
		.getInitializerOrThrow();

	if (!Node.isCallExpression(initializer)) {
		throw new Error(
			`Expected collection "${collectionName}" to be initialised with a call expression (e.g. defineCollection).`,
		);
	}
	const args = initializer.getArguments();
	if (args.length === 0) {
		throw new Error(
			`defineCollection() call for "${collectionName}" has no arguments.`,
		);
	}

	// this is the collection's configuration (name, schema, ...)
	const configArg = args[0];
	if (!Node.isObjectLiteralExpression(configArg)) {
		throw new Error(
			`The argument to defineCollection() for "${collectionName}" is not an object literal.`,
		);
	}

	let schemaProp = configArg.getProperty("schema");
	if (!schemaProp) {
		const zodImport = file.getImportDeclaration("astro/zod");
		if (!zodImport) {
			file.addImportDeclaration({
				moduleSpecifier: "astro/zod",
				namedImports: ["z"],
			});
		} else if (!zodImport.getNamedImports().some((i) => i.getName() === "z")) {
			zodImport.addNamedImport("z");
		}

		schemaProp = configArg.addPropertyAssignment({
			name: "schema",
			// this is a looseObject to make sure we don't break existing setups
			initializer: "z.looseObject(scuteSchema.shape)",
		});

		ensureScuteSchemaImport(file);
	}

	if (!Node.isPropertyAssignment(schemaProp)) {
		throw new Error("invalid schema prop");
	}

	const schemaValue = schemaProp.getInitializerOrThrow();

	let zodCall: CallExpression | undefined;

	// handle cases where the schema is using astro's `image()`, e.g. `schema: ({ image }) => z.object({})`
	if (
		Node.isArrowFunction(schemaValue) ||
		Node.isFunctionExpression(schemaValue)
	) {
		const fnBody = schemaValue.getBody();
		if (Node.isCallExpression(fnBody)) {
			zodCall = fnBody;
		}
	} else if (Node.isCallExpression(schemaValue)) {
		zodCall = schemaValue;
	}

	if (!zodCall) {
		throw new Error("missing CallExpression in collection schema initializer");
	}

	// schema already used, so there's nothing to do
	if (zodCall.getText().includes("scuteSchema")) {
		return;
	}

	// if the user's existing schema is z.object
	const zodPropExpr = zodCall.getExpression();
	if (
		Node.isPropertyAccessExpression(zodPropExpr) &&
		zodPropExpr.getName() === "object"
	) {
		zodCall.replaceWithText(
			`scuteSchema.safeExtend(${zodCall.getArguments()[0]?.getText()})`,
		);
	} else {
		throw new Error("existing schema isn't z.object, bailing");
	}

	ensureScuteSchemaImport(file);

	if (!sourceFile) {
		await file.save();
	}
}

/** Ensure `scuteSchema` is imported */
function ensureScuteSchemaImport(file: SourceFile) {
	const existingImport = file.getImportDeclaration("astro-scute");
	if (!existingImport) {
		file.addImportDeclaration({
			moduleSpecifier: "astro-scute",
			namedImports: ["scuteSchema"],
		});
		return;
	}

	const alreadyImported = existingImport
		.getNamedImports()
		.some((i) => i.getName() === "scuteSchema");

	if (!alreadyImported) {
		existingImport.addNamedImport("scuteSchema");
	}
}
