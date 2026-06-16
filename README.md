
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

(insert asciinema recording here)

## Features / TODOs
- [x] publishing/syncing records
- [x] automatic `.well-known` and `<link>` metadata injection
- [ ] app password support (especially helpful for CI)
- [ ] be spec-compliant
- [ ] store content within Standard.site records
  - [ ] [markpub](https://markpub.at)
  - [ ] some HTML lexicon
- [ ] subscribe & recommend button components
- [ ] Bluesky comments component
  - [ ] tie to `bskyPostRef` ?
- [ ] content loader (out of scope?)
