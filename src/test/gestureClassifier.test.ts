/**
 * Pose classifier checks on synthetic MediaPipe-style hand landmarks (21 points, y down).
 * Run: npx tsx src/test/gestureClassifier.test.ts
 */
import { varunaGestureEngine, HandLandmark } from '../vision/VarunaGestureEngine';
import { useRigStore } from '../store/useRigStore';

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
  ['thumb up', thumb(-1), 'THUMB_UP'],
  ['thumb down', thumb(1), 'THUMB_DOWN'],
];

/** Fist with the thumb standing straight up (dir -1) or down (dir 1) */
function thumb(dir: 1 | -1): HandLandmark[] {
  const lm = hand('down', 'down', 'down', 'down', 'down');
  [[0.42, 0.7], [0.41, 0.7 + dir * 0.07], [0.41, 0.7 + dir * 0.14], [0.41, 0.7 + dir * 0.21]].forEach(([x, y], i) => (lm[1 + i] = { x, y, z: 0 }));
  return lm;
}

let fail = 0;
const check = (ok: boolean, label: string, got: unknown) => {
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(34), '->', got);
};
const engine = varunaGestureEngine as any;
for (const [name, lm, expected] of cases) {
  const got = engine.analyzeSingleHand(lm, null).gesture;
  check(got === expected, name, got);
}

// ---- End-to-end through the live pipeline with timed frames (~25 fps) ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// MediaPipe reports un-mirrored x; the engine mirrors it back
const raw = (lm: HandLandmark[], dx = 0) => lm.map((p) => ({ x: 1 - (p.x + dx), y: p.y, z: 0 }));
async function feed(hands: HandLandmark[][], frames: number) {
  for (let i = 0; i < frames; i++) {
    engine.handleMediaPipeResults({ multiHandLandmarks: hands });
    await sleep(40);
  }
}
const none = () => feed([], 2);

(async () => {
  engine.isRunning = true;
  const store = useRigStore.getState();

  // 1. Two fingers only select; nothing opens until the fist
  await feed([raw(hand('down', 'up', 'up', 'down', 'down'))], 25);
  check(useRigStore.getState().gestureSelection?.index === 2, '2 fingers selects crane 1', useRigStore.getState().gestureSelection?.label);
  check(useRigStore.getState().activeHoloModal === null, '...and does not open it yet', useRigStore.getState().activeHoloModal);
  await feed([raw(hand('down', 'down', 'down', 'down', 'down'))], 8);
  check(useRigStore.getState().activeHoloModal === 'crane1', 'fist opens crane 1', useRigStore.getState().activeHoloModal);
  check(useRigStore.getState().gestureSelection === null, 'selection cleared after opening', useRigStore.getState().gestureSelection);
  store.closeHoloModal?.();
  useRigStore.setState({ activeHoloModal: null });
  await none();

  // 2. A fist with nothing selected opens nothing
  await feed([raw(hand('down', 'down', 'down', 'down', 'down'))], 10);
  check(useRigStore.getState().activeHoloModal === null, 'fist alone opens nothing', useRigStore.getState().activeHoloModal);
  await none();

  // 3. Thumb up / down step through the layers
  useRigStore.setState({ cameraViewMode: 'topside' });
  await feed([raw(thumb(1))], 20);
  check(useRigStore.getState().cameraViewMode === 'subsea', 'thumb down: one layer down', useRigStore.getState().cameraViewMode);
  await none();
  await feed([raw(thumb(-1))], 20);
  check(useRigStore.getState().cameraViewMode === 'topside', 'thumb up: one layer up', useRigStore.getState().cameraViewMode);
  await none();

  // 4. Two open palms moving apart -> positive zoom (in); together -> negative (out)
  const palm = hand('up', 'up', 'up', 'up', 'up');
  let maxIn = 0;
  let maxOut = 0;
  for (let i = 0; i < 16; i++) {
    const spread = i < 8 ? 0.06 + i * 0.03 : 0.06 + (16 - i) * 0.03;
    engine.handleMediaPipeResults({ multiHandLandmarks: [raw(palm, -0.2 - spread), raw(palm, 0.2 + spread)] });
    const z = useRigStore.getState().gestureSpatial.zoomDelta;
    maxIn = Math.max(maxIn, z);
    maxOut = Math.min(maxOut, z);
    await sleep(40);
  }
  check(maxIn > 0, 'two hands apart zooms in', maxIn.toFixed(3));
  check(maxOut < 0, 'two hands together zooms out', maxOut.toFixed(3));

  engine.isRunning = false;
  console.log(fail ? `${fail} failures` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
