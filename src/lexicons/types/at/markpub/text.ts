import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";

const _mainSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal("at.markpub.text")),
	/**
	 * Facets here represent rendered versions of Markdown strings. A bold Markdown string `**bold**` might be represented by a richtext facet of #bold, in which case it is suggested to be presented without the Markdown markup as `&lt;strong&gt;bold&lt;/strong&gt;`. Facets select their character ranges based on position in the Markdown text but should be rendered without the related characters. For example: `### Header` will be selected using a character range that includes the hashes like (0,9) but will be rendered without the hashes like `&lt;h3&gt;Header&lt;/h3&gt;`. It is recommended that processors to not transform in-place for this reason. The goal of having an open union for facets is that constructing systems may choose to use the facets they prefer from across the ecosystem, either here or in other places like `pub.leaflet.richtext.facet`
	 */
	get facets() {
		return /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.array(/*#__PURE__*/ v.variant([])),
		);
	},
	/**
	 * Lenses are lexicons that define translatable facets for rendering layers with limited facets. `pub.leaflet.richtext.facet#bold` and `at.markpub.facets.baseFormatting#strong` expect the same output. A lens would then include a union with both those facets and a renderer that understands either of them could translate between the two.
	 */
	get lenses() {
		return /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.array(/*#__PURE__*/ v.variant([])),
		);
	},
	/**
	 * The raw text in markdown. May include anything that is valid markdown syntax for your flavor. Make sure it is properly escaped if necessary.
	 */
	markdown: /*#__PURE__*/ v.string(),
	/**
	 * Text may be blob-ified as raw Markdown and stored on a PDS, pass it here by reference. If you use this property it is assumed that it overrides the "rawMarkdown" property. It is a PDS address for a markdown text file. You still must provide some value, even if it is a preview for "rawMarkdown" in this field.
	 * @accept text/*
	 * @maxSize 1000000
	 */
	textBlob: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.blob(), [
			/*#__PURE__*/ v.blobSize(1000000),
			/*#__PURE__*/ v.blobAccept(["text/*"]),
		]),
	),
});

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
