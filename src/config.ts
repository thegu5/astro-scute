import type { SiteStandardThemeColor } from "@atcute/standard-site";
import type { ScuteConfig } from "./types.ts";

export function defineConfig(options: ScuteConfig): ScuteConfig {
	return options;
}

type Rgb = SiteStandardThemeColor.Rgb & {
	$type: "site.standard.theme.color#rgb";
}

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
