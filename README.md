# astro-scute

astro-scute is an Astro integration that makes it easy to publish [Standard.site](https://standard.site) records for your content collections, with minimal configuration and no scripting.

## Getting Started
First, install and add the integration:

`pnpm astro add astro-scute`

Then run the init command, which will walk you through setting up a `scute.config.ts`:

`pnpm scute init`

That's it, you're all set up! Your site now has the necessary metadata, and running `pnpm scute publish` will sync the Standard.site records to your PDS.

### Notes

A schema is provided to handle frontmatter properties relevant to standard.site.
You might need to add it manually if the init script fails to do it for you:
```ts
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { scuteSchema } from "astro-scute";

const blog = defineCollection({
  // ...
  schema: z.object({
    // your props go here
  }).safeExtend(scuteSchema.shape),
});
```

To publish documents via CI, you can make scute use an app password via the `SCUTE_APP_PASSWORD` environment variable.

## Development

Make sure to run `pnpm astro sync` to generate types for astro's virtual modules (`astro:content`, etc)

## Features / TODOs
- [x] publishing/syncing records
- [x] automatic `.well-known` and `<link>` metadata injection
- [x] store content within Standard.site records
  - [x] [markpub](https://markpub.at)
  - [x] some HTML lexicon
- [x] app password support (especially helpful for CI)
- [ ] documentation
  - [ ] 'blessed' frontmatter properties
  - [ ] asciinema recording
  - [ ] jsdoc everywhere
- [ ] be spec-compliant
- [ ] subscribe & recommend button components
- [ ] Bluesky comments component
  - [ ] tie to `bskyPostRef` ?
- [ ] content loader (out of scope?)
