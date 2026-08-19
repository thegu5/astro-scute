import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Project } from "ts-morph";
import { addScuteSchema } from "../src/schema.ts";

function makeSourceFile(content: string) {
	const project = new Project({
		useInMemoryFileSystem: true,
		skipFileDependencyResolution: true,
	});
	return project.createSourceFile("content.config.ts", content);
}

describe("addScuteSchema", () => {
	it("adds a looseObject schema to a collection with no schema", async () => {
		const file = makeSourceFile(`
import { defineCollection } from "astro:content";

export const posts = defineCollection({
	name: "test",
});
`);

		await addScuteSchema("posts", file);

		const text = file.getFullText();

		assert.match(text, /schema:\s*z\.looseObject\(scuteSchema\.shape\)/);

		// zod import should be added
		assert.match(text, /import\s*\{[^}]*\bz\b[^}]*\}\s*from\s*"astro\/zod"/);
		// scuteSchema import should be added
		assert.match(
			text,
			/import\s*\{[^}]*\bscuteSchema\b[^}]*\}\s*from\s*"astro-scute"/,
		);
	});

	it("wraps an existing z.object schema with safeExtend", async () => {
		const file = makeSourceFile(`
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const posts = defineCollection({
  schema: z.object({
    title: z.string(),
  }),
});
`);

		await addScuteSchema("posts", file);

		const text = file.getFullText();
		// the z.object() wrapper is replaced by safeExtend(shape)
		assert.match(
			text,
			/schema:\s*scuteSchema\.safeExtend\(\{[\s\S]*?\}\)\s*,?/,
		);
		assert.match(
			text,
			/import\s*\{[^}]*\bscuteSchema\b[^}]*\}\s*from\s*"astro-scute"/,
		);
	});

	it("wraps an existing z.object schema provided via arrow function", async () => {
		const file = makeSourceFile(`
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const posts = defineCollection({
  schema: ({ image }) => z.object({
    title: z.string(),
    cover: image(),
  }),
});
`);

		await addScuteSchema("posts", file);

		assert.match(
			file.getFullText(),
			/schema:\s*\(\{ image \}\) => scuteSchema\.safeExtend\(\{[\s\S]*?\}\)\s*,?/,
		);
	});

	it("skips modification when schema already extends scuteSchema", async () => {
		const file = makeSourceFile(`
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { scuteSchema } from "astro-scute";

export const posts = defineCollection({
  schema: scuteSchema.extend({
    title: z.string(),
  }),
});
`);
		const originalText = file.getFullText();

		await addScuteSchema("posts", file);

		assert.equal(originalText, file.getFullText());
	});

	it("throws when the collection is not found", async () => {
		const file = makeSourceFile(`
import { defineCollection } from "astro:content";

export const posts = defineCollection({});
`);

		await assert.rejects(addScuteSchema("missing", file));
	});

	it("throws when the existing schema is not z.object", async () => {
		const file = makeSourceFile(`
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

export const posts = defineCollection({
  schema: z.looseObject({}),
});
`);

		await assert.rejects(addScuteSchema("posts", file));
	});
});
