/**
 * JARVIS / VARUNA-AI Computer Vision Hand Gesture Recognition Engine
 * Real-Time Webcam & Complete Jarvis Decoupled Dual-Hand Spatial Holographic Matrix:
 *
 * 1. ASYMMETRIC DECOUPLED DUAL-HAND INTERACTION (Full Jarvis Copy):
 *    - Hand 1 (Zoom Controller): Operates continuous smooth ZOOM (Pinch In -> Zoom Out, Pinch Out -> Zoom In).
 *    - Hand 2 (Orbit Controller): Operates continuous smooth 3D MODEL MOVE & ORBIT (Translating in (x,y)).
 *    - Simultaneous, zero-drift, instant freeze in place when motion stops or palm is opened.
 *
 * 2. 3D FINGER LASER TARGETING & RIGHT-TO-LEFT SWIPE INSPECTION:
 *    - Pointing finger projects a 3D holographic laser targeting reticle onto subsea & topside components.
 *    - Swiping finger/hand rapidly from Right to Left instantly opens the targeted part's dedicated inspection view!
 *
 * 3. THE 6 CORE RECOGNIZABLE & TRACKABLE GESTURES:
 *    - 1. SPLIT VIEW (Two hands spreading outward / open palm spread -> Exploded Rig view)
 *    - 2. MERGE / JOIN (Fists / Hands together -> Solid Rig reassembly)
 *    - 3. MOVE / ORBIT / PAN (Continuous hand translation -> 3D model rotation & pan)
 *    - 4. ZOOM IN (Pinch out / Hands moving apart -> Dolly camera in)
 *    - 5. ZOOM OUT (Pinch in / Hands moving closer -> Dolly camera out)
 *    - 6. SUBSYSTEM INDEX SELECTOR (Finger count 1-5 -> Helipad, Crane 1, Crane 2, Command Dock, Accommodation)
 *    - BONUS: SWIPE LEFT (Right to Left swipe -> Open targeted subsystem view)
 */

import { useRigStore, RecognizedGesture } from '../store/useRigStore';

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

/** Frames a raw pose must persist before it is reported (debounces flicker at ~30 fps). */
const POSE_STABLE_FRAMES = 4;
/** Hold time for count gestures (2-4 fingers, shaka) before a subsystem opens. */
const INDEX_HOLD_MS = 700;
/** Pointer dwell time on a targeted part before it opens. */
const POINTER_DWELL_MS = 1100;
/** Centroid speed (screen widths / frame) below which a hand counts as still. */
const STILL_SPEED = 0.006;

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
    | 'JARVIS_DECOUPLED_DUAL'
    | 'DUAL_MOVE_ZOOM'
    | 'ORBIT'
    | 'ZOOM'
    | 'SPLIT'
    | 'MERGE'
    | 'INDEX_SELECT'
    | 'IDLE';
}

class JarvisGestureVisionEngine {
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
  private prevMidpoint: { x: number; y: number; time: number } | null = null;
  private prevDistance: number | null = null;

  // Sustained gesture stability & cooldowns
  private sustainedGesture: RecognizedGesture = null;
  private sustainedGestureStartTime = 0;
  private lastSplitTime = 0;
  private lastMergeTime = 0;
  private lastSliceTime = 0;
  private lastSwipeLeftTime = 0;
  private lastIndexTriggerTime = 0;
  private prevHandsCount = 0;
  /** Recent raw poses per hand slot, for frame-voting */
  private poseHistory: RecognizedGesture[][] = [[], []];
  /** Recent single-hand centroid samples, for swipe detection */
  private motionHistory: { x: number; y: number; t: number }[] = [];
  private pointerDwellTarget: string | null = null;
  private pointerDwellStart = 0;
  private handIsStill = false;
  private stablePoses: RecognizedGesture[] = [null, null];

  // Viewfinder callbacks
  private onFrameCallbacks: Set<(result: GestureTrackingResult, video: HTMLVideoElement) => void> = new Set();

  // Synthetic / Demo simulator state
  private isSynthetic = false;
  private syntheticTime = 0;
  private syntheticCanvas: HTMLCanvasElement | null = null;
  private syntheticCtx: CanvasRenderingContext2D | null = null;

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
    if (this.isRunning && (this.stream?.active || this.isSynthetic)) return true;

