# Engineering Conventions

These conventions are the source of truth for all code in this repository. They apply to contributors, generated changes, and AI-assisted changes.

## Sources Of Truth

- This document owns engineering rules that apply across the repository.
- [DESIGN.md](DESIGN.md) owns the visual identity, design tokens, UI patterns, component presentation, dashboard layout, motion, accessibility presentation, and user-facing content conventions for `apps/web`.
- Do not duplicate design-system values or UI recipes in this document. Link to the relevant section of `DESIGN.md` and update the owning document instead.
- When the documents appear to overlap, follow the domain owner: this document for engineering behavior and `DESIGN.md` for product design.

## Principles

1. Prefer clear, smart code and clever compact abstractions over duplicated code.
2. Keep behavior close to the package or feature that owns it.
3. Reuse code when behavior and semantics are genuinely shared.
4. Make invalid states difficult to represent with types and validation.
5. Keep public behavior covered by focused tests.

## Repository Boundaries

> Repository structure, internal packages, and task configuration must follow the official [Turborepo documentation](https://turborepo.com/docs). These requirements are mandatory and review-blocking.

- Follow [Structuring a repository](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository): `apps/*` contains deployable products and product-specific composition, while `packages/*` contains reusable libraries, infrastructure, and shared contracts.
- Follow [Internal Packages](https://turborepo.com/docs/core-concepts/internal-packages): workspace dependencies must be declared with `workspace:*`.
- Import another workspace through its declared package exports. Never reach into another workspace with relative paths; see the Turborepo guidance on the [anatomy of a package](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository#anatomy-of-a-package).
- Follow [Running tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks): root scripts may only delegate to `turbo run` or perform truly repository-wide checks. Never invoke `turbo` from a package-level script.
- Follow [Configuring tasks](https://turborepo.com/docs/crafting-your-repository/configuring-tasks): package tasks belong in the package `package.json` and must be registered in `turbo.json` when they participate in the shared task graph.
- Use the [`turbo.json` reference](https://turborepo.com/docs/reference/configuration) for task dependencies, inputs, outputs, environment variables, caching, persistence, and package-specific configuration.

## Environment Variables

> Environment loading must follow the official [Bun environment-variable documentation](https://bun.sh/docs/runtime/environment-variables), [`dotenv-cli` usage](https://github.com/entropitor/dotenv-cli), and Turborepo guidance for [environment variables](https://turborepo.com/docs/crafting-your-repository/using-environment-variables) and [configuration](https://turborepo.com/docs/reference/configuration). The root `.env` workflow below is an intentional repository convention and is mandatory and review-blocking.

- `.env.example` is the committed schema and documentation for supported variables. It must contain placeholders or safe defaults only, never secrets.
- `.env.dev` is the ignored local development profile. `.env.prod` is the ignored local production profile. Neither file may be committed.
- The root `.env` is the only active local environment file and must be a direct copy of exactly one profile: use `cp .env.dev .env` for development or `cp .env.prod .env` for a local production run.
- Treat `.env` as generated local state. Do not edit it independently of its source profile, because switching environments must remain reproducible by copying the selected profile again.
- Do not use `.env.local`, package-level `.env` files, or Bun's automatic `.env.development`, `.env.production`, and `.env.test` variants. Bun loads these with higher precedence than `.env`, which would make the selected-profile invariant false and create configuration that Turbo cannot reason about consistently.
- Bun automatically loads `.env` for Bun processes. The root development command additionally uses `dotenv -- bun run scripts/dev.ts` deliberately: `dotenv-cli` loads `.env` before Bun starts the orchestration script, so every child process—including `turbo run` and its package tasks—inherits the same environment.
- Environment variables must be loaded or exported before starting `turbo run`. Never create or mutate variables inside a Turbo task and expect them to affect task hashing; Turborepo captures the environment when the task starts.
- Turborepo does not load `.env` files. Keep the root `.env` in `globalDependencies` so local profile changes invalidate the cache. If this convention is replaced with package-scoped env files, register each consumed file in the relevant task `inputs`.
- Keep Turbo in strict environment mode. Every variable required by a task must be declared in `env`, `globalEnv`, `passThroughEnv`, or `globalPassThroughEnv`.
- Variables that can change task outputs—including `NEXT_PUBLIC_*`, API origins, feature flags, and build-time configuration—must be listed in the relevant task `env` or in `globalEnv` so their values participate in the cache hash.
- Use `passThroughEnv` or `globalPassThroughEnv` only for runtime credentials and metadata whose values must not affect cached outputs. Adding a variable only to a passthrough list makes it available to the task but does not include its value in the cache hash.
- CI and hosted production environments must inject variables through the platform secret/environment system. Do not copy `.env.prod` into source control, build artifacts, or deployment images. Disable Bun's automatic env-file loading with `--no-env-file` when a production or CI entrypoint must rely exclusively on injected environment variables.
- When adding, renaming, or removing an environment variable, update `.env.example`, the appropriate ignored profiles, Turbo's `env` or passthrough configuration, and any deployment-platform configuration in the same change.

## TypeScript

> TypeScript code must follow the official [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) and [TSConfig reference](https://www.typescriptlang.org/tsconfig/). Runtime schemas must follow the official [Zod documentation](https://zod.dev/). Repository-specific choices below remain mandatory and review-blocking.

- Enable TypeScript [`strict`](https://www.typescriptlang.org/tsconfig/strict.html) mode.
- Do not use explicit `any`. Use `unknown`, generics, or a concrete type.
- Follow the TypeScript guidance on [interfaces and type aliases](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#interfaces): prefer `interface` for object contracts and `type` for unions and derived types.
- Use `as const` objects plus derived union types instead of [TypeScript enums](https://www.typescriptlang.org/docs/handbook/enums.html).
- Validate external input at the boundary with [Zod parsing](https://zod.dev/basics) or a dedicated parser.
- Do not use type assertions to hide an unresolved type mismatch.
- Keep functions small enough that their inputs, effects, and return paths are visible without scrolling through unrelated behavior.

## Critical Type Ownership

> [!IMPORTANT]
> Database-backed TypeScript contracts must follow Supabase's official [TypeScript support](https://supabase.com/docs/reference/javascript/typescript-support) and [generated types](https://supabase.com/docs/guides/api/rest/generating-types) documentation. Every rule in this section is mandatory. Type duplication across generated database contracts, packages, apps, routes, and components is a correctness issue, not a stylistic preference.

- `packages/supabase/src/database.types.ts` is generated through the [Supabase CLI](https://supabase.com/docs/reference/cli/introduction) and is the canonical source for database rows, inserts, updates, relationships, and JSON values. Never edit it manually and never recreate any of its table shapes elsewhere.
- Derive database-backed types with `Tables<'table'>`, `TablesInsert<'table'>`, `TablesUpdate<'table'>`, `Enums<'enum'>`, and `Json`. Build projections with `Pick`, `Omit`, `Partial`, intersections, and indexed access such as `Tables<'scans'>['created_at']`.
- A semantic contract has exactly one owner. Status maps, report DTOs, API payloads, action results, and type guards must be declared once and imported by every consumer. Do not keep a second local copy for convenience.
- Specialized contracts must derive from their canonical base. Extend or compose the existing type instead of copying its property list.
- Persisted `json` and `jsonb` values use the generated `Json` type. At an untrusted boundary, receive `unknown`, validate it with the canonical parser or type guard, and only then expose a domain type. Do not substitute `Record<string, unknown>` for a known persisted JSON contract.
- Database adapters may rename fields for API or UI use, for example `created_at` to `createdAt`, but the renamed field type must use indexed access to the generated row type.
- Constant maps and their unions are declared together once. Database-backed subsets must be checked against the generated column type and narrowed with guards or `Extract`; do not scatter literal unions or `as TStatus`/`as TPlan` assertions across consumers.
- Shared contracts imported by Client Components must live in client-safe modules containing no secret access, service-role client creation, or other server-only runtime dependencies.
- Raw external input remains `string` or `unknown` until validation. After a URL passes the canonical scanner validator, use the shared `TUrl` contract instead of redeclaring URL fields as unrelated strings.
- Compatibility aliases are allowed only when preserving a published API. Mark them deprecated, point to the canonical type, and do not build new code on the alias.

## Naming

- Components, exported types, and exported constants use `PascalCase`.
- Functions, variables, hooks, and file-local constants use `camelCase`.
- Interfaces use the existing `IName` convention.
- Union aliases use the existing `TName` convention.
- Constant-map objects that replace enums use the existing `EName` convention.
- React component files use `kebab-case.tsx`.
- Hooks start with `use-`.
- Names must describe responsibility. Avoid generic containers such as `helpers`, `common`, `misc`, or `utils` unless the module is narrowly scoped.

## Formatting And Imports

> Formatting and linting behavior must follow the official [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) and [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) documentation. Type-only imports must follow the TypeScript [module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html#type-only-imports-and-exports).

- `oxfmt` is authoritative; configure it through the official [Oxfmt configuration reference](https://oxc.rs/docs/guide/usage/formatter/config-file-reference): single quotes and no semicolons.
- `oxlint` must pass without new warnings; configure rules through the official [Oxlint configuration reference](https://oxc.rs/docs/guide/usage/linter/config).
- Import types with [`import type`](https://www.typescriptlang.org/docs/handbook/modules/reference.html#type-only-imports-and-exports).
- Prefer direct package entrypoints, especially for large UI libraries.
- Do not create barrel files solely to shorten imports in application route or UI trees. A per-directory `index.ts` barrel is allowed for server-side library folders (the `packages/*` sources and `apps/web/lib/*` server modules) where it defines the folder's public surface; never barrel under `apps/web/app/**`, and never mix `'use client'` and server-only modules in one barrel.
- Order imports as external packages, workspace packages, app aliases, then relative modules.

## Comments

- Never place comments inside JSX or other UI templates — this includes `{/* */}` blocks, comments inside `className` expressions, and comments inside template literals used for markup. Keep the markup comment-free; explain intent through component/variable names or a comment above the component, never inside it.
- Do not place comments in CSS, SCSS, Sass, or Less files.
- Express template and style intent through semantic elements, component names, design tokens, and extracted utilities.
- Source comments are allowed only when they explain a non-obvious constraint, invariant, compatibility issue, or decision.
- Do not narrate what the next line does.
- Use `// MARK: - Section Name` for in-file section boundaries when a file benefits from explicit navigation.
- Lint suppression comments require a concrete reason and the narrowest possible scope.
- Generated files are exempt when the generator controls their content.

### TypeScript API Documentation

> Public TypeScript APIs must use [TSDoc-compatible documentation comments](https://tsdoc.org/). These requirements are mandatory and review-blocking.

- Every exported interface, type, class, function, and constant that belongs to a package's public API must have a `/** ... */` documentation comment.
- Start with a concise summary of the API's purpose. Add `@remarks` only for constraints, invariants, lifecycle details, side effects, or behavior that is not clear from the declaration.
- Document public interface properties when their units, defaults, limits, interactions, or domain meaning are not completely evident from the name and type.
- Reusable library packages (`packages/*` and `apps/cli`) use the fuller JSDoc form on their public API: `@param`, `@returns`, `@throws`, `@example`, `@defaultValue`, `@deprecated`, and — where they make the generated package docs clearer — `@typedef`, `@interface`, `@export`, and `@async`, including typed `@param {Type}` / `@returns {Type}` forms. `packages/scanner/src/crawl.ts` is the reference style.
- Application code (`apps/web`) stays lean: a one-line `/** ... */` on exported symbols, plus `// MARK:` sections and "why" comments — do not duplicate the signature per parameter there.
- Either way, documentation explains the contract a caller sees; it must not narrate the implementation line by line.
- Do not restate a declaration in prose. Documentation must explain the contract seen by a caller, not narrate the implementation or repeat types, names, and modifiers.
- Keep documentation attached to the canonical declaration. Re-exports and compatibility aliases must not maintain competing copies of the same contract documentation.
- Use [TypeDoc](https://typedoc.org/documents/Doc_Comments.html) as the reference for rendering and supported documentation behavior. When TypeDoc accepts a legacy JSDoc form that conflicts with TSDoc, the [TSDoc form](https://typedoc.org/documents/Doc_Comments.TSDoc_Support.html) is authoritative for this repository.

## React And Next.js

> React and Next.js code must follow the current official [React documentation](https://react.dev/) and [Next.js App Router documentation](https://nextjs.org/docs/app). HeroUI integrations must follow the official [HeroUI v3 documentation](https://heroui.com/docs/react/releases/v3-0-0).

- Follow the Next.js [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) guidance: default to Server Components and add [`'use client'`](https://nextjs.org/docs/app/api-reference/directives/use-client) only for browser APIs, interactive state, or client-only library requirements.
- Keep client boundaries as low as practical and avoid passing large objects across them.
- Follow the Next.js [data-fetching guidance](https://nextjs.org/docs/app/getting-started/fetching-data): fetch independent server data in parallel, start asynchronous work early, and await it as late as practical.
- Follow the Next.js [lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading): lazy-load heavy client-only behavior when it is not needed for initial render.
- React supports several forms of [conditional rendering](https://react.dev/learn/conditional-rendering); this repository requires ternaries instead of truthy `&&` rendering.
- Import HeroUI components from granular entrypoints such as `@heroui/react/card`, not the `@heroui/react` barrel.
- Wrap HeroUI only when the wrapper establishes a product-wide contract or removes repeated configuration.
- Follow HeroUI's [composition guidance](https://heroui.com/docs/react/getting-started/composition): use compound component APIs when available.
- Follow Supabase's [Next.js Auth](https://supabase.com/docs/guides/auth/quickstarts/nextjs) and [SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) guidance. Do not expose a `/dashboard` route without an explicit access boundary: the layout verifies the Supabase session and redirects unauthenticated users to `/login`.

## UI Architecture

The canonical component hierarchy, shared UI patterns, and extraction criteria are defined in [DESIGN.md — Components](DESIGN.md#components).

Reusable components must:

- accept data and callbacks rather than importing feature stores;
- avoid route-specific assumptions;
- expose variants instead of requiring callers to replace internal styling;
- preserve native element behavior and accessibility;
- remain usable outside the page where they were introduced.

Large files are a review signal, not an automatic failure. At roughly 250 lines for a component or 80 lines for a function, check whether independent behavior can move into a named component, hook, or pure helper.

## Web UI And Design System

- UI implementation in `apps/web` must follow [DESIGN.md](DESIGN.md).
- Use the canonical definitions for [color and theming](DESIGN.md#color-and-theming), [typography](DESIGN.md#typography), [spacing and layout](DESIGN.md#spacing-and-layout), [components](DESIGN.md#components), [motion](DESIGN.md#motion-and-animation), [accessibility](DESIGN.md#accessibility), and [content and internationalization](DESIGN.md#content-and-internationalization).
- Dashboard work must follow [DESIGN.md — Dashboard and admin layout](DESIGN.md#dashboard-and-admin-layout).
- Design changes are incomplete until `DESIGN.md` and the canonical tokens or components it references agree with the implementation.

## Scanner Checks

- Define checks with `defineCheck` and create results with `makeResult`.
- Every result must include concrete detail.
- `WARN` and `FAIL` results must provide evidence, a fix, impact, and effort.
- `PASS` and informational results may omit remediation fields when no action is required.
- Informational checks must not affect scoring.
- New checks require focused tests for pass, warning, failure, and important edge cases that the check can produce.
- Network and parser failures must become explicit report outcomes rather than uncaught exceptions.

## API And Data

> API and data security must follow the relevant [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) guidance and official [Supabase security documentation](https://supabase.com/docs/guides/database/secure-data). These requirements are mandatory and review-blocking.

- Validate request bodies and identifiers before side effects, following the OWASP [Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) and [REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) guidance.
- Keep secrets and service-role credentials on the server, following OWASP [Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) and Supabase's [API key security](https://supabase.com/docs/guides/getting-started/api-keys) guidance.
- Protect persisted sensitive identifiers according to the OWASP [Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) guidance; store hashes instead of raw API keys or IP addresses.
- Preserve the zero-configuration in-memory path where documented.
- Database writes must check and handle provider errors.
- Follow the Supabase documentation for [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [database migrations](https://supabase.com/docs/guides/deployment/database-migrations): RLS policies and migrations are part of the feature and must be reviewed with the calling API.
- Do not claim authentication, billing, or persistence behavior in the UI before the corresponding server path exists.

## Error Handling

> Error responses and diagnostic logging must follow the OWASP [REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) and [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) guidance.

- Return stable machine-readable error codes from APIs without exposing implementation details.
- Log or retain enough context to diagnose provider failures without exposing secrets or personal data, following the OWASP logging data-exclusion guidance.
- Do not silently swallow writes that affect product correctness.
- Fail open only when the product explicitly chooses availability over enforcement, and document that decision in source.

## Testing

> JavaScript and TypeScript tests must follow the official [Bun test runner documentation](https://bun.sh/docs/test). Database tests must follow the official [Supabase testing documentation](https://supabase.com/docs/guides/local-development/testing/overview).

- Every behavior change needs a test at the lowest useful level.
- Pure logic uses unit tests.
- API boundaries, persistence adapters, and critical user flows use integration tests.
- UI primitives with interaction need keyboard and state tests.
- Tests must use and await the public sync-or-async contract. Do not preserve stale options, duplicate fixtures, or assertions for fields no longer owned by that contract.
- A change is complete when these commands pass:

```sh
bun run lint
bun run format:check
bun run test
bun run type-check
bun run build
```

Supabase tests additionally require the [local Supabase stack](https://supabase.com/docs/guides/local-development) or an equivalent CI service.

## Documentation And Releases

> Changelogs must follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Published package versions must follow [Semantic Versioning 2.0.0](https://semver.org/), the npm [`package.json` requirements](https://docs.npmjs.com/files/package.json/), and the applicable [GitHub release guidance](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

- Update README, examples, environment templates, and roadmap when behavior changes.
- Update `DESIGN.md` when visual identity, tokens, UI patterns, component presentation, dashboard layout, motion, accessibility presentation, or user-facing content conventions change.
- Do not document npm packages, tags, Action versions, or premium features as available before they are published.
- Keep `CHANGELOG.md` formatted, curated, and current.
- Public packages must have an explicit SemVer-compatible version and a reproducible release process.
