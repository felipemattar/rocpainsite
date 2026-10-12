// Checagem de sintaxe de todos os .js/.mjs de js/ e tests/ (`npm run check`).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
for (const d of ['js', 'tests']) for (const f of fs.readdirSync(path.join(ROOT, d), { recursive: true }).map(String)) {
  if (!/\.m?js$/.test(f) || f.split(path.sep).includes('node_modules')) continue;
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, d, f)], { stdio: 'inherit' }); }
  catch (e) { bad++; }
}
console.log(bad ? `${bad} arquivo(s) com erro de sintaxe.` : 'Sintaxe ok.');
process.exitCode = bad ? 1 : 0;
