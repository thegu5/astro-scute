import { defineLexiconConfig } from "@atcute/lex-cli";

export default defineLexiconConfig({
	generate: {
		files: ["lexicons/**/*.json"],
		outdir: "src/lexicons/",
	},
	pull: {
		outdir: "lexicons/",
		sources: [
			{
				type: "atproto",
				mode: "nsids",
				nsids: ["at.markpub.markdown", "at.markpub.text"],
			},
		],
	},
});
