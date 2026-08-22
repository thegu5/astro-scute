import { readFileSync } from "node:fs";
import * as CID from "@atcute/cid";
import type { Blob } from "@atcute/lexicons";
import type { SiteStandardThemeColor } from "@atcute/standard-site";
import { lookup } from "mrmime";
import type { ScuteConfig } from "./types.ts";

export function defineConfig(options: ScuteConfig): ScuteConfig {
	return options;
}

type Rgb = SiteStandardThemeColor.Rgb & {
	$type: "site.standard.theme.color#rgb";
};

/**
 * Conver a hex color to a Standard.site basic theme RGB color.
 * @param hex The hex color to convert
 * @returns A record of type `site.standard.theme.color#rgb`
 */
export function color(hex: `#${string}`): Rgb {
	if (hex.length === 4) {
		return {
			$type: "site.standard.theme.color#rgb",
			r: Number.parseInt(hex.charAt(1), 16) * 0x11,
			g: Number.parseInt(hex.charAt(2), 16) * 0x11,
			b: Number.parseInt(hex.charAt(3), 16) * 0x11,
		};
	} else if (hex.length === 7) {
		return {
			$type: "site.standard.theme.color#rgb",
			r: Number.parseInt(hex.substring(1, 3), 16),
			g: Number.parseInt(hex.substring(3, 5), 16),
			b: Number.parseInt(hex.substring(5, 7), 16),
		};
	} else {
		throw new Error(`Invalid input ${hex}`);
	}
}

export const blobFilePaths = new WeakMap<Blob, string>();

/**
 * Create a blob reference for a local file, which will automatically be synced during the publishing process.
 * @param path The path to the file
 * @returns A blob reference
 */
export async function blob(path: string): Promise<Blob> {
	const mimeType = lookup(path);
	if (!mimeType) {
		throw new Error(`Failed to detect MIME type for ${path}`);
	}

	const fileContent = readFileSync(path);

	const ref = CID.toCidLink(await CID.create(0x55, fileContent));

	const blob = {
		$type: "blob" as const,
		mimeType,
		size: fileContent.byteLength,
		// remake ref so isDeepStrictEqual works
		ref: {
			$link: ref.$link,
		},
	};
	blobFilePaths.set(blob, path);

	return blob;
}
