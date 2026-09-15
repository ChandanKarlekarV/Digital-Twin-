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
      await this.videoElement.play().catch((e) => {
        console.warn('Autoplay warning on video play:', e);
      });

      if (!this.canvasElement) {
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 160;
        this.canvasElement.height = 120;
        this.ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });
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
   * Multi-tier fallback for camera stream acquisition
   */
  private async acquireCameraStream(): Promise<MediaStream> {
    // Tier 1: Relaxed ideal resolution
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err1) {
      console.warn('Tier 1 camera acquisition failed, trying unconstrained video: true...', err1);
    }

    // Tier 2: Plain boolean constraint
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    } catch (err2) {
      console.warn('Tier 2 unconstrained failed, enumerating devices...', err2);
    }

    // Tier 3: Enumerating video devices directly
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

    useRigStore.getState().setGestureDetected(result.gesture, result.confidence);
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

  private processLoop = (): void => {
    if (!this.isRunning || !this.videoElement || !this.ctx || !this.canvasElement) return;

    if (this.videoElement.readyState >= 2) {
      const w = this.canvasElement.width;
      const h = this.canvasElement.height;

      // Draw mirrored video frame into low-res processing canvas
      this.ctx.save();
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.videoElement, -w, 0, w, h);
      this.ctx.restore();

      const imgData = this.ctx.getImageData(0, 0, w, h);
      const result = this.analyzeFrame(imgData, w, h);

      // Update state store
      if (result.gesture) {
        useRigStore.getState().setGestureDetected(result.gesture, result.confidence);
      }

      // Handle gesture-driven 3D actions
      this.handleGestureAction(result);

      // Trigger UI overlays
      this.onFrameCallbacks.forEach((cb) => cb(result, this.videoElement!));
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

