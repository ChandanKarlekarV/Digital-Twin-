/**
 * JARVIS / VARUNA-AI Computer Vision Hand Gesture Recognition Engine
 * Real-time webcam processing:
 * - Detects Open Palm, Pinch, Two-Hand Split, Chop/Slice, Point, and Fist.
 * - Drives 3D Camera spatial manipulation and triggers Holographic Exploded Views.
 */

import { useRigStore } from '../store/useRigStore';

export type RecognizedGesture = 'PALM' | 'PINCH' | 'SPLIT' | 'SLICE' | 'POINT' | 'FIST' | null;

export interface HandLandmark {
  x: number;
  y: number;
  type?: 'wrist' | 'palm' | 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
}

export interface GestureTrackingResult {
  gesture: RecognizedGesture;
  confidence: number;
  handX: number; // 0.0 to 1.0 (normalized)
  handY: number; // 0.0 to 1.0 (normalized)
  palmRadius: number;
  isPinching: boolean;
  isTwoHanded: boolean;
  landmarks: HandLandmark[];
  fingerCount: number;
}

class JarvisGestureVisionEngine {
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  private mediaPipeHands: any = null;
  private smoothedLandmarks: HandLandmark[] = [];

  private prevCentroid: { x: number; y: number; time: number } | null = null;
  private lastSliceTime = 0;
  private lastSplitTime = 0;
  private lastFistTime = 0;

  // Viewfinder draw callback for UI canvas
  private onFrameCallbacks: Set<(result: GestureTrackingResult, video: HTMLVideoElement) => void> = new Set();

  private isSynthetic = false;
  private syntheticTime = 0;
  private syntheticCanvas: HTMLCanvasElement | null = null;
  private syntheticCtx: CanvasRenderingContext2D | null = null;

