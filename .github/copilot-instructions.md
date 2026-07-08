# Copilot Instructions for duck-emporium

This is a Spec-Driven Development (SDD) workshop lab building a duck e-commerce application.

## Quick Reference

**Language**: TypeScript (ES modules), Node 20+  
**Test runner**: `vitest` (run tests with `npm test` in duck-emporium/)  
**Test granularity**: `npm test -- src/cart.test.ts` (single test file)  
**Build tools**: TypeScript compiler (no separate build step; tests compile on-the-fly via vitest)

## Project Layout

- **`duck-emporium/`**: The main TypeScript application
  - `src/`: Module implementations (e.g., `catalog.ts`, `cart.ts`, `checkout.ts`, `orders.ts`, `render.ts`, `duck.ts`, `persist.ts`)
  - `src/*.test.ts`: Tests live adjacent to source files (co-located)
  - `specs/`: Spec-driven task lists organized by user-story ID (e.g., `specs/browse-catalog/`, `specs/checkout/`)
  - `data/`: Runtime data (ducks catalog, persisted state)
  - `.github/prompts/`: Reusable SDD prompts for VS Code (sdd-spec.prompt.md, sdd-implement.prompt.md, sdd-plan.prompt.md, sdd-tasks.prompt.md)
  - `.claude/commands/`: Equivalent SDD commands for Claude Code
  - `AGENTS.md`: Project conventions (never edit user-stories/; only edit specs/ during SDD)
  - `CLAUDE.md`: Same conventions as AGENTS.md

- **`user-stories/`**: Read-only SDD user story templates (never edit these)
  - Each story has a markdown document defining the feature from a user perspective

## Spec-Driven Development Workflow

This repo follows a structured workflow for implementing features:

1. **Write a spec** (`.github/prompts/sdd-spec.prompt.md` or `.claude/commands/sdd-spec.md`):
   - Parse the user story
   - Define APIs and data model
   - Create `specs/<story-id>/spec.md`

2. **Create a plan** (`.github/prompts/sdd-plan.prompt.md` or `.claude/commands/sdd-plan.md`):
   - Break spec into tasks
   - Write `specs/<story-id>/plan.md`

3. **List tasks** (`.github/prompts/sdd-tasks.prompt.md` or `.claude/commands/sdd-tasks.md`):
   - Generate ordered checklist
   - Write `specs/<story-id>/tasks.md`

4. **Implement a single task** (`.github/prompts/sdd-implement.prompt.md` or `.claude/commands/sdd-implement.md`):
   - Read the three spec files (spec.md, plan.md, tasks.md)
   - Implement **only the numbered task** you are assigned
   - Add or update tests; run `npm test` and verify all tests pass
   - Stop and wait for approval before moving to the next task

**Key discipline**: Only edit files under `specs/` when in an SDD workflow. Never edit `user-stories/`.

## Testing

```bash
# Run all tests
npm test

# Run a single test file
npm test -- src/catalog.test.ts

# Watch mode (during development)
npm test -- --watch
```

Tests live as `*.test.ts` files adjacent to their source modules. Use `vitest` syntax (similar to Jest).

## Code Conventions

- **Imports**: Use Node.js `node:` prefixes for built-ins (e.g., `import { readFileSync } from "node:fs"`)
- **Modules**: ES modules only (`"type": "module"` in package.json)
- **TypeScript**: Strict mode enabled; all source files must type-check
- **Data persistence**: Mocked via `src/persist.ts`; never integrate real payment providers or external storage
- **Test patterns**: Tests should read the spec, plan, and tasks to understand the contract being tested

## Architecture Notes

**Catalog & Duck Data**:
- `Duck` type defines a duck product (id, name, image, bio, price)
- `Catalog` is the immutable collection of ducks (loaded once at startup)
- Duck data lives in `data/ducks.json`

**Shopping Cart**:
- Cart stores items as `{ duckId, quantity }`
- Cart operations are pure functions; state is managed externally (by the caller)

**Checkout & Orders**:
- Checkout aggregates cart → order with totals and tax calculation
- Payments are **MOCKED**. Do not integrate real payment providers.
- Orders are persisted via the `persist.ts` module

**Rendering**:
- Terminal UI rendering functions (AST-based, printed as plain text)
- Tests verify output by shape/structure, not exact string matching

## Important Constraints

1. **Never edit `user-stories/`** — these are read-only spec templates
2. **Payments are mocked** — never integrate real payment processors
3. **TypeScript strict mode** — all code must pass TypeScript strict checks
4. **Tests must pass** — no incomplete or skipped tests
5. **Only edit `specs/` during SDD workflows** — follow the `.github/prompts/` or `.claude/commands/` workflows

## Troubleshooting

- **Tests fail after editing code**: Run `npm test -- src/moduleName.test.ts` and fix the implementation, not the test
- **TypeScript errors**: Check `tsconfig.json` for strict settings; ensure all types are explicit
- **Module not found**: Verify ES module paths are correct (no `.js` extensions in imports; use `node:` prefix for built-ins)

## Related Documentation

- `docs/workshop.md`: Full workshop and SDD introduction
- `duck-emporium/AGENTS.md`: Detailed conventions for this project
- `.github/prompts/`: VS Code Copilot SDD workflow prompts
- `.claude/commands/`: Claude Code SDD workflow commands
