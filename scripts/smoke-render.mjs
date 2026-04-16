/**
 * Lightweight production smoke checks (no secrets).
 * Usage: pnpm smoke:prod
 * Optional: SMOKE_RENDER_URL=https://your-api.onrender.com pnpm smoke:prod
 */
const base = (process.env.SMOKE_RENDER_URL ?? 'https://cravyr-api.onrender.com').replace(/\/$/, '');

const paths = [
  ['/health', (r) => r.ok && r.headers.get('content-type')?.includes('json')],
  ['/privacy', (r) => r.ok],
  ['/auth/callback', (r) => r.ok],
];

async function main() {
  let failed = false;
  for (const [path, ok] of paths) {
    const url = `${base}${path}`;
    const res = await fetch(url, { redirect: 'manual' });
    const pass = ok(res);
    console.log(`${pass ? 'OK' : 'FAIL'}\t${res.status}\t${url}`);
    if (!pass) {
      const body = await res.text().catch(() => '');
      console.error(body.slice(0, 300));
      if (path === '/health') failed = true;
    }
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
