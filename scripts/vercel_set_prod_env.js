const fs = require('fs');
const cp = require('child_process');

const envPath = 'nosso-momento-next/.env.local';
const lines = fs
  .readFileSync(envPath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((l) => l.startsWith('NEXT_PUBLIC_'));

for (const l of lines) {
  const i = l.indexOf('=');
  const key = l.slice(0, i).trim();
  const value = l.slice(i + 1);

  process.stdout.write(`\n[env] adding ${key} (production)\n`);
  const res = cp.spawnSync('npx', ['vercel', 'env', 'add', key, 'production'], {
    input: value + '\n',
    encoding: 'utf8',
    shell: true,
  });

  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stdout.write(res.stderr);
}
