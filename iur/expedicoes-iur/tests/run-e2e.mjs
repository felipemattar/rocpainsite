// Copia o app para uma pasta temporária, troca js/firebase.js pelo stub, sobe um servidor e roda o teste.
// Rode com `npm run test:e2e` (funciona no Windows, macOS e Linux).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'iur-e2e-'));
for (const f of ['index.html', 'css', 'js', 'img']) fs.cpSync(path.join(ROOT, f), path.join(TMP, f), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'tests', 'firebase-stub.js'), path.join(TMP, 'js', 'firebase.js'));

const PORT = +(process.env.PORT || 8766);
const server = await serve(TMP, PORT);
process.chdir(ROOT);
process.env.BASE = `http://localhost:${PORT}`;
try {
  await import(pathToFileURL(path.join(ROOT, 'tests', 'e2e.mjs')).href);
} catch (e) {
  console.error(e); process.exitCode = 1;
} finally {
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
}
