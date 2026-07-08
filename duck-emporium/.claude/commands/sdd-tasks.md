---
description: Break an approved plan into an ordered task list.
---
Story id: $ARGUMENTS

Goal: produce `specs/$ARGUMENTS/tasks.md` from `specs/$ARGUMENTS/plan.md`.

Rules:
- Each task is independently committable and has a clear acceptance check
  (e.g. "`vitest` for X passes").
- Number tasks sequentially. Note dependencies between them.
- Do not write code. Do not modify the spec or the plan.
- Stop after writing tasks.md and wait for approval.
