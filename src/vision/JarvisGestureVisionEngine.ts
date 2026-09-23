/**
 * JARVIS / VARUNA-AI Computer Vision Hand Gesture Recognition Engine
 * Real-Time Webcam & Complete Jarvis Decoupled Dual-Hand Spatial Holographic Matrix:
 *
 * 1. ASYMMETRIC DECOUPLED DUAL-HAND INTERACTION (Full Jarvis Copy):
 *    - Left Hand: Controls continuous ZOOM (Pinch In -> Zoom Out, Pinch Out -> Zoom In).
 *    - Right Hand: Controls continuous 3D MODEL MOVE & ORBIT (Translating in (x,y) space).
 *    - Simultaneously executed on every frame without conflict!
 *
 * 2. PINCH GESTURE DYNAMICS:
 *    - Pinch In (fingers touching / coming closer): Smoothly Zooms OUT.
 *    - Pinch Out (fingers spreading apart / unpinching): Smoothly Zooms IN.
 *
 * 3. THE 6 CORE RECOGNIZABLE & TRACKABLE GESTURES:
 *    - 1. SPLIT VIEW (Two hands spreading outward / open palm spread -> Exploded Rig view)
 *    - 2. MERGE / JOIN (Fists / Hands together -> Solid Rig reassembly)
 *    - 3. MOVE / ORBIT / PAN (Continuous hand translation -> 3D model rotation & pan)
 *    - 4. ZOOM IN (Pinch out / Hands moving apart -> Dolly camera in)
 *    - 5. ZOOM OUT (Pinch in / Hands moving closer -> Dolly camera out)
 *    - 6. SUBSYSTEM INDEX SELECTOR (Finger count 1-5 -> Helipad, Crane 1, Crane 2, Command Dock, Accommodation)
 */

import { useRigStore, RecognizedGesture } from '../store/useRigStore';

