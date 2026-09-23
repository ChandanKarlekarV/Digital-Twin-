/**
 * JARVIS / VARUNA-AI Computer Vision Hand Gesture Recognition Engine
 * Real-time Webcam & Dual-Hand Spatial Processing:
 * - 6 Identifiable & Trackable Gestures:
 *   1. SPLIT VIEW (Two hands spreading apart / wide open -> Exploded Rig view)
 *   2. MERGE / JOIN (Fists / Hands together -> Solid Rig reassembly)
 *   3. MOVE / ORBIT / PAN (Continuous hand translation -> 3D model rotation & pan)
 *   4. ZOOM IN (Hands moving apart / Pinch-open / Thumb-up -> Dolly camera in)
 *   5. ZOOM OUT (Hands moving closer / Pinch-close / Thumb-down -> Dolly camera out)
 *   6. SUBSYSTEM INDEX SELECTOR (Finger count 1-5 -> Helipad, Crane 1, Crane 2, Command Dock, Accommodation)
 * - Simultaneous Two-Hand Tracking:
 *   Simultaneously tracks Hand 1 and Hand 2 to execute Model Rotation/Pan AND Camera Zoom at the exact same frame!
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
  centroid: { x: number; y: number };
  fingerCount: number;
  isPinching: boolean;
  pinchDist: number;
  isFist: boolean;
  gesture: RecognizedGesture;
}

export interface GestureTrackingResult {
  gesture: RecognizedGesture;
  confidence: number;
  handsCount: number;
  handX: number; // Normalized 0..1 (Midpoint or Primary Hand)
  handY: number; // Normalized 0..1 (Midpoint or Primary Hand)
  handDistance: number; // Distance between Hand 1 & Hand 2 (0 if 1 hand)
  deltaX: number; // Continuous horizontal motion delta
  deltaY: number; // Continuous vertical motion delta
  zoomDelta: number; // Continuous zoom delta (+ zoom in, - zoom out)
  isTwoHanded: boolean;
  isPinching: boolean;
  fingerCount: number;
  primaryHand: SingleHandData | null;
  secondaryHand: SingleHandData | null;
  landmarks: HandLandmark[];
  activeMode: 'DUAL_MOVE_ZOOM' | 'ORBIT' | 'ZOOM' | 'SPLIT' | 'MERGE' | 'INDEX_SELECT' | 'IDLE';
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

  // Motion history for continuous deltas
  private prevMidpoint: { x: number; y: number; time: number } | null = null;
  private prevDistance: number | null = null;
  private prevCentroid: { x: number; y: number; time: number } | null = null;

  // Sustained gesture stability & cooldowns
  private sustainedGesture: RecognizedGesture = null;
  private sustainedGestureStartTime = 0;
  private lastTriggeredGesture: RecognizedGesture = null;
  private lastTriggerTime = 0;
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
        throw new Error('MediaDevices API not supported in this browser context. Please access via http://localhost:1420 or HTTPS.');
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
        this.canvasElement.width = 240;
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
        userFriendlyMsg = 'Camera blocked. In Windows: Settings > Privacy > Camera > Turn ON access. In Browser: Click the lock icon in address bar to Allow.';
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

  /**
   * Acquire 720p / 480p low-latency webcam stream
   */
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
   * MediaPipe Multi-Hand Pipeline: Simultaneous Two-Hand Tracking
   */
  private handleMediaPipeResults = (results: any): void => {
    if (!this.isRunning || !results) return;

    const multiHandLandmarks = results.multiHandLandmarks || [];
    const handsCount = multiHandLandmarks.length;

    if (handsCount === 0) {
      this.prevMidpoint = null;
      this.prevDistance = null;
      this.prevCentroid = null;
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

    // Process Hand 1
    const hand1Raw = this.extractLandmarks(multiHandLandmarks[0]);
    this.smoothedLandmarks1 = this.smoothLandmarks(this.smoothedLandmarks1, hand1Raw);
    const hand1Data = this.analyzeSingleHand(this.smoothedLandmarks1);

    let hand2Data: SingleHandData | null = null;
    let combinedLandmarks = [...this.smoothedLandmarks1];

    // Process Hand 2 if detected
    if (handsCount >= 2) {
      const hand2Raw = this.extractLandmarks(multiHandLandmarks[1]);
      this.smoothedLandmarks2 = this.smoothLandmarks(this.smoothedLandmarks2, hand2Raw);
      hand2Data = this.analyzeSingleHand(this.smoothedLandmarks2);
      combinedLandmarks = [...this.smoothedLandmarks1, ...this.smoothedLandmarks2];
    } else {
      this.smoothedLandmarks2 = [];
    }

    let gesture: RecognizedGesture = null;
    let confidence = 0.94;
    let activeMode: GestureTrackingResult['activeMode'] = 'IDLE';
    let deltaX = 0;
    let deltaY = 0;
    let zoomDelta = 0;
    let currentDistance = 0;
    let midX = hand1Data.centroid.x;
    let midY = hand1Data.centroid.y;

    // KINEMATIC ANALYSIS: DUAL-HAND OR SINGLE-HAND
    if (handsCount >= 2 && hand2Data) {
      // TWO HANDS SIMULTANEOUS TRACKING
      midX = (hand1Data.centroid.x + hand2Data.centroid.x) / 2.0;
      midY = (hand1Data.centroid.y + hand2Data.centroid.y) / 2.0;
      currentDistance = Math.hypot(
        hand2Data.centroid.x - hand1Data.centroid.x,
        hand2Data.centroid.y - hand1Data.centroid.y
      );

      // Continuous Translation & Zoom Deltas
      if (this.prevMidpoint) {
        const dt = Math.max(0.01, (now - this.prevMidpoint.time) / 1000);
        deltaX = (midX - this.prevMidpoint.x);
        deltaY = (midY - this.prevMidpoint.y);
      }
      if (this.prevDistance !== null) {
        zoomDelta = (currentDistance - this.prevDistance);
      }

      this.prevMidpoint = { x: midX, y: midY, time: now };
      this.prevDistance = currentDistance;

      // Gesture Classification for Two Hands:
      const totalFingers = hand1Data.fingerCount + hand2Data.fingerCount;
      const bothFists = hand1Data.isFist && hand2Data.isFist;

      if (bothFists || currentDistance < 0.14) {
        gesture = 'MERGE';
        activeMode = 'MERGE';
      } else if (currentDistance > 0.46 || (zoomDelta > 0.04 && totalFingers >= 8)) {
        gesture = 'SPLIT';
        activeMode = 'SPLIT';
      } else if (Math.abs(zoomDelta) > 0.008 && (Math.abs(deltaX) > 0.005 || Math.abs(deltaY) > 0.005)) {
        // SIMULTANEOUS MOVE + ZOOM ACTIVE!
        gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
        activeMode = 'DUAL_MOVE_ZOOM';
      } else if (Math.abs(zoomDelta) > 0.012) {
        gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
        activeMode = 'ZOOM';
      } else if (Math.abs(deltaX) > 0.005 || Math.abs(deltaY) > 0.005) {
        gesture = 'MOVE';
        activeMode = 'ORBIT';
      } else {
        gesture = 'PALM';
        activeMode = 'IDLE';
      }
    } else {
      // SINGLE HAND TRACKING
      if (this.prevCentroid) {
        deltaX = (midX - this.prevCentroid.x);
        deltaY = (midY - this.prevCentroid.y);
      }
      this.prevCentroid = { x: midX, y: midY, time: now };
      this.prevMidpoint = { x: midX, y: midY, time: now };
      this.prevDistance = null;

      // Fast horizontal swipe -> SLICE
      if (Math.abs(deltaX) > 0.12 && now - this.lastSliceTime > 1400) {
        gesture = 'SLICE';
        activeMode = 'SPLIT';
        this.lastSliceTime = now;
      } else if (hand1Data.isPinching) {
        // Pinch Zoom
        gesture = 'PINCH';
        activeMode = 'ZOOM';
        zoomDelta = deltaY * -1.8; // Moving pinch up zooms in, down zooms out
      } else if (hand1Data.isFist) {
        gesture = 'FIST';
        activeMode = 'MERGE';
      } else {
        // Subsystem Index Selection via Finger Count (1 to 5)
        switch (hand1Data.fingerCount) {
          case 1:
            gesture = 'INDEX_1'; // Helipad
            activeMode = 'INDEX_SELECT';
            break;
          case 2:
            gesture = 'INDEX_2'; // Crane 1 (Peace / Victory)
            activeMode = 'INDEX_SELECT';
            break;
          case 3:
            gesture = 'INDEX_3'; // Crane 2
            activeMode = 'INDEX_SELECT';
            break;
          case 4:
            gesture = 'INDEX_4'; // Command Dock
            activeMode = 'INDEX_SELECT';
            break;
          case 5:
            gesture = 'PALM'; // Orbit / Move or Index 5
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
      },
      secondaryHand: hand2Data
        ? {
            x: hand2Data.centroid.x,
            y: hand2Data.centroid.y,
            fingerCount: hand2Data.fingerCount,
            isPinching: hand2Data.isPinching,
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

  /**
   * Helper to convert MediaPipe landmarks to mirrored normalized landmarks
   */
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
      x: 1.0 - lm.x, // Mirrored for intuitive natural interaction
      y: lm.y,
      z: lm.z || 0,
      type: typeMap[idx] || undefined,
    }));
  }

  /**
   * Exponential Moving Average (EMA) landmark smoothing
   */
  private smoothLandmarks(prev: HandLandmark[], current: HandLandmark[]): HandLandmark[] {
    if (prev.length !== current.length) return current;
    const alpha = 0.65;
    return prev.map((p, i) => ({
      ...p,
      x: p.x * (1 - alpha) + current[i].x * alpha,
      y: p.y * (1 - alpha) + current[i].y * alpha,
      z: (p.z || 0) * (1 - alpha) + (current[i].z || 0) * alpha,
    }));
  }

  /**
   * Anatomical Joint & Finger Extension Classifier
   */
  private analyzeSingleHand(landmarks: HandLandmark[]): SingleHandData {
    if (landmarks.length < 21) {
      return {
        landmarks,
        centroid: { x: landmarks[0]?.x || 0.5, y: landmarks[0]?.y || 0.5 },
        fingerCount: 0,
        isPinching: false,
        pinchDist: 1.0,
        isFist: true,
        gesture: 'FIST',
      };
    }

    const wrist = landmarks[0];
    const thumbMcp = landmarks[2];
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

    // Finger Extension Rules: Tip distance from wrist exceeds PIP distance
    const isIndexExtended = distSq(wrist, indexTip) > distSq(wrist, indexPip) * 1.08;
    const isMiddleExtended = distSq(wrist, middleTip) > distSq(wrist, middlePip) * 1.08;
    const isRingExtended = distSq(wrist, ringTip) > distSq(wrist, ringPip) * 1.08;
    const isPinkyExtended = distSq(wrist, pinkyTip) > distSq(wrist, pinkyPip) * 1.08;

    // Thumb Extension: Tip distance from pinky MCP
    const isThumbExtended = distSq(thumbTip, pinkyMcp) > distSq(thumbIp, pinkyMcp) * 1.15;

    let fingerCount = 0;
    if (isThumbExtended) fingerCount++;
    if (isIndexExtended) fingerCount++;
    if (isMiddleExtended) fingerCount++;
    if (isRingExtended) fingerCount++;
    if (isPinkyExtended) fingerCount++;

    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const isPinching = pinchDist < 0.058;
    const isFist = !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended && !isThumbExtended;

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
      centroid: { x: (wrist.x + middleMcp.x) / 2, y: (wrist.y + middleMcp.y) / 2 },
      fingerCount,
      isPinching,
      pinchDist,
      isFist,
      gesture,
    };
  }

  /**
   * High-Precision Action Trigger with Cooldowns & Sustained State Stability
   */
  private handleGestureAction(res: GestureTrackingResult): void {
    const store = useRigStore.getState();
    const now = performance.now();

    // 1. Gesture 1: SPLIT VIEW (Exploded View)
    if (res.gesture === 'SPLIT' && !store.isSplitViewActive && now - this.lastSplitTime > 2200) {
      this.lastSplitTime = now;
      store.setSplitViewActive(true);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom('Split gesture recognized. Exploding digital twin into subsystem modules.');
      });
      return;
    }

    // 2. Gesture 2: MERGE / REASSEMBLE (Solid Rig)
    if ((res.gesture === 'MERGE' || res.gesture === 'FIST') && store.isSplitViewActive && now - this.lastMergeTime > 2000) {
      this.lastMergeTime = now;
      store.setSplitViewActive(false);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom('Merge gesture recognized. Reassembling digital twin.');
      });
      return;
    }

    // 3. SLICE GESTURE: Pipe cross-section
    if (res.gesture === 'SLICE' && !store.isPipeSliced && now - this.lastSliceTime < 400) {
      store.setPipeSliced(true);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom('Slice gesture detected. Activating pipeline cross-sectional ultrasound view.');
      });
      return;
    }

    // 4. Gesture 6: SUBSYSTEM INDEX SELECTION (Indexes 1 to 5)
    // Requires sustained gesture for ~400ms to avoid accidental triggering while moving hands
    if (res.gesture && res.gesture.startsWith('INDEX_')) {
      if (this.sustainedGesture !== res.gesture) {
        this.sustainedGesture = res.gesture;
        this.sustainedGestureStartTime = now;
      } else if (now - this.sustainedGestureStartTime > 450 && now - this.lastIndexTriggerTime > 2500) {
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

  /**
   * Starts Synthetic / Demo Vision Simulation for simultaneous two-hand tracking
   */
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
   * Continuous Synthetic Dual-Hand Simulator Loop
   */
  private processSyntheticLoop = (): void => {
    if (!this.isRunning || !this.isSynthetic || !this.syntheticCanvas || !this.syntheticCtx) return;

    this.syntheticTime += 0.025;
    const t = this.syntheticTime;
    const w = this.syntheticCanvas.width;
    const h = this.syntheticCanvas.height;
    const ctx = this.syntheticCtx;

    // Draw dark grid cyberpunk background
    ctx.fillStyle = '#06101e';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines
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

    // Dual-hand oscillating motion (simultaneous move + zoom simulation)
    const midX = 0.5 + Math.sin(t * 0.7) * 0.15;
    const midY = 0.5 + Math.cos(t * 0.5) * 0.12;
    const spread = 0.22 + Math.sin(t * 1.3) * 0.12; // Expanding and contracting distance

    const h1x = midX - spread;
    const h1y = midY;
    const h2x = midX + spread;
    const h2y = midY;

    // Synthetic deltas
    const deltaX = Math.cos(t * 0.7) * 0.006;
    const deltaY = -Math.sin(t * 0.5) * 0.005;
    const zoomDelta = Math.cos(t * 1.3) * 0.008;

    // Cycle through gestures every 4 seconds
    const phase = Math.floor(t / 4) % 6;
    let gesture: RecognizedGesture = 'MOVE';
    let activeMode: GestureTrackingResult['activeMode'] = 'DUAL_MOVE_ZOOM';

    if (phase === 0) {
      gesture = 'MOVE';
      activeMode = 'DUAL_MOVE_ZOOM';
    } else if (phase === 1) {
      gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
      activeMode = 'ZOOM';
    } else if (phase === 2) {
      gesture = 'SPLIT';
      activeMode = 'SPLIT';
    } else if (phase === 3) {
      gesture = 'MERGE';
      activeMode = 'MERGE';
    } else if (phase === 4) {
      gesture = 'INDEX_1';
      activeMode = 'INDEX_SELECT';
    } else if (phase === 5) {
      gesture = 'INDEX_2';
      activeMode = 'INDEX_SELECT';
    }

    const landmarks1: HandLandmark[] = [
      { x: h1x, y: h1y, type: 'palm' },
      { x: h1x, y: h1y - 0.2, type: 'middle' },
      { x: h1x - 0.1, y: h1y - 0.1, type: 'thumb' },
      { x: h1x + 0.1, y: h1y - 0.1, type: 'pinky' },
      { x: h1x, y: h1y + 0.18, type: 'wrist' },
      { x: h1x - 0.05, y: h1y - 0.18, type: 'index' },
      { x: h1x + 0.05, y: h1y - 0.18, type: 'ring' },
    ];

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
      confidence: 0.96,
      handsCount: 2,
      handX: midX,
      handY: midY,
      handDistance: spread * 2,
      deltaX,
      deltaY,
      zoomDelta,
      isTwoHanded: true,
      isPinching: false,
      fingerCount: 10,
      primaryHand: {
        landmarks: landmarks1,
        centroid: { x: h1x, y: h1y },
        fingerCount: 5,
        isPinching: false,
        pinchDist: 0.2,
        isFist: false,
        gesture: 'PALM',
      },
      secondaryHand: {
        landmarks: landmarks2,
        centroid: { x: h2x, y: h2y },
        fingerCount: 5,
        isPinching: false,
        pinchDist: 0.2,
        isFist: false,
        gesture: 'PALM',
      },
      landmarks: [...landmarks1, ...landmarks2],
      activeMode,
    };

    this.lastTrackingResult = result;

    useRigStore.getState().setGestureSpatial({
      deltaX,
      deltaY,
      zoomDelta,
      distance: spread * 2,
      handsCount: 2,
      primaryHand: { x: h1x, y: h1y, fingerCount: 5 },
      secondaryHand: { x: h2x, y: h2y, fingerCount: 5 },
      activeMode,
    });

    if (this.lastReportedGesture !== result.gesture) {
      this.lastReportedGesture = result.gesture;
      useRigStore.getState().setGestureDetected(result.gesture, result.confidence);
    }
    this.handleGestureAction(result);

    this.onFrameCallbacks.forEach((cb) => cb(result, this.syntheticCanvas as unknown as HTMLVideoElement));

    this.animFrameId = requestAnimationFrame(this.processSyntheticLoop);
  };

  public registerFrameCallback(cb: (result: GestureTrackingResult, video: HTMLVideoElement) => void): () => void {
    this.onFrameCallbacks.add(cb);
    return () => {
      this.onFrameCallbacks.delete(cb);
    };
  }

  private processLoop = (): void => {
    if (!this.isRunning || !this.videoElement || !this.ctx || !this.canvasElement) return;

    const now = performance.now();

    if (this.videoElement.readyState >= 2) {
      // 1. Deliver viewfinder frames smoothly on every RAF tick (60+ FPS preview)
      this.onFrameCallbacks.forEach((cb) => cb(this.lastTrackingResult, this.videoElement!));

      // 2. Throttle heavy CV / MediaPipe processing to 30 FPS (~33ms) to eliminate CPU bottleneck
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

        // Color-space multi-cluster fallback if MediaPipe is not ready
        if (!this.mediaPipeHands) {
          const w = this.canvasElement.width;
          const h = this.canvasElement.height;

          this.ctx.save();
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(this.videoElement, -w, 0, w, h);
          this.ctx.restore();

          const imgData = this.ctx.getImageData(0, 0, w, h);
          const result = this.analyzeColorSpaceFrame(imgData, w, h);
          this.lastTrackingResult = result;

          useRigStore.getState().setGestureSpatial({
            deltaX: result.deltaX,
            deltaY: result.deltaY,
            zoomDelta: result.zoomDelta,
            distance: result.handDistance,
            handsCount: result.handsCount,
            primaryHand: result.primaryHand ? { x: result.primaryHand.centroid.x, y: result.primaryHand.centroid.y, fingerCount: result.primaryHand.fingerCount } : null,
            secondaryHand: result.secondaryHand ? { x: result.secondaryHand.centroid.x, y: result.secondaryHand.centroid.y, fingerCount: result.secondaryHand.fingerCount } : null,
            activeMode: result.activeMode,
          });

          if (this.lastReportedGesture !== result.gesture) {
            this.lastReportedGesture = result.gesture;
            useRigStore.getState().setGestureDetected(result.gesture, result.confidence);
          }
          this.handleGestureAction(result);
        }
      }
    }

    this.animFrameId = requestAnimationFrame(this.processLoop);
  };

  /**
   * Adaptive Color-Space Hand & Gesture Analyzer (Dual-Cluster Fallback)
   */
  private analyzeColorSpaceFrame(imgData: ImageData, w: number, h: number): GestureTrackingResult {
    const data = imgData.data;
    let sumX = 0;
    let sumY = 0;
    let skinPixelCount = 0;

    let leftSumX = 0;
    let leftSumY = 0;
    let leftCount = 0;

    let rightSumX = 0;
    let rightSumY = 0;
    let rightCount = 0;

    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const rgbSkin =
          r > 75 &&
          g > 30 &&
          b > 15 &&
          maxVal - minVal > 15 &&
          r > g &&
          r > b &&
          Math.abs(r - g) > 10;

        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const ycbcrSkin = Y > 50 && Cb >= 77 && Cb <= 135 && Cr >= 130 && Cr <= 180;

        if (rgbSkin || ycbcrSkin) {
          sumX += x;
          sumY += y;
          skinPixelCount++;

          if (x < w / 2) {
            leftSumX += x;
            leftSumY += y;
            leftCount++;
          } else {
            rightSumX += x;
            rightSumY += y;
            rightCount++;
          }
        }
      }
    }

    if (skinPixelCount < 40) {
      return {
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
    }

    const now = performance.now();
    const cx = sumX / skinPixelCount / w;
    const cy = sumY / skinPixelCount / h;

    const isTwoHands = leftCount > 25 && rightCount > 25;
    let deltaX = 0;
    let deltaY = 0;
    let zoomDelta = 0;
    let distance = 0;
    let gesture: RecognizedGesture = 'PALM';
    let activeMode: GestureTrackingResult['activeMode'] = 'ORBIT';

    if (isTwoHands) {
      const lx = leftSumX / leftCount / w;
      const ly = leftSumY / leftCount / h;
      const rx = rightSumX / rightCount / w;
      const ry = rightSumY / rightCount / h;
      distance = Math.hypot(rx - lx, ry - ly);

      if (this.prevMidpoint) {
        deltaX = (cx - this.prevMidpoint.x);
        deltaY = (cy - this.prevMidpoint.y);
      }
      if (this.prevDistance !== null) {
        zoomDelta = (distance - this.prevDistance);
      }

      this.prevMidpoint = { x: cx, y: cy, time: now };
      this.prevDistance = distance;

      if (distance > 0.42) {
        gesture = 'SPLIT';
        activeMode = 'SPLIT';
      } else if (distance < 0.15) {
        gesture = 'MERGE';
        activeMode = 'MERGE';
      } else if (Math.abs(zoomDelta) > 0.01 && (Math.abs(deltaX) > 0.004 || Math.abs(deltaY) > 0.004)) {
        gesture = zoomDelta > 0 ? 'ZOOM_IN' : 'ZOOM_OUT';
        activeMode = 'DUAL_MOVE_ZOOM';
      } else {
        gesture = 'MOVE';
        activeMode = 'ORBIT';
      }

      const lms: HandLandmark[] = [
        { x: lx, y: ly, type: 'palm' },
        { x: rx, y: ry, type: 'palm' },
      ];

      return {
        gesture,
        confidence: 0.88,
        handsCount: 2,
        handX: cx,
        handY: cy,
        handDistance: distance,
        deltaX,
        deltaY,
        zoomDelta,
        isTwoHanded: true,
        isPinching: false,
        fingerCount: 10,
        primaryHand: { landmarks: [{ x: lx, y: ly }], centroid: { x: lx, y: ly }, fingerCount: 5, isPinching: false, pinchDist: 0.2, isFist: false, gesture: 'PALM' },
        secondaryHand: { landmarks: [{ x: rx, y: ry }], centroid: { x: rx, y: ry }, fingerCount: 5, isPinching: false, pinchDist: 0.2, isFist: false, gesture: 'PALM' },
        landmarks: lms,
        activeMode,
      };
    }

    // Single hand color space
    if (this.prevCentroid) {
      deltaX = (cx - this.prevCentroid.x);
      deltaY = (cy - this.prevCentroid.y);
    }
    this.prevCentroid = { x: cx, y: cy, time: now };

    const lms: HandLandmark[] = [
      { x: cx, y: cy, type: 'palm' },
      { x: cx, y: cy - 0.15, type: 'middle' },
      { x: cx - 0.1, y: cy, type: 'thumb' },
      { x: cx + 0.1, y: cy, type: 'pinky' },
    ];

    return {
      gesture: 'PALM',
      confidence: 0.85,
      handsCount: 1,
      handX: cx,
      handY: cy,
      handDistance: 0,
      deltaX,
      deltaY,
      zoomDelta: 0,
      isTwoHanded: false,
      isPinching: false,
      fingerCount: 5,
      primaryHand: { landmarks: lms, centroid: { x: cx, y: cy }, fingerCount: 5, isPinching: false, pinchDist: 0.2, isFist: false, gesture: 'PALM' },
      secondaryHand: null,
      landmarks: lms,
      activeMode: 'ORBIT',
    };
  }
}

export const jarvisGestureEngine = new JarvisGestureVisionEngine();
