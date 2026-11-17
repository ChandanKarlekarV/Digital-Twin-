/**
 * Pose classifier checks on synthetic MediaPipe-style hand landmarks (21 points, y down).
 * Run: npx tsx src/test/gestureClassifier.test.ts
 */
import { varunaGestureEngine, HandLandmark } from '../vision/VarunaGestureEngine';

type Finger = 'up' | 'down';

function hand(thumb: Finger, index: Finger, middle: Finger, ring: Finger, pinky: Finger): HandLandmark[] {
  const lm: HandLandmark[] = new Array(21);
  const wrist = { x: 0.5, y: 0.8 };
  lm[0] = { ...wrist, z: 0 };

  // Thumb (1-4): extended out to the side, or folded across the palm
  const thumbPts =
    thumb === 'up'
      ? [[0.44, 0.75], [0.39, 0.7], [0.35, 0.65], [0.31, 0.6]]
      : [[0.45, 0.75], [0.44, 0.69], [0.48, 0.66], [0.52, 0.66]];
  thumbPts.forEach(([x, y], i) => (lm[1 + i] = { x, y, z: 0 }));

  // Index..pinky: MCP row at y=0.64, spread in x
  const xs = [0.45, 0.5, 0.55, 0.6];
  [index, middle, ring, pinky].forEach((state, f) => {
    const x = xs[f];
    const base = 5 + f * 4;
    lm[base] = { x, y: 0.64, z: 0 }; // MCP
    if (state === 'up') {
      lm[base + 1] = { x, y: 0.56, z: 0 };
      lm[base + 2] = { x, y: 0.5, z: 0 };
      lm[base + 3] = { x, y: 0.45, z: 0 };
    } else {
      // curled: PIP up a little, tip folded back down toward the palm
      lm[base + 1] = { x, y: 0.58, z: 0 };
      lm[base + 2] = { x, y: 0.62, z: 0 };
      lm[base + 3] = { x, y: 0.67, z: 0 };
    }
  });
  return lm;
}

const cases: [string, HandLandmark[], string | null][] = [
  ['open palm', hand('up', 'up', 'up', 'up', 'up'), 'PALM'],
  ['fist', hand('down', 'down', 'down', 'down', 'down'), 'FIST'],
  ['point', hand('down', 'up', 'down', 'down', 'down'), 'INDEX_1'],
  ['victory', hand('down', 'up', 'up', 'down', 'down'), 'INDEX_2'],
  ['three', hand('down', 'up', 'up', 'up', 'down'), 'INDEX_3'],
  ['four (thumb tucked)', hand('down', 'up', 'up', 'up', 'up'), 'INDEX_4'],
  ['shaka', hand('up', 'down', 'down', 'down', 'up'), 'INDEX_5'],
];

let fail = 0;
const engine = varunaGestureEngine as any;
for (const [name, lm, expected] of cases) {
  const got = engine.analyzeSingleHand(lm, null).gesture;
  const ok = got === expected;
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', name.padEnd(22), '->', got);
}
console.log(fail ? `${fail} failures` : 'all passed');
if (fail) process.exit(1);
