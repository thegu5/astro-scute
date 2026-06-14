
> [!WARNING]
> This package isn't ready for use yet (not published), and isn't [spec-compliant](https://tangled.org/standard.site/lexicons/issues/7).


# astro-scute

astro-scute is an Astro integration that makes it easy to publish [standard.site](https://standard.site) records for your content collections, with minimal configuration and no scripting.

## Getting Started
First, install and add the integration:

`pnpm astro add astro-scute`

Then run the init command, which will walk you through setting up a `scute.config.ts`:

`pnpm scute init`

todo (+asciinema recording)

## Features
- [x] publishing/syncing records
- [x] automatic `.well-known` and `<link>` metadata injection
- [ ] Standard.site subscribe & recommend button components
- [ ] BlueSky comments component
  - [ ] tie to `bskyPostRef` 
- [ ] content loader (out of scope?)
