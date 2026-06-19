import { z } from "astro/zod";

/**
 * Base schema for frontmatter properties relevant to scute
 */
export const scuteSchema = z
	.object({
		title: z.string(),
		description: z.string().optional(),

		pubDate: z.coerce.date().optional(),
		publishedAt: z.coerce.date().optional(),

		categories: z.array(z.string()).optional(),
		tags: z.array(z.string()).optional(),
	})
	.refine(
		(data) => data.pubDate || data.publishedAt,
		"Either pubDate or publishedAt must exist.",
	);
