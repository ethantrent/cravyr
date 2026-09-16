---
type: execute
status: planned
files_modified:
  - README.md
  - .planning/STATE.md
---

# Document the code and local development entry points

Authorized scope: a documentation pass for the public repository. Preserve source code, configuration, release history and all outstanding device/store validation.

1. Add a root README with the problem, source walkthrough, package commands, service configuration prerequisites and status limits.
2. Validate every relative source link and package command against this checkout. This pass does not claim a successful application/device run.
3. Record the checks in this task's SUMMARY.md and add the task to STATE.md without changing milestone completion.
4. Publish one documentation-only commit with `[skip ci] [skip render]` to avoid triggering application deployment.

Workflow initialized through the project's recorded GSD core 1.6.1 `query init.quick` command. Planning and execution are performed in this session without subagents.
