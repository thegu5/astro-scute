import { readFileSync } from "node:fs";
import {
	ComAtprotoRepoUploadBlob,
	ComAtprotoSyncListBlobs,
} from "@atcute/atproto";
import * as CID from "@atcute/cid";
import { Client, ok } from "@atcute/client";
import type { Blob } from "@atcute/lexicons";
import type { SiteStandardThemeColor } from "@atcute/standard-site";
import { spinner } from "@clack/prompts";
import mime from "mime";
import type { ScuteConfig } from "./types.ts";
import { createSession, getConfig } from "./util.ts";

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

let remoteBlobs: string[] | undefined;

export async function blob(path: string): Promise<Blob> {
	if (process.env.NO_BLOBS) {
		return null!;
	}

	const mimeType = mime.getType(path);
	if (!mimeType) {
		throw new Error(`Failed to detect MIME type for ${path}`);
	}
	const fileContent = readFileSync(path);

	// prevent infinite recursion
	process.env.NO_BLOBS = "true";
	const scuteConfig = await getConfig();
	process.env.NO_BLOBS = "";

	const rpc = new Client({
		handler: await createSession(scuteConfig.identity),
	});

	if (!remoteBlobs) {
		const spin = spinner();
		spin.start("Fetching remote blobs");
		const resp = await ok(
			rpc.call(ComAtprotoSyncListBlobs, {
				params: {
					did: scuteConfig.identity,
					limit: 1000, // if there's more than a thousand...
				},
			}),
		);
		spin.stop("Fetched remote blobs");
		remoteBlobs = resp.cids;
	}

	const ref = CID.toCidLink(await CID.create(0x55, fileContent));

	if (!remoteBlobs.includes(ref.$link)) {
		const spin = spinner();
		spin.start(`Uploading ${path}`);
		await ok(
			rpc.call(ComAtprotoRepoUploadBlob, {
				input: fileContent,
				headers: {
					"Content-Type": mimeType,
					"Content-Length": fileContent.byteLength.toString(),
				},
			}),
		);
		spin.stop(`Uploaded ${path}`);
	}

	return {
		$type: "blob",
		mimeType,
		size: fileContent.byteLength,
		// remake ref so isDeepStrictEqual works
		ref: {
			$link: ref.$link,
		},
	};
}