  // Deduplication & 60 FPS performance optimizations
  private lastReportedGesture: RecognizedGesture = null;
  private lastReportedConfidence = 0;
  private lastProcessTime = 0;
  private lastTrackingResult: GestureTrackingResult = {
    gesture: null,
    confidence: 0,
    handX: 0.5,
    handY: 0.5,
    palmRadius: 0,
    isPinching: false,
    isTwoHanded: false,
    landmarks: [],
    fingerCount: 0,
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
        this.canvasElement.width = 160;
        this.canvasElement.height = 120;
        this.ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });
      }

      // Initialize MediaPipe Hands if CDN script is loaded
      if (typeof window !== 'undefined' && (window as any).Hands) {
        try {
          this.mediaPipeHands = new (window as any).Hands({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
          });
          this.mediaPipeHands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.55,
            minTrackingConfidence: 0.55,
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
   * High-Efficiency Webcam Stream Acquisition Ladder (Prioritizing 720p 30/60fps for lowest latency)
   */
  private async acquireCameraStream(): Promise<MediaStream> {
    // Stage 1: 720p 30-60 FPS (optimal for real-time webcams without decoding lag)
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

    // Stage 2: 480p (low CPU usage fallback)
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
      console.warn('Stage 2 (480p) failed, trying Stage 3 (1080p)...', e2);
    }

    // Stage 3: 1080p fallback
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (e3) {
      console.warn('Stage 3 (1080p) failed, trying Stage 4 (unconstrained)...', e3);
    }

    // Stage 4: Plain boolean constraint
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    } catch (e4) {
      console.warn('Stage 4 (unconstrained) failed, enumerating devices...', e4);
    }

    // Stage 5: Enumerate video devices directly
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');
    if (videoDevices.length > 0) {
      for (const dev of videoDevices) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: dev.deviceId } },
            audio: false,
          });
        } catch (e) {
          console.warn(`Failed device ${dev.label || dev.deviceId}`, e);
        }
      }
    }

    throw new Error('Camera access denied or hardware unavailable.');
  }

  /**
   * MediaPipe Hands Result Pipeline
   */
  private handleMediaPipeResults = (results: any): void => {
    if (!this.isRunning || !results) return;

    const multiHandLandmarks = results.multiHandLandmarks || [];
    if (multiHandLandmarks.length === 0) {
      return;
    }

    const firstHand = multiHandLandmarks[0];
    const isTwoHanded = multiHandLandmarks.length >= 2;

    // Convert and smooth 21 landmarks using Exponential Moving Average (EMA: alpha = 0.65)
    const rawLandmarks: HandLandmark[] = firstHand.map((lm: any, idx: number) => {
      const typeMap: { [k: number]: HandLandmark['type'] } = {
        0: 'wrist',
        4: 'thumb',
        8: 'index',
        12: 'middle',
        16: 'ring',
        20: 'pinky',
        9: 'palm',
      };
      return {
        x: 1.0 - lm.x, // Mirror X axis
        y: lm.y,
        type: typeMap[idx] || undefined,
      };
    });

    if (this.smoothedLandmarks.length !== rawLandmarks.length) {
      this.smoothedLandmarks = rawLandmarks;
    } else {
      this.smoothedLandmarks = this.smoothedLandmarks.map((prev, idx) => ({
        ...prev,
        x: prev.x * 0.35 + rawLandmarks[idx].x * 0.65,
        y: prev.y * 0.35 + rawLandmarks[idx].y * 0.65,
      }));
    }

    const wrist = this.smoothedLandmarks[0];
    const thumbTip = this.smoothedLandmarks[4];
    const indexTip = this.smoothedLandmarks[8];
    const middleTip = this.smoothedLandmarks[12];
    const ringTip = this.smoothedLandmarks[16];
    const pinkyTip = this.smoothedLandmarks[20];

    const indexPip = this.smoothedLandmarks[6];
    const middlePip = this.smoothedLandmarks[10];
    const ringPip = this.smoothedLandmarks[14];
    const pinkyPip = this.smoothedLandmarks[18];

    // Distance metrics from wrist
    const distSq = (a: HandLandmark, b: HandLandmark) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

    const isIndexExtended = distSq(wrist, indexTip) > distSq(wrist, indexPip);
    const isMiddleExtended = distSq(wrist, middleTip) > distSq(wrist, middlePip);
    const isRingExtended = distSq(wrist, ringTip) > distSq(wrist, ringPip);
    const isPinkyExtended = distSq(wrist, pinkyTip) > distSq(wrist, pinkyPip);

    const pinchDist = Math.sqrt(distSq(thumbTip, indexTip));
    const isPinching = pinchDist < 0.055;

    let gesture: RecognizedGesture = 'PALM';
    let fingerCount = 5;

    // Kinematic Gesture Decision Tree
    if (isTwoHanded) {
      const secondHand = multiHandLandmarks[1];
      const h1x = 1.0 - firstHand[0].x;
      const h2x = 1.0 - secondHand[0].x;
      if (Math.abs(h1x - h2x) > 0.28) {
        gesture = 'SPLIT';
        fingerCount = 10;
      }
    } else if (isPinching) {
      gesture = 'PINCH';
      fingerCount = 2;
    } else if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      gesture = 'POINT';
      fingerCount = 1;
    } else if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      gesture = 'FIST';
      fingerCount = 0;
    } else {
      gesture = 'PALM';
      fingerCount = 5;
    }

    const result: GestureTrackingResult = {
      gesture,
      confidence: 0.96,
      handX: wrist.x,
      handY: wrist.y,
      palmRadius: 0.18,
      isPinching,
      isTwoHanded,
      landmarks: this.smoothedLandmarks,
      fingerCount,
    };

    this.lastTrackingResult = result;

    // Only dispatch to state store if gesture has changed (avoids 60 FPS render churn)
    if (this.lastReportedGesture !== gesture) {
      this.lastReportedGesture = gesture;
      this.lastReportedConfidence = 0.96;
      useRigStore.getState().setGestureDetected(gesture, 0.96);
    }
    this.handleGestureAction(result);
  };

  /**
   * Starts Synthetic / Demo Vision Simulation mode for devices without camera access
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
    this.lastReportedConfidence = 0;
    this.lastTrackingResult = {
      gesture: null,
      confidence: 0,
      handX: 0.5,
      handY: 0.5,
      palmRadius: 0,
      isPinching: false,
      isTwoHanded: false,
      landmarks: [],
      fingerCount: 0,
    };

    const store = useRigStore.getState();
    store.setGestureCameraActive(false);
    store.setSyntheticCameraActive(false);
    store.setCameraPermissionState('idle');
    store.setGestureDetected(null, 0);
  }

  /**
   * Continuous Synthetic Hand Simulator Loop
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

    // Dynamic oscillating hand position
    const cx = 0.5 + Math.sin(t * 0.8) * 0.22;
    const cy = 0.5 + Math.cos(t * 0.6) * 0.18;

    // Cycle through gestures every 5 seconds
    const phase = Math.floor(t / 5) % 4;
    let gesture: RecognizedGesture = 'PALM';
    if (phase === 1) gesture = 'PINCH';
    else if (phase === 2) gesture = 'POINT';
    else if (phase === 3) gesture = 'SPLIT';

    const landmarks: HandLandmark[] = [
      { x: cx, y: cy, type: 'palm' },
      { x: cx, y: cy - 0.22, type: 'middle' },
      { x: cx - 0.14, y: cy - 0.12, type: 'thumb' },
      { x: cx + 0.14, y: cy - 0.12, type: 'pinky' },
      { x: cx, y: cy + 0.2, type: 'wrist' },
      { x: cx - 0.07, y: cy - 0.19, type: 'index' },
      { x: cx + 0.07, y: cy - 0.19, type: 'ring' },
    ];

    const result: GestureTrackingResult = {
      gesture,
      confidence: 0.95,
      handX: cx,
      handY: cy,
      palmRadius: 0.2,
      isPinching: gesture === 'PINCH',
      isTwoHanded: gesture === 'SPLIT',
      landmarks,
      fingerCount: gesture === 'PALM' ? 5 : gesture === 'PINCH' ? 2 : gesture === 'POINT' ? 1 : 10,
    };

    this.lastTrackingResult = result;

    if (this.lastReportedGesture !== result.gesture) {
      this.lastReportedGesture = result.gesture;
      this.lastReportedConfidence = result.confidence;
      useRigStore.getState().setGestureDetected(result.gesture, result.confidence);
    }
    this.handleGestureAction(result);

    // Call registered UI viewfinder callbacks with synthetic canvas image
    this.onFrameCallbacks.forEach((cb) => cb(result, this.syntheticCanvas as unknown as HTMLVideoElement));

    this.animFrameId = requestAnimationFrame(this.processSyntheticLoop);
  };

  public registerFrameCallback(cb: (result: GestureTrackingResult, video: HTMLVideoElement) => void): () => void {
    this.onFrameCallbacks.add(cb);
    return () => {
      this.onFrameCallbacks.delete(cb);
    };
  }

  private isProcessingMediaPipe = false;

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

        // If MediaPipe is not available, process via CV Color-Space pipeline
        if (!this.mediaPipeHands) {
          const w = this.canvasElement.width;
          const h = this.canvasElement.height;

          // Draw mirrored video frame into low-res processing canvas
          this.ctx.save();
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(this.videoElement, -w, 0, w, h);
          this.ctx.restore();

          const imgData = this.ctx.getImageData(0, 0, w, h);
          const result = this.analyzeFrame(imgData, w, h);
          this.lastTrackingResult = result;

          // Update state store only when gesture actually changes
          if (this.lastReportedGesture !== result.gesture) {
            this.lastReportedGesture = result.gesture;
            this.lastReportedConfidence = result.confidence;
            useRigStore.getState().setGestureDetected(result.gesture, result.confidence);
          }

          // Handle gesture-driven 3D actions
          this.handleGestureAction(result);
        }
      }
    }

    this.animFrameId = requestAnimationFrame(this.processLoop);
  };

  /**
   * Adaptive Multi-Color-Space Hand & Gesture Analyzer
   */
  private analyzeFrame(imgData: ImageData, w: number, h: number): GestureTrackingResult {
    const data = imgData.data;
    let sumX = 0;
    let sumY = 0;
    let skinPixelCount = 0;
    const skinPoints: { x: number; y: number }[] = [];

    // Step 1: Adaptive skin segmentation across RGB + YCbCr
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // RGB skin thresholds
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

        // YCbCr approximation
        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const ycbcrSkin = Y > 50 && Cb >= 77 && Cb <= 135 && Cr >= 130 && Cr <= 180;

        if (rgbSkin || ycbcrSkin) {
          sumX += x;
          sumY += y;
          skinPixelCount++;
          if (skinPixelCount % 3 === 0) {
            skinPoints.push({ x, y });
          }
        }
      }
    }

    const totalSampled = (w * h) / 4;
    const skinRatio = skinPixelCount / totalSampled;

    if (skinPixelCount < 40 || skinRatio < 0.012) {
      return {
        gesture: null,
        confidence: 0,
        handX: 0.5,
        handY: 0.5,
        palmRadius: 0,
        isPinching: false,
        isTwoHanded: false,
        landmarks: [],
        fingerCount: 0,
      };
    }

    const cx = sumX / skinPixelCount / w;
    const cy = sumY / skinPixelCount / h;
    const now = performance.now();

    // Step 2: Extract hand bounding extremities and contour points
    let maxDistSq = 0;
    let topLandmark = { x: cx, y: cy };
    let bottomLandmark = { x: cx, y: cy };
    let leftLandmark = { x: cx, y: cy };
    let rightLandmark = { x: cx, y: cy };

    skinPoints.forEach((p) => {
      const nx = p.x / w;
      const ny = p.y / h;
      const distSq = (nx - cx) ** 2 + (ny - cy) ** 2;

      if (distSq > maxDistSq) maxDistSq = distSq;
      if (ny < topLandmark.y) topLandmark = { x: nx, y: ny };
      if (ny > bottomLandmark.y) bottomLandmark = { x: nx, y: ny };
      if (nx < leftLandmark.x) leftLandmark = { x: nx, y: ny };
      if (nx > rightLandmark.x) rightLandmark = { x: nx, y: ny };
    });

    const palmRadius = Math.sqrt(maxDistSq);
    const handWidth = rightLandmark.x - leftLandmark.x;

    // Step 3: Fast swipe motion detection -> "SLICE"
    let isSlice = false;
    if (this.prevCentroid) {
      const dt = (now - this.prevCentroid.time) / 1000;
      if (dt > 0.015 && dt < 0.28) {
        const vx = (cx - this.prevCentroid.x) / dt;
        const vy = (cy - this.prevCentroid.y) / dt;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 2.2 && now - this.lastSliceTime > 1400) {
          isSlice = true;
          this.lastSliceTime = now;
        }
      }
    }
    this.prevCentroid = { x: cx, y: cy, time: now };

    // Step 4: Classify gestures based on aspect ratio, compactness, and fingers
    let gesture: RecognizedGesture = 'PALM';
    let confidence = 0.88;
    let fingerCount = 5;

    if (isSlice) {
      gesture = 'SLICE';
      confidence = 0.96;
    } else if (handWidth > 0.38 && skinRatio > 0.1) {
      // Two hands spread wide or wide palm spread -> "SPLIT"
      gesture = 'SPLIT';
      confidence = 0.92;
      fingerCount = 10;
    } else if (palmRadius < 0.13 && skinRatio < 0.065) {
      // Small tight pinch between fingers -> "PINCH"
      gesture = 'PINCH';
      confidence = 0.9;
      fingerCount = 2;
    } else if (topLandmark.y < cy - 0.14 && handWidth < 0.16) {
      // Index finger extended vertically -> "POINT"
      gesture = 'POINT';
      confidence = 0.86;
      fingerCount = 1;
    } else if (palmRadius < 0.11 && skinRatio > 0.045 && handWidth < 0.14) {
      // Closed tight fist -> "FIST"
      gesture = 'FIST';
      confidence = 0.85;
      fingerCount = 0;
    } else {
      // Full open hand -> "PALM"
      gesture = 'PALM';
      confidence = 0.88;
      fingerCount = 5;
    }

    // Generate skeleton landmarks
    const landmarks: HandLandmark[] = [
      { x: cx, y: cy, type: 'palm' },
      { x: topLandmark.x, y: topLandmark.y, type: 'middle' },
      { x: leftLandmark.x, y: leftLandmark.y, type: 'thumb' },
      { x: rightLandmark.x, y: rightLandmark.y, type: 'pinky' },
      { x: bottomLandmark.x, y: bottomLandmark.y, type: 'wrist' },
      { x: cx - palmRadius * 0.45, y: cy - palmRadius * 0.45, type: 'index' },
      { x: cx + palmRadius * 0.45, y: cy - palmRadius * 0.45, type: 'ring' },
    ];

    return {
      gesture,
      confidence,
      handX: cx,
      handY: cy,
      palmRadius,
      isPinching: gesture === 'PINCH',
      isTwoHanded: gesture === 'SPLIT',
      landmarks,
      fingerCount,
    };
  }

  /**
   * Translates recognized hand gestures into active 3D Digital Twin controls
   */
  private handleGestureAction(res: GestureTrackingResult): void {
    const store = useRigStore.getState();
    const now = performance.now();

    if (res.gesture === 'SLICE' && now - this.lastSliceTime < 300) {
      // Trigger slice pipe cross-section
      if (!store.isPipeSliced) {
        store.setPipeSliced(true);
      }
    } else if (res.gesture === 'SPLIT') {
      // Trigger Iron Man 3D exploded split view if two hands spread apart
      if (!store.isSplitViewActive && now - this.lastSplitTime > 2200) {
        this.lastSplitTime = now;
        store.setSplitViewActive(true);
      }
    } else if (res.gesture === 'FIST') {
      // Closed fist: Assemble rig back together
      if (store.isSplitViewActive && now - this.lastFistTime > 2000) {
        this.lastFistTime = now;
        store.setSplitViewActive(false);
      }
    } else if (res.gesture === 'POINT') {
      // Point to Pipe 1
      if (store.cameraViewMode !== 'pipe1') {
        store.setCameraViewMode('pipe1');
        store.setSelectedAssetId('RISER-ALPHA');
      }
    }
  }
}

export const jarvisGestureEngine = new JarvisGestureVisionEngine();

