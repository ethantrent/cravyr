---
phase: 260702-da1
plan: 01
subsystem: api/server, ci
tags: [observability, ci, render, deploy-verification]
status: complete
commit: (see git log — committed with 260702-da1 message)
requires:
  - render.yaml (Render injects RENDER_GIT_COMMIT into the service env)
provides:
  - GET /version endpoint reporting the deployed commit
  - deploy-verify.yml workflow that fails (and emails via GitHub notifications) when a push does not reach production within 20 minutes
affects:
  - Prevents recurrence of the June 28 – July 2 silent deploy outage
key-files:
  created:
    - .github/workflows/deploy-verify.yml
  modified:
    - apps/api/src/server.ts
    - apps/api/src/__tests__/health.test.ts
decisions:
  - "Polling /version from CI over a Render deploy webhook/API key — zero secrets, zero external config; works on the free tier"
  - "20-minute window (40 × 30s): free-tier builds + cold starts can be slow; short windows would false-alarm"
  - "Bootstrap: /version 404s until the first deploy containing it — the poll treats that as not-yet-deployed and keeps waiting, so the first run self-resolves"
verification:
  - "pnpm turbo test typecheck → 6 tasks successful (40 API tests)"
---

# Summary: Deploy-failure alarm

Production ran a stale build for 4 days because Render deploy failures are
invisible from the repo. Now every push to main is verified end-to-end:
`GET /version` reports `RENDER_GIT_COMMIT`, and the `Verify Render Deploy`
workflow polls it until it matches the pushed SHA or fails the run after
20 minutes — surfacing through GitHub's standard workflow-failure notification.