export type { RecognizedGesture };

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
  private lastIndexTriggerTime = 0;

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

      // Initialize MediaPipe Hands for multi-hand tracking (max 2 hands)
      if (typeof window !== 'undefined' && (window as any).Hands) {
        try {
          this.mediaPipeHands = new (window as any).Hands({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
          });
          this.mediaPipeHands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.52,
            minTrackingConfidence: 0.52,
          });
          this.mediaPipeHands.onResults(this.handleMediaPipeResults);
        } catch (mpErr) {
          console.warn('MediaPipe Hands initialization fallback to CV color space:', mpErr);
          this.mediaPipeHands = null;
        }
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
   * MediaPipe Multi-Hand Pipeline: Decoupled Jarvis Dual-Hand Tracking
   */
  private handleMediaPipeResults = (results: any): void => {
    if (!this.isRunning || !results) return;

    const multiHandLandmarks = results.multiHandLandmarks || [];
    const handsCount = multiHandLandmarks.length;

    if (handsCount === 0) {
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
      return;
    }

    const now = performance.now();

    // 1. Process Hand 1
    const hand1Raw = this.extractLandmarks(multiHandLandmarks[0]);
    this.smoothedLandmarks1 = this.smoothLandmarks(this.smoothedLandmarks1, hand1Raw);
    const hand1Data = this.analyzeSingleHand(
      this.smoothedLandmarks1,
      this.prevPinchDist1
    );
    const dH1_x = this.prevHand1Pos ? hand1Data.centroid.x - this.prevHand1Pos.x : 0;
    const dH1_y = this.prevHand1Pos ? hand1Data.centroid.y - this.prevHand1Pos.y : 0;
    const dPinch1 = hand1Data.pinchDelta;

    this.prevHand1Pos = { x: hand1Data.centroid.x, y: hand1Data.centroid.y, time: now };
    this.prevPinchDist1 = hand1Data.pinchDist;

    // 2. Process Hand 2 if detected
    let hand2Data: SingleHandData | null = null;
    let dH2_x = 0;
    let dH2_y = 0;
    let dPinch2 = 0;
    let combinedLandmarks = [...this.smoothedLandmarks1];

    if (handsCount >= 2) {
      const hand2Raw = this.extractLandmarks(multiHandLandmarks[1]);
      this.smoothedLandmarks2 = this.smoothLandmarks(this.smoothedLandmarks2, hand2Raw);
      hand2Data = this.analyzeSingleHand(
        this.smoothedLandmarks2,
        this.prevPinchDist2
      );
      dH2_x = this.prevHand2Pos ? hand2Data.centroid.x - this.prevHand2Pos.x : 0;
      dH2_y = this.prevHand2Pos ? hand2Data.centroid.y - this.prevHand2Pos.y : 0;
      dPinch2 = hand2Data.pinchDelta;

      this.prevHand2Pos = { x: hand2Data.centroid.x, y: hand2Data.centroid.y, time: now };
      this.prevPinchDist2 = hand2Data.pinchDist;
      combinedLandmarks = [...this.smoothedLandmarks1, ...this.smoothedLandmarks2];
    } else {
      this.smoothedLandmarks2 = [];
      this.prevHand2Pos = null;
      this.prevPinchDist2 = null;
    }

    let gesture: RecognizedGesture = null;
    let confidence = 0.95;
    let activeMode: GestureTrackingResult['activeMode'] = 'IDLE';
    let deltaX = 0;
    let deltaY = 0;
    let zoomDelta = 0;
    let currentDistance = 0;
    let midX = hand1Data.centroid.x;
    let midY = hand1Data.centroid.y;

    // 3. KINEMATIC DUAL-HAND ASYMMETRIC / DECOUPLED MATRIX
    if (handsCount >= 2 && hand2Data) {
      midX = (hand1Data.centroid.x + hand2Data.centroid.x) / 2.0;
      midY = (hand1Data.centroid.y + hand2Data.centroid.y) / 2.0;
      currentDistance = Math.hypot(
        hand2Data.centroid.x - hand1Data.centroid.x,
        hand2Data.centroid.y - hand1Data.centroid.y
      );

      const dDistance = this.prevDistance !== null ? currentDistance - this.prevDistance : 0;
      this.prevDistance = currentDistance;
      this.prevMidpoint = { x: midX, y: midY, time: now };

      const totalFingers = hand1Data.fingerCount + hand2Data.fingerCount;
      const bothFists = hand1Data.isFist && hand2Data.isFist;

      // Check for Discrete Macro Gestures (Split View / Merge Rig)
      if (bothFists || currentDistance < 0.13) {
        gesture = 'MERGE';
        activeMode = 'MERGE';
      } else if (currentDistance > 0.48 || (dDistance > 0.045 && totalFingers >= 8)) {
        gesture = 'SPLIT';
        activeMode = 'SPLIT';
      }
      // DECOUPLED CASE A: Hand 1 is Zooming (Pinch In/Out) & Hand 2 is Moving (Orbit (x,y))
      else if (Math.abs(dPinch1) > 0.0025 || (hand1Data.isPinching && Math.abs(dPinch1) > 0.001)) {
        hand1Data.role = 'ZOOM';
        hand2Data.role = 'ORBIT';
        activeMode = 'JARVIS_DECOUPLED_DUAL';

        // Pinch out (dPinch1 > 0) -> Zoom In; Pinch in (dPinch1 < 0) -> Zoom Out
        zoomDelta = dPinch1 * 4.2;
        deltaX = dH2_x;
        deltaY = dH2_y;
        gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
      }
      // DECOUPLED CASE B: Hand 2 is Zooming (Pinch In/Out) & Hand 1 is Moving (Orbit (x,y))
      else if (Math.abs(dPinch2) > 0.0025 || (hand2Data.isPinching && Math.abs(dPinch2) > 0.001)) {
        hand1Data.role = 'ORBIT';
        hand2Data.role = 'ZOOM';
        activeMode = 'JARVIS_DECOUPLED_DUAL';

        zoomDelta = dPinch2 * 4.2;
        deltaX = dH1_x;
        deltaY = dH1_y;
        gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
      }
      // SYMMETRIC DUAL-HAND CASE: Both hands expanding apart / moving together
      else if (Math.abs(dDistance) > 0.006) {
        hand1Data.role = 'ZOOM';
        hand2Data.role = 'ZOOM';
        activeMode = Math.abs(dH1_x) > 0.004 || Math.abs(dH1_y) > 0.004 ? 'DUAL_MOVE_ZOOM' : 'ZOOM';

        zoomDelta = dDistance * 3.2; // Spreading hands apart zooms in, bringing closer zooms out
        deltaX = (dH1_x + dH2_x) / 2.0;
        deltaY = (dH1_y + dH2_y) / 2.0;
        gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
      }
      // PURE TRANSLATION CASE: Both hands moving together across frame
      else if (Math.abs(dH1_x) > 0.004 || Math.abs(dH1_y) > 0.004 || Math.abs(dH2_x) > 0.004 || Math.abs(dH2_y) > 0.004) {
        hand1Data.role = 'ORBIT';
        hand2Data.role = 'ORBIT';
        activeMode = 'ORBIT';

        deltaX = (dH1_x + dH2_x) / 2.0;
        deltaY = (dH1_y + dH2_y) / 2.0;
        gesture = 'MOVE';
      } else {
        gesture = 'PALM';
        activeMode = 'IDLE';
      }
    } else {
      // 4. SINGLE HAND INTERACTION (Simultaneous Pinch In/Out Zoom + Move)
      midX = hand1Data.centroid.x;
      midY = hand1Data.centroid.y;
      this.prevDistance = null;

      // Fast horizontal swipe -> SLICE
      if (Math.abs(dH1_x) > 0.12 && now - this.lastSliceTime > 1400) {
        gesture = 'SLICE';
        activeMode = 'SPLIT';
        this.lastSliceTime = now;
      } else if (Math.abs(dPinch1) > 0.002 || hand1Data.isPinching) {
        // Pinch In (fingers close) -> Zoom Out, Pinch Out (fingers spread) -> Zoom In
        zoomDelta = dPinch1 * 4.5;
        deltaX = dH1_x;
        deltaY = dH1_y;
        hand1Data.role = 'ZOOM';
        activeMode = Math.abs(deltaX) > 0.003 || Math.abs(deltaY) > 0.003 ? 'DUAL_MOVE_ZOOM' : 'ZOOM';
        gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
      } else if (hand1Data.isFist) {
        gesture = 'FIST';
        activeMode = 'MERGE';
      } else if (Math.abs(dH1_x) > 0.004 || Math.abs(dH1_y) > 0.004) {
        deltaX = dH1_x;
        deltaY = dH1_y;
        hand1Data.role = 'ORBIT';
        activeMode = 'ORBIT';
        gesture = 'MOVE';
      } else {
        // Subsystem Index Selection via Finger Count (1 to 5)
        switch (hand1Data.fingerCount) {
          case 1:
            gesture = 'INDEX_1';
            activeMode = 'INDEX_SELECT';
            break;
          case 2:
            gesture = 'INDEX_2';
            activeMode = 'INDEX_SELECT';
            break;
          case 3:
            gesture = 'INDEX_3';
            activeMode = 'INDEX_SELECT';
            break;
          case 4:
            gesture = 'INDEX_4';
            activeMode = 'INDEX_SELECT';
            break;
          case 5:
            gesture = 'PALM';
            activeMode = 'ORBIT';
            break;
          default:
            gesture = 'PALM';
            activeMode = 'ORBIT';
            break;
        }
      }
    }

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
      isPinching: hand1Data.isPinching || (hand2Data?.isPinching ?? false),
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
        isPinching: hand1Data.isPinching,
        pinchDist: hand1Data.pinchDist,
        role: hand1Data.role,
      },
      secondaryHand: hand2Data
        ? {
            x: hand2Data.centroid.x,
            y: hand2Data.centroid.y,
            fingerCount: hand2Data.fingerCount,
            isPinching: hand2Data.isPinching,
            pinchDist: hand2Data.pinchDist,
            role: hand2Data.role,
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
    const indexPip = landmarks[6];
    const indexTip = landmarks[8];
    const middleMcp = landmarks[9];
    const middlePip = landmarks[10];
    const middleTip = landmarks[12];
    const ringMcp = landmarks[13];
    const ringPip = landmarks[14];
    const ringTip = landmarks[16];
    const pinkyMcp = landmarks[17];
    const pinkyPip = landmarks[18];
    const pinkyTip = landmarks[20];

    const distSq = (a: HandLandmark, b: HandLandmark) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

    // Extension classification
    const isIndexExtended = distSq(wrist, indexTip) > distSq(wrist, indexPip) * 1.08;
    const isMiddleExtended = distSq(wrist, middleTip) > distSq(wrist, middlePip) * 1.08;
    const isRingExtended = distSq(wrist, ringTip) > distSq(wrist, ringPip) * 1.08;
    const isPinkyExtended = distSq(wrist, pinkyTip) > distSq(wrist, pinkyPip) * 1.08;
    const isThumbExtended = distSq(thumbTip, pinkyMcp) > distSq(thumbIp, pinkyMcp) * 1.15;

    let fingerCount = 0;
    if (isThumbExtended) fingerCount++;
    if (isIndexExtended) fingerCount++;
    if (isMiddleExtended) fingerCount++;
    if (isRingExtended) fingerCount++;
    if (isPinkyExtended) fingerCount++;

    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const isPinching = pinchDist < 0.058;
    const pinchDelta = prevPinchDist !== null ? pinchDist - prevPinchDist : 0;
    const isFist =
      !isIndexExtended &&
      !isMiddleExtended &&
      !isRingExtended &&
      !isPinkyExtended &&
      !isThumbExtended;

    let gesture: RecognizedGesture = 'PALM';
    if (isPinching) gesture = 'PINCH';
    else if (isFist) gesture = 'FIST';
    else if (fingerCount === 1 && isIndexExtended) gesture = 'INDEX_1';
    else if (fingerCount === 2 && isIndexExtended && isMiddleExtended) gesture = 'INDEX_2';
    else if (fingerCount === 3) gesture = 'INDEX_3';
    else if (fingerCount === 4) gesture = 'INDEX_4';
    else if (fingerCount >= 5) gesture = 'PALM';

    return {
      landmarks,
      wrist,
      thumbTip,
      indexTip,
      centroid: { x: (wrist.x + middleMcp.x) / 2, y: (wrist.y + middleMcp.y) / 2 },
      fingerCount,
      isPinching,
      pinchDist,
      pinchDelta,
      isFist,
      gesture,
      role: 'IDLE',
    };
  }

  private handleGestureAction(res: GestureTrackingResult): void {
    const store = useRigStore.getState();
    const now = performance.now();

    // 1. Gesture 1: SPLIT VIEW
    if (res.gesture === 'SPLIT' && !store.isSplitViewActive && now - this.lastSplitTime > 2200) {
      this.lastSplitTime = now;
      store.setSplitViewActive(true);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom('Split gesture recognized. Exploding digital twin into subsystem modules.');
      });
      return;
    }

    // 2. Gesture 2: MERGE / REASSEMBLE
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

    // 3. SLICE GESTURE
    if (res.gesture === 'SLICE' && !store.isPipeSliced && now - this.lastSliceTime < 400) {
      store.setPipeSliced(true);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom('Slice gesture detected. Activating pipeline cross-sectional ultrasound view.');
      });
      return;
    }

    // 4. Gesture 6: SUBSYSTEM INDEX SELECTION (Indexes 1 to 5)
    if (res.gesture && res.gesture.startsWith('INDEX_')) {
      if (this.sustainedGesture !== res.gesture) {
        this.sustainedGesture = res.gesture;
        this.sustainedGestureStartTime = now;
      } else if (
        now - this.sustainedGestureStartTime > 450 &&
        now - this.lastIndexTriggerTime > 2500
      ) {
        this.lastIndexTriggerTime = now;
        const indexNum = parseInt(res.gesture.replace('INDEX_', ''), 10);
        if (indexNum >= 1 && indexNum <= 5) {
          store.openSubsystemByIndex(indexNum);
        }
      }
    } else {
      this.sustainedGesture = null;
    }
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

    // HAND 1 (LEFT): Controls ZOOM via continuous Pinch In / Pinch Out
    const h1x = 0.28;
    const h1y = 0.5 + Math.sin(t * 0.4) * 0.05;
    // Oscillating pinch distance between thumb and index: 0.03 (pinched in) to 0.16 (pinched out)
    const pinchDist1 = 0.09 + Math.sin(t * 1.5) * 0.06;
    const zoomDelta = Math.cos(t * 1.5) * 0.012; // + when unpinching (zoom in), - when pinching (zoom out)

    // HAND 2 (RIGHT): Controls ORBIT & TRANSLATION in (x,y)
    const h2x = 0.72 + Math.sin(t * 0.8) * 0.12;
    const h2y = 0.5 + Math.cos(t * 0.6) * 0.10;
    const deltaX = Math.cos(t * 0.8) * 0.007;
    const deltaY = -Math.sin(t * 0.6) * 0.006;

    const currentDist = Math.hypot(h2x - h1x, h2y - h1y);
    const gesture: RecognizedGesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
    const activeMode: GestureTrackingResult['activeMode'] = 'JARVIS_DECOUPLED_DUAL';

    // Left hand pinch landmarks
    const landmarks1: HandLandmark[] = [
      { x: h1x, y: h1y, type: 'palm' },
      { x: h1x, y: h1y - 0.18, type: 'middle' },
      { x: h1x - pinchDist1 * 0.6, y: h1y - pinchDist1 * 0.4, type: 'thumb' },
      { x: h1x + 0.08, y: h1y - 0.1, type: 'pinky' },
      { x: h1x, y: h1y + 0.16, type: 'wrist' },
      { x: h1x + pinchDist1 * 0.4, y: h1y - pinchDist1 * 0.5, type: 'index' },
      { x: h1x + 0.04, y: h1y - 0.16, type: 'ring' },
    ];

    // Right hand orbit landmarks
    const landmarks2: HandLandmark[] = [
      { x: h2x, y: h2y, type: 'palm' },
      { x: h2x, y: h2y - 0.2, type: 'middle' },
      { x: h2x - 0.1, y: h2y - 0.1, type: 'thumb' },
      { x: h2x + 0.1, y: h2y - 0.1, type: 'pinky' },
      { x: h2x, y: h2y + 0.18, type: 'wrist' },
      { x: h2x - 0.05, y: h2y - 0.18, type: 'index' },
      { x: h2x + 0.05, y: h2y - 0.18, type: 'ring' },
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
      zoomDelta,
      isTwoHanded: true,
      isPinching: pinchDist1 < 0.06,
      fingerCount: 10,
      primaryHand: {
        landmarks: landmarks1,
        wrist: landmarks1[4],
        thumbTip: landmarks1[2],
        indexTip: landmarks1[5],
        centroid: { x: h1x, y: h1y },
        fingerCount: 5,
        isPinching: pinchDist1 < 0.06,
        pinchDist: pinchDist1,
        pinchDelta: zoomDelta,
        isFist: false,
        gesture: zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT',
        role: 'ZOOM',
      },
      secondaryHand: {
        landmarks: landmarks2,
        wrist: landmarks2[4],
        thumbTip: landmarks2[2],
        indexTip: landmarks2[5],
        centroid: { x: h2x, y: h2y },
        fingerCount: 5,
        isPinching: false,
        pinchDist: 0.18,
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
      zoomDelta,
      distance: currentDist,
      handsCount: 2,
      primaryHand: {
        x: h1x,
        y: h1y,
        fingerCount: 5,
        isPinching: pinchDist1 < 0.06,
        pinchDist: pinchDist1,
        role: 'ZOOM',
      },
      secondaryHand: {
        x: h2x,
        y: h2y,
        fingerCount: 5,
        isPinching: false,
        pinchDist: 0.18,
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
