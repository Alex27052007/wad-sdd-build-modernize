# Project: duck-emporium
- Language: TypeScript (ES modules), Node 20+.
- Use `node:`-prefixed built-ins.
- Tests live next to source as `*.test.ts`, run with `vitest`.
- User stories live in `../user-stories/`. Specs go in `specs/<story-id>/`.
- Never edit `user-stories/**`.
- Only edit files under `specs/**` when invoked through an `sdd-*` prompt.
- Follow the workflow in `.github/prompts/sdd-*.prompt.md` (VS Code) or
  `.claude/commands/sdd-*.md` (Claude Code).
- Payments are MOCKED. Never integrate a real payment provider.
