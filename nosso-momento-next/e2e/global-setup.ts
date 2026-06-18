import * as fs from 'fs';
import * as path from 'path';

function parseEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export default function globalSetup(): void {
  const root = path.join(__dirname, '..');
  parseEnvFile(path.join(root, '.env.e2e.local'));
  parseEnvFile(path.join(root, '.env.local'));

  const hasDebug =
    !!(process.env.E2E_APPCHECK_DEBUG_TOKEN || process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN);
  console.log(`[e2e] App Check debug token: ${hasDebug ? 'configurado' : 'AUSENTE (E2E em prod com enforce vai falhar)'}`);
}
