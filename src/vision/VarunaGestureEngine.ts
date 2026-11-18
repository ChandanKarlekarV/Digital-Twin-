/**
 * VARUNA-AI hand gestures (MediaPipe Hands, webcam, runs offline).
 *
 *   Open palm, moving ...... rotate the view        Palm held still ...... freeze
 *   Two palms apart ........ zoom in                Two palms together ... zoom out
 *   Thumb up / down ........ one view layer up / down (derrick ... drill bit)
 *   1-5 fingers, held ...... SELECT a part (1 = helipad or the pointed part,
 *                            2 = crane 1, 3 = crane 2, 4 = command dock,
 *                            thumb + pinky = living quarters)
 *   Fist ................... OPEN the selected part (nothing opens without it)
 *   Two fists .............. toggle the exploded view
 */

import { useRigStore, RecognizedGesture, GESTURE_PARTS, CameraViewMode } from '../store/useRigStore';

export type { RecognizedGesture };

/**
 * MediaPipe Hands (open source, Apache-2.0). Served from the app itself first
 * (public/mediapipe/hands, copied from node_modules by scripts/copy-mediapipe.mjs) so
 * gestures work offline; the pinned CDN copy is only a fallback.
 */
const MEDIAPIPE_HANDS_SOURCES = ['/mediapipe/hands', 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240'];
let mediaPipeBase = MEDIAPIPE_HANDS_SOURCES[0];
let mediaPipeLoad: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(src));
    };
    document.head.appendChild(script);
  });
}

async function loadMediaPipeHands(): Promise<void> {
  if ((window as any).Hands) return;
  if (!mediaPipeLoad) {
    mediaPipeLoad = (async () => {
      for (const base of MEDIAPIPE_HANDS_SOURCES) {
        try {
          await loadScript(`${base}/hands.js`);
          mediaPipeBase = base;
          return;
        } catch {
          // try the next source
        }
      }
      mediaPipeLoad = null;
      throw new Error('Could not load the hand-tracking model (run npm install, or check the internet connection), or use Demo Vision mode.');
    })();
  }
  return mediaPipeLoad;
}

/**
 * One Euro filter (Casiez et al., CHI 2012): an adaptive low-pass filter. Slow movement is
 * smoothed hard (no jitter on a still hand), fast movement passes with little lag.
 */
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  constructor(private minCutoff = 1.2, private beta = 9, private dCutoff = 1.0) {}
  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value: number, tSec: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tSec;
      return value;
    }
    const dt = Math.min(Math.max(tSec - this.t, 1 / 120), 0.25);
    this.t = tSec;
    const dxRaw = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dxRaw - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

/** Frames a raw pose must persist before it is reported (debounces flicker at ~30 fps). */
const POSE_STABLE_FRAMES = 4;
/** A change in the number of hands must last this many frames (one-frame dropouts are ignored). */
const HAND_COUNT_CONFIRM_FRAMES = 3;
/** Per-frame motion below this is treated as tracking noise and removed (screen widths / frame). */
const MOTION_DEADZONE = 0.0012;
/** Hold time for count gestures (2-4 fingers, shaka) before a subsystem opens. */
const INDEX_HOLD_MS = 700;
/** Centroid speed (screen widths / frame) below which a hand counts as still. */
const STILL_SPEED = 0.006;
/** Two-hand zoom: ignore spread changes below this (screen widths / frame), then scale. */
const ZOOM_DEADZONE = 0.0035;
const ZOOM_GAIN = 1.1;
/** Thumb up/down: hold time before a layer step, and the repeat interval while held. */
const THUMB_HOLD_MS = 450;
const THUMB_REPEAT_MS = 1300;
/** A finger-count selection waits this long for the confirming fist. */
const SELECTION_TTL_MS = 5000;

export interface HandLandmark {
  x: number;
  y: number;
  z?: number;
  type?: 'wrist' | 'palm' | 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
}

export interface SingleHandData {
  landmarks: HandLandmark[];
  wrist: HandLandmark;
  thumbTip: HandLandmark;
  indexTip: HandLandmark;
  centroid: { x: number; y: number };
  fingerCount: number;
  isPinching: boolean;
  pinchDist: number;
  pinchDelta: number; // + pinch out (zoom in), - pinch in (zoom out)
  isFist: boolean;
  gesture: RecognizedGesture;
  role: 'ZOOM' | 'ORBIT' | 'IDLE';
}

