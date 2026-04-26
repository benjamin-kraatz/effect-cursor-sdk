# effect-cursor-sdk

Effect-based SDK for Cursor integrations. Published as ESM with TypeScript declarations in `dist/`.

## Install

```bash
bun add effect-cursor-sdk
```

npm / pnpm:

```bash
npm install effect-cursor-sdk
```

This package declares a peer dependency on [`effect`](https://github.com/Effect-TS/effect). Install a compatible version in your app.

## Usage

```ts
import { packageName } from "effect-cursor-sdk";

console.log(packageName);
```

## Contributing

Clone the repo, install dependencies, and build:

```bash
bun install
bun run build
```

The build runs [`tsdown`](https://tsdown.dev/) (see [`tsdown.config.ts`](tsdown.config.ts)) and writes ESM plus `.d.ts` files to `dist/`. Source lives under [`src/`](src/).

Checks (same as CI):

```bash
bun run typecheck   # tsc --noEmit
bun run lint        # oxlint
bun run format:check # oxfmt --check
bun run test        # vitest run; use @effect/vitest for Effect-based tests
```

Validate the package layout before publishing:

```bash
bun run lint:package
```

Inspect the tarball (without publishing):

```bash
bun pm pack
```

## Publish

1. Ensure you are logged in: `npm whoami`.
2. Update `version` in `package.json` as needed.
3. Set `repository`, `bugs`, and `homepage` in `package.json` to your real Git URLs.
4. Run `npm publish` (or `bun publish`). `prepublishOnly` runs `bun run build` automatically.

For a scoped package on the public registry, add to `package.json`:

```json
"publishConfig": {
  "access": "public"
}
```

## LICENSE

This project is confidential and proprietary. It is not open source and is not offered for public use. Access, reading, use, modification, and distribution are limited to the project owner, Cursor team members acting in their official capacity, and others only when the owner has expressly authorized them for those purposes - unless otherwise agreed in writing by the project owner and/or the Cursor team.

This may change.
