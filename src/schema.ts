import { z } from "astro/zod";

// https://github.com/withastro/astro/blob/main/packages/astro-rss/src/schema.ts#L6
const dateSchema = z
	.union([z.string(), z.number(), z.date()])
	.transform((value) => new Date(value))
	.refine((value) => !Number.isNaN(value.getTime()))

/**
 * Base schema for frontmatter properties relevant to scute
 */
export const scuteSchema = z
	.object({
		title: z.string(),
		description: z.string().optional(),

		pubDate: dateSchema.optional(),
		publishedAt: dateSchema.optional(),

		categories: z.array(z.string()).optional(),
		tags: z.array(z.string()).optional(),
	})
	.refine(
		(data) => data.pubDate || data.publishedAt,
		"Either pubDate or publishedAt must exist.",
	);