export interface GestureTrackingResult {
  gesture: RecognizedGesture;
  confidence: number;
  handsCount: number;
  handX: number;
  handY: number;
  handDistance: number;
  deltaX: number;
  deltaY: number;
  zoomDelta: number;
  isTwoHanded: boolean;
  isPinching: boolean;
  fingerCount: number;
  primaryHand: SingleHandData | null;
  secondaryHand: SingleHandData | null;
  landmarks: HandLandmark[];
  activeMode:
    | 'DECOUPLED_DUAL'
    | 'DUAL_MOVE_ZOOM'
    | 'ORBIT'
    | 'ZOOM'
    | 'SPLIT'
    | 'MERGE'
    | 'INDEX_SELECT'
    | 'IDLE';
}

class VarunaGestureEngine {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  private mediaPipeHands: any = null;
  private isProcessingMediaPipe = false;

  // Smoothing buffers for Hand 1 and Hand 2
  private smoothedLandmarks1: HandLandmark[] = [];
  private smoothedLandmarks2: HandLandmark[] = [];

  // Motion history for continuous deltas & decoupled roles
  private prevHand1Pos: { x: number; y: number; time: number } | null = null;
  private prevHand2Pos: { x: number; y: number; time: number } | null = null;
  private prevPinchDist1: number | null = null;
  private prevPinchDist2: number | null = null;
  private prevDistance: number | null = null;

  // Sustained gesture stability & cooldowns
  private sustainedGesture: RecognizedGesture = null;
  private sustainedGestureStartTime = 0;
  private lastMergeTime = 0;
  private lastSliceTime = 0;
  private lastIndexTriggerTime = 0;
  private prevHandsCount = 0;
  /** Recent raw poses per hand slot, for frame-voting */
  private poseHistory: RecognizedGesture[][] = [[], []];
  private handIsStill = false;
  private stablePoses: RecognizedGesture[] = [null, null];
  /** One Euro filters per hand slot: 21 landmarks x (x, y, z) */
  private filters: OneEuro[][] = [[], []];
  /** Last extended/curled state of each finger per hand slot, for hysteresis */
  private fingerState: boolean[][] = [[], []];
  private countCandidate = 0;
  private countCandidateFrames = 0;

  // Viewfinder callbacks
  private onFrameCallbacks: Set<(result: GestureTrackingResult, video: HTMLVideoElement) => void> = new Set();


  // State deduplication & 60 FPS performance
  private lastReportedGesture: RecognizedGesture = null;
  private lastProcessTime = 0;
  private lastTrackingResult: GestureTrackingResult = {
    gesture: null,
    confidence: 0,
    handsCount: 0,
    handX: 0.5,
    handY: 0.5,
    handDistance: 0,
    deltaX: 0,
    deltaY: 0,
    zoomDelta: 0,
    isTwoHanded: false,
    isPinching: false,
    fingerCount: 0,
    primaryHand: null,
    secondaryHand: null,
    landmarks: [],
    activeMode: 'IDLE',
  };

