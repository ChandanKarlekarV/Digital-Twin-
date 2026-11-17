/**
 * Copies the open-source MediaPipe Hands runtime (Apache-2.0) from node_modules into
 * public/mediapipe/hands so hand tracking works offline and without a CDN round-trip.
 * Runs on `npm install` and before `npm run build`; the copied files are git-ignored.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', '@mediapipe', 'hands');
const dest = path.join(root, 'public', 'mediapipe', 'hands');

if (!fs.existsSync(src)) {
  console.warn('[copy-mediapipe] @mediapipe/hands not installed; the app will use the CDN fallback.');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
let copied = 0;
for (const name of fs.readdirSync(src)) {
  if (!/\.(js|wasm|data|binarypb|tflite)$/.test(name)) continue;
  const from = path.join(src, name);
  const to = path.join(dest, name);
  const fromStat = fs.statSync(from);
  if (fs.existsSync(to) && fs.statSync(to).size === fromStat.size) continue;
  fs.copyFileSync(from, to);
  copied++;
}
console.log(`[copy-mediapipe] ${copied} file(s) copied to public/mediapipe/hands`);
