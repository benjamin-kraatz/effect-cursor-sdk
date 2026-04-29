# Effect Cursor SDK

Effect-based wrapper around the Cursor SDK (currently in beta).
Check out the following resources for more information about the SDK:

- [TypeScript SDK docs](https://cursor.com/docs/sdk/typescript)
- [API docs](https://cursor.com/docs/api)

<!-- effect-solutions:start -->

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.

Note that the Effect version used in this project is v4 (beta)!

The effect-solutions docs might be out of date, so you may need to look at the Effect repository for the most up-to-date information.
Here are some known conflicts:

- `ServiceMap.Service` has been renamed to `Context.Service`
- A branded ID instance (e.g. `const id = Schema.String.pipe(Schema.brand("ID"))`) is created using `brandedId.make(...)` instead of `.makeUnsafe(...)`

<!-- effect-solutions:end -->

## Local Effect Source

The Effect _v4_ repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation details when the documentation isn't enough.
