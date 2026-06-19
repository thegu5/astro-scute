
> [!WARNING]
> This package isn't fully ready for use yet, as it isn't [spec-compliant](https://tangled.org/standard.site/lexicons/issues/7).

# astro-scute

astro-scute is an Astro integration that makes it easy to publish [Standard.site](https://standard.site) records for your content collections, with minimal configuration and no scripting.

## Getting Started
First, install and add the integration:

`pnpm astro add astro-scute`

Then run the init command, which will walk you through setting up a `scute.config.ts`:

`pnpm scute init`

That's it, you're all set up! Your site now has the necessary metadata, and running `pnpm scute publish` will sync the Standard.site records to your PDS.

### Notes

For better error handling with frontmatter, it's highly recommended to have your content collection's schema extend `scuteSchema` like so:

```ts
const blog = defineCollection({
  // ...
  schema: z.object({
    // your props go here
  }).safeExtend(scuteSchema),
});
```

## Development

Make sure to run `pnpm astro sync` to generate types for astro's virtual modules (`astro:content`, etc)

## Features / TODOs
- [x] publishing/syncing records
- [x] automatic `.well-known` and `<link>` metadata injection
- [x] store content within Standard.site records
  - [x] [markpub](https://markpub.at)
  - [x] some HTML lexicon
- [ ] documentation
  - [ ] 'blessed' frontmatter properties
  - [ ] asciinema recording
  - [ ] jsdoc everywhere
- [ ] app password support (especially helpful for CI)
- [ ] be spec-compliant
- [ ] subscribe & recommend button components
- [ ] Bluesky comments component
  - [ ] tie to `bskyPostRef` ?
- [ ] content loader (out of scope?)
