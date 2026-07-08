---
description: Implement a single numbered task from the task list.
---
Goal: implement task `${input:taskNumber}` from `specs/${input:storyId}/tasks.md`.

Rules:
- Read spec.md, plan.md and tasks.md before touching any code.
- Implement ONLY the named task. Do not start the next one.
- Add or update tests for the task. Run `vitest` and ensure it is green.
- If a test fails, fix the code (not the test) until it passes.
- Stop after the task is green and wait for approval to commit.