  public async start(): Promise<boolean> {
    if (this.isRunning && this.stream?.active) return true;

    const store = useRigStore.getState();
    store.setCameraPermissionState('requesting');
    store.setCameraErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'MediaDevices API not supported in this browser context. Please access via http://localhost:1420 or HTTPS.'
        );
      }

      this.stream = await this.acquireCameraStream();

      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.setAttribute('playsinline', 'true');
        this.videoElement.setAttribute('webkit-playsinline', 'true');
        this.videoElement.muted = true;
        this.videoElement.autoplay = true;
        this.videoElement.style.position = 'fixed';
        this.videoElement.style.top = '-9999px';
        this.videoElement.style.left = '-9999px';
        this.videoElement.style.width = '1px';
        this.videoElement.style.height = '1px';
        this.videoElement.style.opacity = '0';
        this.videoElement.style.pointerEvents = 'none';
        document.body.appendChild(this.videoElement);
      }

      this.videoElement.srcObject = this.stream;
      await new Promise<void>((resolve) => {
        if (!this.videoElement) return resolve();
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play().then(() => resolve()).catch(() => resolve());
        };
        setTimeout(resolve, 800);
      });

      if (!this.canvasElement) {
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 260;
        this.canvasElement.height = 160;
        this.ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });
      }

      // Initialize MediaPipe Hands for multi-hand tracking (max 2 hands).
      // Loaded on demand (pinned version) so it never blocks page start-up.
      if (!this.mediaPipeHands) {
        await loadMediaPipeHands();
        const Hands = (window as any).Hands;
        this.mediaPipeHands = new Hands({
          locateFile: (file: string) => `${mediaPipeBase}/${file}`,
        });
        this.mediaPipeHands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.55,
        });
        this.mediaPipeHands.onResults(this.handleMediaPipeResults);
        // Downloads the wasm + model now, so the first frames are not lost
        await this.mediaPipeHands.initialize();
      }

      this.isRunning = true;
      store.setGestureCameraActive(true);
      store.setCameraPermissionState('active');
      store.setCameraErrorMessage(null);

      this.processLoop();
      return true;
    } catch (err: unknown) {
      console.error('Failed to initialize Varuna Vision Camera:', err);
      const errName = (err as { name?: string })?.name;
      const errMsg = (err as { message?: string })?.message || '';

      let userFriendlyMsg = 'Unable to start camera.';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        store.setCameraPermissionState('denied');
        userFriendlyMsg =
          'Camera blocked. In Windows: Settings > Privacy > Camera > Turn ON access. In Browser: Click the lock icon in address bar to Allow.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        store.setCameraPermissionState('error');
        userFriendlyMsg = 'Camera is in use by another app (Zoom/Teams/Discord/Camera app). Close it and retry.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        store.setCameraPermissionState('error');
        userFriendlyMsg = 'No physical webcam detected on this device. You can use the Demo Vision mode.';
      } else {
        store.setCameraPermissionState('error');
        userFriendlyMsg = errMsg || 'Camera initialization error. Try Demo Vision mode.';
      }

      store.setCameraErrorMessage(userFriendlyMsg);
      store.setGestureCameraActive(false);
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.mediaPipeHands = null;
      return false;
    }
  }

  private async acquireCameraStream(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
    } catch (e1) {
      console.warn('Stage 1 (720p) failed, trying Stage 2 (480p)...', e1);
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
    } catch (e2) {
      console.warn('Stage 2 (480p) failed, trying Stage 3 unconstrained...', e2);
    }

    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  }

  /**
   * MediaPipe Multi-Hand Pipeline: Decoupled Varuna Dual-Hand Tracking & Instant Freeze
   */
  private handleMediaPipeResults = (results: any): void => {
    if (!this.isRunning || !results) return;

    const multiHandLandmarks = (results.multiHandLandmarks || []).slice(0, 2);
    const handsCount = multiHandLandmarks.length;

    // Hand-count hysteresis: a hand that blinks out (or a false second hand) for a frame or
    // two must not reset tracking or fire actions. Hold still until the change is confirmed.
    if (handsCount !== this.prevHandsCount) {
      this.countCandidateFrames = handsCount === this.countCandidate ? this.countCandidateFrames + 1 : 1;
      this.countCandidate = handsCount;
      if (this.countCandidateFrames < HAND_COUNT_CONFIRM_FRAMES) {
        const sp = useRigStore.getState().gestureSpatial;
        if (sp && (sp.deltaX || sp.deltaY || sp.zoomDelta)) {
          useRigStore.getState().setGestureSpatial({ ...sp, deltaX: 0, deltaY: 0, zoomDelta: 0 });
        }
        return;
      }
    }
    this.countCandidate = handsCount;
    this.countCandidateFrames = 0;

    if (handsCount === 0) {
      this.prevHandsCount = 0;
      this.prevHand1Pos = null;
      this.prevHand2Pos = null;
      this.prevPinchDist1 = null;
      this.prevPinchDist2 = null;
      this.prevDistance = null;

      const emptyResult: GestureTrackingResult = {
        gesture: null,
        confidence: 0,
        handsCount: 0,
        handX: 0.5,
        handY: 0.5,
        handDistance: 0,
        deltaX: 0,
        deltaY: 0,
        zoomDelta: 0,
        isTwoHanded: false,
        isPinching: false,
        fingerCount: 0,
        primaryHand: null,
        secondaryHand: null,
        landmarks: [],
        activeMode: 'IDLE',
      };
      this.lastTrackingResult = emptyResult;
      useRigStore.getState().setGestureSpatial({
        deltaX: 0,
        deltaY: 0,
        zoomDelta: 0,
        distance: 0,
        handsCount: 0,
        primaryHand: null,
        secondaryHand: null,
        activeMode: 'IDLE',
      });
      useRigStore.getState().setPointerCursor({ x: 0.5, y: 0.5, active: false });
      return;
    }

    const now = performance.now();

    // 1. Sort hands deterministically by X position so Hand 1 is ALWAYS left-screen and Hand 2 is ALWAYS right-screen
    let hand1Raw: HandLandmark[];
    let hand2Raw: HandLandmark[] | null = null;

    if (handsCount >= 2) {
      const rawA = this.extractLandmarks(multiHandLandmarks[0]);
      const rawB = this.extractLandmarks(multiHandLandmarks[1]);
      if (rawA[0].x <= rawB[0].x) {
        hand1Raw = rawA;
        hand2Raw = rawB;
      } else {
        hand1Raw = rawB;
        hand2Raw = rawA;
      }
    } else {
      hand1Raw = this.extractLandmarks(multiHandLandmarks[0]);
    }

    // Hand slots are re-assigned when a hand enters/leaves: drop history so the
    // smoother never blends two different hands (that produced phantom swipes)
    if (handsCount !== this.prevHandsCount) {
      this.prevHandsCount = handsCount;
      this.smoothedLandmarks1 = [];
      this.smoothedLandmarks2 = [];
      this.prevHand1Pos = null;
      this.prevHand2Pos = null;
      this.prevDistance = null;
      this.poseHistory = [[], []];
      this.stablePoses = [null, null];
      this.filters = [[], []];
      this.fingerState = [[], []];
    }

    const tSec = now / 1000;
    // Remove sub-threshold jitter from a per-frame motion component, keep real motion intact
    const deadzone = (d: number) => (Math.abs(d) <= MOTION_DEADZONE ? 0 : d - Math.sign(d) * MOTION_DEADZONE);

    // Process Hand 1
    this.smoothedLandmarks1 = this.smoothLandmarks(0, hand1Raw, tSec);
    const hand1Data = this.stabilizePose(0, this.analyzeSingleHand(this.smoothedLandmarks1, this.prevPinchDist1, 0));
    const dH1_x = this.prevHand1Pos ? deadzone(hand1Data.centroid.x - this.prevHand1Pos.x) : 0;
    const dH1_y = this.prevHand1Pos ? deadzone(hand1Data.centroid.y - this.prevHand1Pos.y) : 0;
    this.prevHand1Pos = { x: hand1Data.centroid.x, y: hand1Data.centroid.y, time: now };

    // Process Hand 2 if detected
    let hand2Data: SingleHandData | null = null;
    let dH2_x = 0;
    let dH2_y = 0;
    let combinedLandmarks = [...this.smoothedLandmarks1];

    if (hand2Raw) {
      this.smoothedLandmarks2 = this.smoothLandmarks(1, hand2Raw, tSec);
      hand2Data = this.stabilizePose(1, this.analyzeSingleHand(this.smoothedLandmarks2, this.prevPinchDist2, 1));
      dH2_x = this.prevHand2Pos ? deadzone(hand2Data.centroid.x - this.prevHand2Pos.x) : 0;
      dH2_y = this.prevHand2Pos ? deadzone(hand2Data.centroid.y - this.prevHand2Pos.y) : 0;
      this.prevHand2Pos = { x: hand2Data.centroid.x, y: hand2Data.centroid.y, time: now };
      combinedLandmarks = [...this.smoothedLandmarks1, ...this.smoothedLandmarks2];
    } else {
      this.smoothedLandmarks2 = [];
      this.prevHand2Pos = null;
      this.filters[1] = [];
      this.fingerState[1] = [];
    }

    // 2. 2D / 3D Laser Pointer Cursor: check if EITHER hand is pointing (INDEX_1 or _isPoint)
    const pointingHand =
      hand1Data.gesture === 'INDEX_1' ? hand1Data : hand2Data?.gesture === 'INDEX_1' ? hand2Data : null;

    if (pointingHand) {
      useRigStore.getState().setPointerCursor({
        x: pointingHand.indexTip.x,
        y: pointingHand.indexTip.y,
        active: true,
      });
    } else {
      useRigStore.getState().setPointerCursor({ x: 0.5, y: 0.5, active: false });
    }

    let gesture: RecognizedGesture = null;
    const confidence = 0.95;
    let activeMode: GestureTrackingResult['activeMode'] = 'IDLE';
    let deltaX = 0;
    let deltaY = 0;
    let zoomDelta = 0;
    let currentDistance = 0;
    let midX = hand1Data.centroid.x;
    let midY = hand1Data.centroid.y;

    // 3. TWO HANDS: stretch apart / together = zoom, move together = rotate, two fists = exploded view
    if (handsCount >= 2 && hand2Data) {
      midX = (hand1Data.centroid.x + hand2Data.centroid.x) / 2.0;
      midY = (hand1Data.centroid.y + hand2Data.centroid.y) / 2.0;
      currentDistance = Math.hypot(
        hand2Data.centroid.x - hand1Data.centroid.x,
        hand2Data.centroid.y - hand1Data.centroid.y
      );
      const spread = this.prevDistance === null ? 0 : currentDistance - this.prevDistance;
      this.prevDistance = currentDistance;

      const bothOpen = hand1Data.gesture === 'PALM' && hand2Data.gesture === 'PALM';
      const bothFists = hand1Data.gesture === 'FIST' && hand2Data.gesture === 'FIST';
      const moving = Math.hypot(dH1_x + dH2_x, dH1_y + dH2_y) / 2 > STILL_SPEED * 0.5;

      if (bothFists) {
        gesture = 'MERGE';
        activeMode = 'MERGE';
      } else if (bothOpen && Math.abs(spread) > ZOOM_DEADZONE) {
        // Hands moving apart -> zoom in, together -> zoom out
        zoomDelta = spread * ZOOM_GAIN;
        gesture = 'ZOOM';
        activeMode = 'ZOOM';
      } else if (bothOpen && moving) {
        // Both palms moving together -> orbit
        deltaX = (dH1_x + dH2_x) / 2.0;
        deltaY = (dH1_y + dH2_y) / 2.0;
        gesture = 'MOVE';
        activeMode = 'ORBIT';
      } else {
        gesture = bothOpen ? 'PALM' : null;
        activeMode = 'IDLE';
      }
    }
    // 4. SINGLE HAND INTERACTION (either hand)
    else {
      this.prevDistance = null;
      const pose = hand1Data.gesture;

      if (pose === 'PALM') {
        // Open palm: moving -> orbit, still -> freeze with zero drift
        if (Math.hypot(dH1_x, dH1_y) > STILL_SPEED * 0.4) {
          gesture = 'MOVE';
          activeMode = 'ORBIT';
          deltaX = dH1_x;
          deltaY = dH1_y;
        } else {
          gesture = 'PALM';
          activeMode = 'IDLE';
        }
      } else if (pose === 'FIST' || pose === 'THUMB_UP' || pose === 'THUMB_DOWN') {
        gesture = pose;
        activeMode = 'IDLE';
      } else if (pose) {
        gesture = pose; // INDEX_1 (pointer) .. INDEX_5
        activeMode = 'INDEX_SELECT';
      }
    }
    // Hand stillness drives hold-to-select (count gestures fire only on a steady hand)
    this.handIsStill = Math.hypot(dH1_x, dH1_y) < STILL_SPEED;

    const result: GestureTrackingResult = {
      gesture,
      confidence,
      handsCount,
      handX: midX,
      handY: midY,
      handDistance: currentDistance,
      deltaX,
      deltaY,
      zoomDelta,
      isTwoHanded: handsCount >= 2,
      isPinching: false,
      fingerCount: hand1Data.fingerCount + (hand2Data?.fingerCount ?? 0),
      primaryHand: hand1Data,
      secondaryHand: hand2Data,
      landmarks: combinedLandmarks,
      activeMode,
    };

    this.lastTrackingResult = result;

    // Synchronize spatial deltas to Zustand store for 3D CameraRig
    useRigStore.getState().setGestureSpatial({
      deltaX,
      deltaY,
      zoomDelta,
      distance: currentDistance,
      handsCount,
      primaryHand: {
        x: hand1Data.centroid.x,
        y: hand1Data.centroid.y,
        fingerCount: hand1Data.fingerCount,
        isPinching: false,
        pinchDist: 1.0,
        role: activeMode === 'ORBIT' ? 'ORBIT' : activeMode === 'ZOOM' ? 'ZOOM' : 'IDLE',
      },
      secondaryHand: hand2Data
        ? {
            x: hand2Data.centroid.x,
            y: hand2Data.centroid.y,
            fingerCount: hand2Data.fingerCount,
            isPinching: false,
            pinchDist: 1.0,
            role: activeMode === 'ORBIT' ? 'ORBIT' : activeMode === 'ZOOM' ? 'ZOOM' : 'IDLE',
          }
        : null,
      activeMode,
    });

    if (this.lastReportedGesture !== gesture) {
      this.lastReportedGesture = gesture;
      useRigStore.getState().setGestureDetected(gesture, confidence);
    }

    this.handleGestureAction(result);
  };
  private extractLandmarks(landmarks: any[]): HandLandmark[] {
    const typeMap: { [k: number]: HandLandmark['type'] } = {
      0: 'wrist',
      4: 'thumb',
      8: 'index',
      12: 'middle',
      16: 'ring',
      20: 'pinky',
      9: 'palm',
    };
    return landmarks.map((lm: any, idx: number) => ({
      x: 1.0 - lm.x, // Mirrored for natural intuitive control
      y: lm.y,
      z: lm.z || 0,
      type: typeMap[idx] || undefined,
    }));
  }

  /** One Euro filtering of every landmark coordinate for one hand slot */
  private smoothLandmarks(slot: 0 | 1, current: HandLandmark[], tSec: number): HandLandmark[] {
    const f = this.filters[slot];
    if (f.length !== current.length * 3) {
      this.filters[slot] = current.flatMap(() => [new OneEuro(), new OneEuro(), new OneEuro(1.0, 4)]);
    }
    const fs = this.filters[slot];
    return current.map((p, i) => ({
      ...p,
      x: fs[i * 3].filter(p.x, tSec),
      y: fs[i * 3 + 1].filter(p.y, tSec),
      z: fs[i * 3 + 2].filter(p.z || 0, tSec),
    }));
  }

  /**
   * @param slot hand slot for finger hysteresis (a finger needs a clearly different pose to
   *             change state, so borderline fingers stop flickering); -1 = no memory
   */
  private analyzeSingleHand(
    landmarks: HandLandmark[],
    prevPinchDist: number | null,
    slot: -1 | 0 | 1 = -1
  ): SingleHandData {
    if (landmarks.length < 21) {
      return {
        landmarks,
        wrist: { x: 0.5, y: 0.5 },
        thumbTip: { x: 0.5, y: 0.5 },
        indexTip: { x: 0.5, y: 0.5 },
        centroid: { x: landmarks[0]?.x || 0.5, y: landmarks[0]?.y || 0.5 },
        fingerCount: 0,
        isPinching: false,
        pinchDist: 1.0,
        pinchDelta: 0,
        isFist: true,
        gesture: 'FIST',
        role: 'IDLE',
      };
    }

    const wrist = landmarks[0];
    const thumbIp = landmarks[3];
    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    const indexTip = landmarks[8];
    const middleMcp = landmarks[9];
    const pinkyMcp = landmarks[17];

    const dist = (a: HandLandmark, b: HandLandmark) =>
      Math.hypot(a.x - b.x, a.y - b.y, ((a.z || 0) - (b.z || 0)) * 0.5);

    // Scale-invariant reference: palm length (wrist -> middle MCP)
    const palm = Math.max(dist(wrist, middleMcp), 1e-4);

    /**
     * A finger is extended when it is straight (MCP->PIP and PIP->TIP point the same way)
     * AND its tip is clearly farther from the wrist than its PIP joint. Using both cues
     * works for hands pointing toward the camera, where 2D lengths alone collapse.
     */
    const memory = slot >= 0 ? this.fingerState[slot] : [];
    // Hysteresis: an extended finger stays extended until clearly curled, and vice versa
    const keep = (i: number, extendNow: boolean, stillExtended: boolean) => {
      const was = memory[i];
      const v = was === undefined ? extendNow : was ? stillExtended : extendNow;
      if (slot >= 0) memory[i] = v;
      return v;
    };
    const fingerExtended = (i: number, mcpI: number, pipI: number, tipI: number) => {
      const mcp = landmarks[mcpI];
      const pip = landmarks[pipI];
      const tip = landmarks[tipI];
      const ax = pip.x - mcp.x, ay = pip.y - mcp.y;
      const bx = tip.x - pip.x, by = tip.y - pip.y;
      const la = Math.hypot(ax, ay) || 1e-6;
      const lb = Math.hypot(bx, by) || 1e-6;
      const straightness = (ax * bx + ay * by) / (la * lb);
      const reach = dist(wrist, tip) - dist(wrist, pip);
      return keep(i, straightness > 0.62 && reach > palm * 0.15, straightness > 0.45 && reach > palm * 0.08);
    };

    const isIndexExtended = fingerExtended(1, 5, 6, 8);
    const isMiddleExtended = fingerExtended(2, 9, 10, 12);
    const isRingExtended = fingerExtended(3, 13, 14, 16);
    const isPinkyExtended = fingerExtended(4, 17, 18, 20);
    // Thumb: tip well away from the index knuckle and from the palm's pinky side
    const thumbAway = dist(thumbTip, indexMcp);
    const thumbOut = dist(thumbTip, pinkyMcp) / Math.max(dist(thumbIp, pinkyMcp), 1e-6);
    const isThumbExtended = keep(0, thumbAway > palm * 0.6 && thumbOut > 1.12, thumbAway > palm * 0.48 && thumbOut > 1.05);

    const fingerCount =
      Number(isThumbExtended) +
      Number(isIndexExtended) +
      Number(isMiddleExtended) +
      Number(isRingExtended) +
      Number(isPinkyExtended);

    const isFist = !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended;
    const isPoint = isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended;
    const fourUp = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended;
    const isShaka = isThumbExtended && isPinkyExtended && !isIndexExtended && !isMiddleExtended && !isRingExtended;

    // Thumb up / down: other fingers curled, thumb clearly vertical and long (a fist's
    // thumb lies across the fingers, so it is neither vertical nor long)
    const thumbMcp = landmarks[2];
    const tdx = thumbTip.x - thumbMcp.x;
    const tdy = thumbTip.y - thumbMcp.y;
    const thumbVertical = isFist && Math.abs(tdy) > Math.abs(tdx) * 1.5 && Math.abs(tdy) > palm * 0.45;

    // Unambiguous pose vocabulary:
    //  FIST, THUMB_UP, THUMB_DOWN, INDEX_1 (point), INDEX_2 (V), INDEX_3 (three),
    //  INDEX_4 (four, thumb tucked), INDEX_5 (shaka: thumb + pinky), PALM (all five open)
    let gesture: RecognizedGesture;
    if (isShaka) gesture = 'INDEX_5';
    else if (thumbVertical) gesture = tdy < 0 ? 'THUMB_UP' : 'THUMB_DOWN';
    else if (isFist) gesture = 'FIST';
    else if (isPoint) gesture = 'INDEX_1';
    else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) gesture = 'INDEX_2';
    else if (isIndexExtended && isMiddleExtended && isRingExtended && !isPinkyExtended) gesture = 'INDEX_3';
    else if (fourUp && !isThumbExtended) gesture = 'INDEX_4';
    else if (fourUp) gesture = 'PALM';
    else gesture = null; // in-between pose: report nothing rather than guess

    return {
      landmarks,
      wrist,
      thumbTip,
      indexTip,
      centroid: { x: (wrist.x + middleMcp.x) / 2, y: (wrist.y + middleMcp.y) / 2 },
      fingerCount,
      isPinching: false,
      pinchDist: 1.0,
      pinchDelta: 0,
      isFist,
      gesture,
      role: 'IDLE',
      _isPoint: isPoint,
    } as SingleHandData & { _isPoint: boolean };
  }

  /**
   * Discrete actions. Nothing opens by itself: a finger count only SELECTS a part, and a
   * fist OPENS the selection. Thumb up/down steps through the view layers, and two fists
   * toggle the exploded view.
   */
  private handleGestureAction(res: GestureTrackingResult): void {
    const store = useRigStore.getState();
    const now = performance.now();
    const g = res.gesture;
    const held = g === this.sustainedGesture;
    if (!held) {
      this.sustainedGesture = g;
      this.sustainedGestureStartTime = now;
      this.lastSliceTime = 0; // a new pose may step a layer right after its hold time
    }
    const heldFor = now - this.sustainedGestureStartTime;

    // Selections expire if no fist follows
    const sel = store.gestureSelection;
    if (sel && Date.now() - sel.at > SELECTION_TTL_MS) store.setGestureSelection(null);

    // Two fists: toggle exploded view
    if (g === 'MERGE') {
      if (heldFor > 400 && now - this.lastMergeTime > 2000) {
        this.lastMergeTime = now;
        store.setSplitViewActive(!store.isSplitViewActive);
      }
      return;
    }

    // Thumb up / down: one layer per step, repeating while held
    if (g === 'THUMB_UP' || g === 'THUMB_DOWN') {
      if (heldFor > THUMB_HOLD_MS && now - this.lastSliceTime > THUMB_REPEAT_MS) {
        this.lastSliceTime = now;
        store.stepLayer(g === 'THUMB_UP' ? -1 : 1);
      }
      return;
    }

    // Fist: open the current selection (a fresh fist only, so holding one does not repeat)
    if (g === 'FIST') {
      const cur = useRigStore.getState().gestureSelection;
      if (!held && cur && now - this.lastIndexTriggerTime > 800) {
        this.lastIndexTriggerTime = now;
        store.setGestureSelection(null);
        if (cur.targetPart) {
          store.openHoloModal(cur.targetPart);
          store.setCameraViewMode(cur.targetPart as CameraViewMode);
        } else {
          store.openSubsystemByIndex(cur.index);
        }
      }
      return;
    }

    // 1-5 fingers held on a steady hand: select (one finger picks the part under the pointer, if any)
    if (g && g.startsWith('INDEX_') && this.handIsStill && heldFor > INDEX_HOLD_MS) {
      const index = Number(g.slice(6));
      const targetPart = index === 1 ? store.targetedPartId : null;
      const label = targetPart ? targetPart.replace(/_/g, ' ') : GESTURE_PARTS[index]?.label;
      const prev = useRigStore.getState().gestureSelection;
      if (label && (!prev || prev.index !== index || prev.targetPart !== targetPart)) {
        store.setGestureSelection({ index, label, targetPart, at: Date.now() });
        import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => varunaVoice.playWakeChime());
      } else if (prev) {
        store.setGestureSelection({ ...prev, at: Date.now() }); // keep it alive while held
      }
    }
  }
  /** Reports a pose only after it has been seen POSE_STABLE_FRAMES frames in a row. */
  private stabilizePose(slot: 0 | 1, hand: SingleHandData): SingleHandData {
    const history = this.poseHistory[slot];
    history.push(hand.gesture);
    if (history.length > POSE_STABLE_FRAMES) history.shift();
    const stable = history.length === POSE_STABLE_FRAMES && history.every((g) => g === history[0]);
    if (stable) this.stablePoses[slot] = history[0];
    const gesture = this.stablePoses[slot];
    return { ...hand, gesture, isFist: gesture === 'FIST' };
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      if (this.videoElement.parentNode) {
        this.videoElement.parentNode.removeChild(this.videoElement);
      }
      this.videoElement = null;
    }

    this.lastReportedGesture = null;
    this.lastTrackingResult = {
      gesture: null,
      confidence: 0,
      handsCount: 0,
      handX: 0.5,
      handY: 0.5,
      handDistance: 0,
      deltaX: 0,
      deltaY: 0,
      zoomDelta: 0,
      isTwoHanded: false,
      isPinching: false,
      fingerCount: 0,
      primaryHand: null,
      secondaryHand: null,
      landmarks: [],
      activeMode: 'IDLE',
    };

    const store = useRigStore.getState();
    store.setGestureCameraActive(false);
    store.setCameraPermissionState('idle');
    store.setGestureDetected(null, 0);
    store.setGestureSpatial({
      deltaX: 0,
      deltaY: 0,
      zoomDelta: 0,
      distance: 0,
      handsCount: 0,
      primaryHand: null,
      secondaryHand: null,
      activeMode: 'IDLE',
    });
  }

  /** Viewfinder hook: called every video frame with the latest tracking result. */
  public registerFrameCallback(
    cb: (result: GestureTrackingResult, video: HTMLVideoElement) => void
  ): () => void {
    this.onFrameCallbacks.add(cb);
    return () => {
      this.onFrameCallbacks.delete(cb);
    };
  }

  private processLoop = (): void => {
    if (!this.isRunning || !this.videoElement || !this.ctx || !this.canvasElement) return;

    const now = performance.now();

    if (this.videoElement.readyState >= 2) {
      this.onFrameCallbacks.forEach((cb) => cb(this.lastTrackingResult, this.videoElement!));

      if (now - this.lastProcessTime >= 33) {
        this.lastProcessTime = now;

        if (this.mediaPipeHands && !this.isProcessingMediaPipe) {
          this.isProcessingMediaPipe = true;
          this.mediaPipeHands
            .send({ image: this.videoElement })
            .catch((err: any) => {
              console.warn('MediaPipe send error:', err);
            })
            .finally(() => {
              this.isProcessingMediaPipe = false;
            });
        }
      }
    }

    this.animFrameId = requestAnimationFrame(this.processLoop);
  };
}

export const varunaGestureEngine = new VarunaGestureEngine();
