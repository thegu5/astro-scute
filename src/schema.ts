import { z } from "astro/zod";
import { Node, Project } from "ts-morph";

// see https://github.com/withastro/astro/blob/675d11d0859478f0a31132e2ca1371b1afe5651d/packages/astro-rss/src/schema.ts#L6
const dateSchema = z
	.union([z.string(), z.number(), z.date()])
	.transform((value) => new Date(value))
	.refine((value) => !Number.isNaN(value.getTime()));

/**
 * Base schema for frontmatter properties relevant to scute
 */
export const scuteSchema = z.object({
	title: z.string(),
	description: z.string().optional(),

	/* one of these must exist (enforced when publishing) */
	pubDate: dateSchema.optional(),
	publishedAt: dateSchema.optional(),

	categories: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional(),
});

export function addScuteSchema(collectionName: string) {
	const project = new Project({
		tsConfigFilePath: "./tsconfig.json",
	});
	const file = project.getSourceFileOrThrow("content.config.ts");

	// TODO: support other patterns?
	const initializer = file
		.getVariableDeclarationOrThrow(collectionName)
		.getInitializerOrThrow();

	if (!Node.isCallExpression(initializer)) {
		throw new Error(
			`Expected collection "${collectionName}" to be initialised with a call expression (e.g. defineCollection(…)).`,
		);
	}
	const args = initializer.getArguments();
	if (args.length === 0) {
		throw new Error(
			`defineCollection() call for "${collectionName}" has no arguments.`,
		);
	}
	const configArg = args[0];
	if (!Node.isObjectLiteralExpression(configArg)) {
		throw new Error(
			`The argument to defineCollection() for "${collectionName}" is not an object literal.`,
		);
	}
	let schemaProp = configArg.getProperty("schema");
	if (!Node.isPropertyAssignment(schemaProp)) {
		throw new Error("invalid schema prop");
	}
	if (!schemaProp) {
		schemaProp = configArg.addPropertyAssignment({
			name: "schema",
			initializer: "scuteSchema",
		});
	}

	const schemaValue = schemaProp.getInitializerOrThrow();

	if (schemaValue.getText().includes("scuteSchema")) {
		return;
	}

	schemaValue.replaceWithText(
		`${schemaValue.getText()}.safeExtend(scuteSchema.shape)`,
	);

	const existingImport = file.getImportDeclaration("astro-scute");
	if (!existingImport) {
		file.addImportDeclaration({
			moduleSpecifier: "astro-scute",
			namedImports: ["scuteSchema"],
		});
	} else {
		const alreadyImported = existingImport
			.getNamedImports()
			.some((i) => i.getName() === "scuteSchema");

		if (!alreadyImported) {
			existingImport.addNamedImport("scuteSchema");
		}
	}

	file.saveSync();
}
