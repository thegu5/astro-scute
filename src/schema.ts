import { z } from "astro/zod";

// see https://github.com/withastro/astro/blob/675d11d0859478f0a31132e2ca1371b1afe5651d/packages/astro-rss/src/schema.ts#L6
const dateSchema = z
	.union([z.string(), z.number(), z.date()])
	.transform((value) => new Date(value))
	.refine((value) => !Number.isNaN(value.getTime()))

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
