import { z } from "astro/zod";

const dateSchema = z.coerce
	.date()
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