    const store = useRigStore.getState();
    store.setCameraPermissionState('requesting');
    store.setCameraErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'MediaDevices API not supported in this browser context. Please access via http://localhost:1420 or HTTPS.'
        );
      }

      this.isSynthetic = false;
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
      store.setSyntheticCameraActive(false);
      store.setCameraPermissionState('active');
      store.setCameraErrorMessage(null);

      this.processLoop();
      return true;
    } catch (err: unknown) {
      console.error('Failed to initialize Jarvis Vision Camera:', err);
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
   * MediaPipe Multi-Hand Pipeline: Decoupled Jarvis Dual-Hand Tracking & Instant Freeze
   */
  private handleMediaPipeResults = (results: any): void => {
    if (!this.isRunning || !results) return;

    const multiHandLandmarks = results.multiHandLandmarks || [];
    const handsCount = multiHandLandmarks.length;

    if (handsCount === 0) {
      this.prevHandsCount = 0;
      this.prevHand1Pos = null;
      this.prevHand2Pos = null;
      this.prevPinchDist1 = null;
      this.prevPinchDist2 = null;
      this.prevMidpoint = null;
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
      this.motionHistory = [];
    }

    // Process Hand 1
    this.smoothedLandmarks1 = this.smoothLandmarks(this.smoothedLandmarks1, hand1Raw);
    const hand1Data = this.stabilizePose(0, this.analyzeSingleHand(this.smoothedLandmarks1, this.prevPinchDist1));
    const dH1_x = this.prevHand1Pos ? hand1Data.centroid.x - this.prevHand1Pos.x : 0;
    const dH1_y = this.prevHand1Pos ? hand1Data.centroid.y - this.prevHand1Pos.y : 0;
    this.prevHand1Pos = { x: hand1Data.centroid.x, y: hand1Data.centroid.y, time: now };

    // Process Hand 2 if detected
    let hand2Data: SingleHandData | null = null;
    let dH2_x = 0;
    let dH2_y = 0;
    let combinedLandmarks = [...this.smoothedLandmarks1];

    if (hand2Raw) {
      this.smoothedLandmarks2 = this.smoothLandmarks(this.smoothedLandmarks2, hand2Raw);
      hand2Data = this.stabilizePose(1, this.analyzeSingleHand(this.smoothedLandmarks2, this.prevPinchDist2));
      dH2_x = this.prevHand2Pos ? hand2Data.centroid.x - this.prevHand2Pos.x : 0;
      dH2_y = this.prevHand2Pos ? hand2Data.centroid.y - this.prevHand2Pos.y : 0;
      this.prevHand2Pos = { x: hand2Data.centroid.x, y: hand2Data.centroid.y, time: now };
      combinedLandmarks = [...this.smoothedLandmarks1, ...this.smoothedLandmarks2];
    } else {
      this.smoothedLandmarks2 = [];
      this.prevHand2Pos = null;
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
    let confidence = 0.95;
    let activeMode: GestureTrackingResult['activeMode'] = 'IDLE';
    let deltaX = 0;
    let deltaY = 0;
    const zoomDelta = 0; // ZERO ZOOM: completely disabled for now as requested
    let currentDistance = 0;
    let midX = hand1Data.centroid.x;
    let midY = hand1Data.centroid.y;

    // Swipe = open-hand or point moving fast and mostly horizontally right-to-left
    // (on screen) over the last ~350 ms. Requires real travel, not a single noisy frame.
    let isSwipeLeft = false;
    if (handsCount === 1 && (hand1Data.gesture === 'PALM' || hand1Data.gesture === 'INDEX_1')) {
      this.motionHistory.push({ x: hand1Data.centroid.x, y: hand1Data.centroid.y, t: now });
      while (this.motionHistory.length && now - this.motionHistory[0].t > 350) this.motionHistory.shift();
      const first = this.motionHistory[0];
      const dx = hand1Data.centroid.x - first.x;
      const dy = hand1Data.centroid.y - first.y;
      isSwipeLeft =
        this.motionHistory.length >= 5 && dx < -0.22 && Math.abs(dy) < Math.abs(dx) * 0.5 && now - this.lastSwipeLeftTime > 1500;
    } else {
      this.motionHistory = [];
    }

    if (isSwipeLeft) {
      gesture = 'SWIPE_LEFT';
      activeMode = 'INDEX_SELECT';
      this.lastSwipeLeftTime = now;
      this.motionHistory = [];
    }
    // 3. DUAL-HAND INTERACTION
    else if (handsCount >= 2 && hand2Data) {
      midX = (hand1Data.centroid.x + hand2Data.centroid.x) / 2.0;
      midY = (hand1Data.centroid.y + hand2Data.centroid.y) / 2.0;
      currentDistance = Math.hypot(
        hand2Data.centroid.x - hand1Data.centroid.x,
        hand2Data.centroid.y - hand1Data.centroid.y
      );
      this.prevDistance = currentDistance;
      this.prevMidpoint = { x: midX, y: midY, time: now };

      const bothOpen = hand1Data.gesture === 'PALM' && hand2Data.gesture === 'PALM';
      const bothFists = hand1Data.gesture === 'FIST' && hand2Data.gesture === 'FIST';
      const moving = Math.hypot(dH1_x + dH2_x, dH1_y + dH2_y) / 2 > STILL_SPEED * 0.5;

      if (bothFists || (currentDistance < 0.14 && !bothOpen)) {
        // MERGE: two fists, or hands brought together
        gesture = 'MERGE';
        activeMode = 'MERGE';
      } else if (bothOpen && currentDistance > 0.55) {
        // SPLIT: two open palms spread wide apart
        gesture = 'SPLIT';
        activeMode = 'SPLIT';
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
      } else if (pose === 'FIST') {
        gesture = 'FIST';
        activeMode = 'MERGE';
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
      zoomDelta: 0,
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
      zoomDelta: 0,
      distance: currentDistance,
      handsCount,
      primaryHand: {
        x: hand1Data.centroid.x,
        y: hand1Data.centroid.y,
        fingerCount: hand1Data.fingerCount,
        isPinching: false,
        pinchDist: 1.0,
        role: activeMode === 'ORBIT' ? 'ORBIT' : 'IDLE',
      },
      secondaryHand: hand2Data
        ? {
            x: hand2Data.centroid.x,
            y: hand2Data.centroid.y,
            fingerCount: hand2Data.fingerCount,
            isPinching: false,
            pinchDist: 1.0,
            role: activeMode === 'ORBIT' ? 'ORBIT' : 'IDLE',
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

  private smoothLandmarks(prev: HandLandmark[], current: HandLandmark[]): HandLandmark[] {
    if (prev.length !== current.length) return current;
    const alpha = 0.68;
    return prev.map((p, i) => ({
      ...p,
      x: p.x * (1 - alpha) + current[i].x * alpha,
      y: p.y * (1 - alpha) + current[i].y * alpha,
      z: (p.z || 0) * (1 - alpha) + (current[i].z || 0) * alpha,
    }));
  }

  private analyzeSingleHand(
    landmarks: HandLandmark[],
    prevPinchDist: number | null
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
    const fingerExtended = (mcpI: number, pipI: number, tipI: number) => {
      const mcp = landmarks[mcpI];
      const pip = landmarks[pipI];
      const tip = landmarks[tipI];
      const ax = pip.x - mcp.x, ay = pip.y - mcp.y;
      const bx = tip.x - pip.x, by = tip.y - pip.y;
      const la = Math.hypot(ax, ay) || 1e-6;
      const lb = Math.hypot(bx, by) || 1e-6;
      const straightness = (ax * bx + ay * by) / (la * lb);
      const reach = dist(wrist, tip) - dist(wrist, pip);
      return straightness > 0.55 && reach > palm * 0.12;
    };

    const isIndexExtended = fingerExtended(5, 6, 8);
    const isMiddleExtended = fingerExtended(9, 10, 12);
    const isRingExtended = fingerExtended(13, 14, 16);
    const isPinkyExtended = fingerExtended(17, 18, 20);
    // Thumb: tip well away from the index knuckle and from the palm's pinky side
    const isThumbExtended =
      dist(thumbTip, indexMcp) > palm * 0.55 && dist(thumbTip, pinkyMcp) > dist(thumbIp, pinkyMcp) * 1.1;

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

    // Unambiguous pose vocabulary:
    //  FIST, INDEX_1 (point / laser), INDEX_2 (V), INDEX_3 (three), INDEX_4 (four, thumb tucked),
    //  INDEX_5 (shaka: thumb + pinky), PALM (all five open)
    let gesture: RecognizedGesture;
    if (isShaka) gesture = 'INDEX_5';
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

  private handleGestureAction(res: GestureTrackingResult): void {
    const store = useRigStore.getState();
    const now = performance.now();

    // 1. SWIPE LEFT (Right to Left horizontal swipe -> Opens targeted or next subsystem view)
    if (res.gesture === 'SWIPE_LEFT' && now - this.lastSwipeLeftTime < 400) {
      store.openNextSubsystemView();
      return;
    }

    // 2. Gesture 1: SPLIT VIEW
    if (res.gesture === 'SPLIT' && !store.isSplitViewActive && now - this.lastSplitTime > 2200) {
      this.lastSplitTime = now;
      store.setSplitViewActive(true);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom('Split gesture recognized. Exploding digital twin into subsystem modules.');
      });
      return;
    }

    // 3. Gesture 2: MERGE / REASSEMBLE
    if (
      (res.gesture === 'MERGE' || res.gesture === 'FIST') &&
      store.isSplitViewActive &&
      now - this.lastMergeTime > 2000
    ) {
      this.lastMergeTime = now;
      store.setSplitViewActive(false);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom('Merge gesture recognized. Reassembling digital twin.');
      });
      return;
    }

    // 4. POINTER DWELL: hold the laser on a part to open it (no part -> helipad shortcut)
    if (res.gesture === 'INDEX_1') {
      const target = store.targetedPartId;
      if (target !== this.pointerDwellTarget || this.sustainedGesture !== 'INDEX_1') {
        this.pointerDwellTarget = target;
        this.pointerDwellStart = now;
      }
      this.sustainedGesture = 'INDEX_1';
      const needed = target ? POINTER_DWELL_MS : POINTER_DWELL_MS + 500;
      if (now - this.pointerDwellStart > needed && now - this.lastIndexTriggerTime > 2500 && (target || this.handIsStill)) {
        this.lastIndexTriggerTime = now;
        this.pointerDwellStart = now;
        if (target) store.openNextSubsystemView();
        else store.openSubsystemByIndex(1);
      }
      return;
    }

    // 5. SUBSYSTEM SHORTCUTS: hold a count pose steadily (2 = crane 1, 3 = crane 2, 4 = dock, shaka = quarters)
    if (res.gesture && res.gesture.startsWith('INDEX_')) {
      if (this.sustainedGesture !== res.gesture || !this.handIsStill) {
        this.sustainedGesture = res.gesture;
        this.sustainedGestureStartTime = now;
      } else if (now - this.sustainedGestureStartTime > INDEX_HOLD_MS && now - this.lastIndexTriggerTime > 2500) {
        this.lastIndexTriggerTime = now;
        const indexNum = parseInt(res.gesture.replace('INDEX_', ''), 10);
        if (indexNum >= 2 && indexNum <= 5) store.openSubsystemByIndex(indexNum);
      }
    } else {
      this.sustainedGesture = null;
      this.pointerDwellTarget = null;
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

  public startSynthetic(): boolean {
    this.stop();
    this.isSynthetic = true;
    this.isRunning = true;

    if (!this.syntheticCanvas) {
      this.syntheticCanvas = document.createElement('canvas');
      this.syntheticCanvas.width = 280;
      this.syntheticCanvas.height = 160;
      this.syntheticCtx = this.syntheticCanvas.getContext('2d');
    }

    const store = useRigStore.getState();
    store.setGestureCameraActive(true);
    store.setSyntheticCameraActive(true);
    store.setCameraPermissionState('active');
    store.setCameraErrorMessage(null);

    this.processSyntheticLoop();
    return true;
  }

  public stop(): void {
    this.isRunning = false;
    this.isSynthetic = false;
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
    store.setSyntheticCameraActive(false);
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

  /**
   * Complete Synthetic Decoupled Jarvis Dual-Hand Simulator Loop
   */
  private processSyntheticLoop = (): void => {
    if (!this.isRunning || !this.isSynthetic || !this.syntheticCanvas || !this.syntheticCtx) return;

    this.syntheticTime += 0.025;
    const t = this.syntheticTime;
    const w = this.syntheticCanvas.width;
    const h = this.syntheticCanvas.height;
    const ctx = this.syntheticCtx;

    ctx.fillStyle = '#06101e';
    ctx.fillRect(0, 0, w, h);

    // Cyberpunk grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // HAND 1 (LEFT): Pointing index finger (Laser pointer & Index 1 Helipad)
    const h1x = 0.28 + Math.sin(t * 0.5) * 0.08;
    const h1y = 0.45 + Math.cos(t * 0.4) * 0.06;

    // HAND 2 (RIGHT): Moving in (x,y) -> Move / Orbit model
    const h2x = 0.72 + Math.sin(t * 0.8) * 0.12;
    const h2y = 0.5 + Math.cos(t * 0.6) * 0.09;
    const deltaX = Math.cos(t * 0.8) * 0.007;
    const deltaY = -Math.sin(t * 0.6) * 0.005;

    const currentDist = Math.hypot(h2x - h1x, h2y - h1y);
    const gesture: RecognizedGesture = 'MOVE';
    const activeMode: GestureTrackingResult['activeMode'] = 'ORBIT';

    // Broadcast Laser Pointer Cursor from Hand 1
    useRigStore.getState().setPointerCursor({
      x: h1x,
      y: h1y - 0.2,
      active: true,
    });

    // Left hand landmarks (pointing index)
    const landmarks1: HandLandmark[] = [
      { x: h1x, y: h1y + 0.16, type: 'wrist' },
      { x: h1x, y: h1y, type: 'palm' },
      { x: h1x - 0.06, y: h1y + 0.02, type: 'thumb' },
      { x: h1x, y: h1y - 0.22, type: 'index' },
      { x: h1x + 0.03, y: h1y + 0.02, type: 'middle' },
      { x: h1x + 0.06, y: h1y + 0.04, type: 'ring' },
      { x: h1x + 0.09, y: h1y + 0.06, type: 'pinky' },
    ];

    // Right hand landmarks (open palm moving)
    const landmarks2: HandLandmark[] = [
      { x: h2x, y: h2y + 0.18, type: 'wrist' },
      { x: h2x, y: h2y, type: 'palm' },
      { x: h2x - 0.1, y: h2y - 0.08, type: 'thumb' },
      { x: h2x - 0.04, y: h2y - 0.18, type: 'index' },
      { x: h2x, y: h2y - 0.20, type: 'middle' },
      { x: h2x + 0.04, y: h2y - 0.18, type: 'ring' },
      { x: h2x + 0.09, y: h2y - 0.12, type: 'pinky' },
    ];

    const result: GestureTrackingResult = {
      gesture,
      confidence: 0.98,
      handsCount: 2,
      handX: (h1x + h2x) / 2,
      handY: (h1y + h2y) / 2,
      handDistance: currentDist,
      deltaX,
      deltaY,
      zoomDelta: 0,
      isTwoHanded: true,
      isPinching: false,
      fingerCount: 6,
      primaryHand: {
        landmarks: landmarks1,
        wrist: landmarks1[0],
        thumbTip: landmarks1[2],
        indexTip: landmarks1[3],
        centroid: { x: h1x, y: h1y },
        fingerCount: 1,
        isPinching: false,
        pinchDist: 1.0,
        pinchDelta: 0,
        isFist: false,
        gesture: 'INDEX_1',
        role: 'IDLE',
      },
      secondaryHand: {
        landmarks: landmarks2,
        wrist: landmarks2[0],
        thumbTip: landmarks2[2],
        indexTip: landmarks2[3],
        centroid: { x: h2x, y: h2y },
        fingerCount: 5,
        isPinching: false,
        pinchDist: 1.0,
        pinchDelta: 0,
        isFist: false,
        gesture: 'MOVE',
        role: 'ORBIT',
      },
      landmarks: [...landmarks1, ...landmarks2],
      activeMode,
    };

    this.lastTrackingResult = result;

    useRigStore.getState().setGestureSpatial({
      deltaX,
      deltaY,
      zoomDelta: 0,
      distance: currentDist,
      handsCount: 2,
      primaryHand: {
        x: h1x,
        y: h1y,
        fingerCount: 1,
        isPinching: false,
        pinchDist: 1.0,
        role: 'IDLE',
      },
      secondaryHand: {
        x: h2x,
        y: h2y,
        fingerCount: 5,
        isPinching: false,
        pinchDist: 1.0,
        role: 'ORBIT',
      },
      activeMode,
    });

    if (this.lastReportedGesture !== result.gesture) {
      this.lastReportedGesture = result.gesture;
      useRigStore.getState().setGestureDetected(result.gesture, result.confidence);
    }
    this.handleGestureAction(result);

    this.onFrameCallbacks.forEach((cb) =>
      cb(result, this.syntheticCanvas as unknown as HTMLVideoElement)
    );

    this.animFrameId = requestAnimationFrame(this.processSyntheticLoop);
  };
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

export const jarvisGestureEngine = new JarvisGestureVisionEngine();
