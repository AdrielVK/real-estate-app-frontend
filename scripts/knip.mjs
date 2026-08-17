import { execFileSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const env = { ...process.env, KNIP_DISABLE_RAW_TRANSFER: '1' };

execFileSync(
  pnpm,
  ['exec', 'knip', '--tsConfig', 'tsconfig.knip.json', '--no-progress', ...process.argv.slice(2)],
  { env, stdio: 'inherit' },
);
