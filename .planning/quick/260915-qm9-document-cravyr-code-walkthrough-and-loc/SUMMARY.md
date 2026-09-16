---
status: complete
scope: documentation
---

# Cravyr documentation pass

Added a root README with a source walkthrough, workspace commands, configuration prerequisites, and release/validation limits. All linked source paths and package names/scripts were checked against the checkout. No application source, dependency, deployment setting, schema, or credential was changed.

Validation: relative links resolve; documented commands match package scripts and the CI workflow; git diff whitespace checks pass. A fresh install, application tests, device sign-in, production smoke checks, and database queries were not run. The README explicitly distinguishes these instructions from verified setup or release readiness.

Supabase's current changelog and API-key guidance were consulted; existing environment-variable names were preserved and server-only keys are distinguished from public mobile configuration. No Supabase feature or database change was made.

The task was initialized with GSD core 1.6.1 `query init.quick`. Work was performed sequentially in the isolated checkout. Milestone completion and prior release records remain unchanged. Publish with `[skip ci] [skip render]` to avoid application deployment for this documentation change.
