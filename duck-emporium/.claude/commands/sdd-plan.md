---
description: Turn an approved spec into a technical plan.
---
Story id: $ARGUMENTS

Goal: produce `specs/$ARGUMENTS/plan.md` from `specs/$ARGUMENTS/spec.md`.

Rules:
- Read the spec first. If it has unresolved "Open questions", stop and ask.
- Do not write code. Do not modify the spec.
- The plan covers: data model, module/file layout, public interfaces,
  external dependencies, testing strategy, risks.
- Stop after writing the plan and wait for approval.
