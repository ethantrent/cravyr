/**
 * One-shot checks before device UAT: Render smoke + mobile TypeScript.
 * Usage: pnpm prod:verify
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  return r.status ?? 1;
}

let code = run('node', ['scripts/smoke-render.mjs']);
if (code !== 0) process.exit(code);

code = run('pnpm', ['--filter', 'cravyr-mobile', 'exec', 'tsc', '--noEmit']);
if (code !== 0) process.exit(code);

console.log(
  '\nOK — next: pnpm prod:dashboards → configure Supabase/Google/Expo → pnpm prod:device:uat → cd apps/mobile && pnpm start\n'
);
