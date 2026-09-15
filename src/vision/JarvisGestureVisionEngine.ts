/**
 * JARVIS / VARUNA-AI Computer Vision Hand Gesture Recognition Engine
 * Real-time webcam processing:
 * - Detects Open Palm, Pinch, Two-Hand Split, Chop/Slice, Point, and Fist.
 * - Drives 3D Camera spatial manipulation and triggers Holographic Exploded Views.
 */

import { useRigStore } from '../store/useRigStore';

export type RecognizedGesture = 'PALM' | 'PINCH' | 'SPLIT' | 'SLICE' | 'POINT' | 'FIST' | null;

export interface GestureTrackingResult {
  gesture: RecognizedGesture;
  confidence: number;
  handX: number; // 0.0 to 1.0 (normalized)
  handY: number; // 0.0 to 1.0 (normalized)
  palmRadius: number;
  isPinching: boolean;
  isTwoHanded: boolean;
  landmarks: { x: number; y: number }[];
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

  // Viewfinder draw callback for UI canvas
  private onFrameCallbacks: Set<(result: GestureTrackingResult, video: HTMLVideoElement) => void> = new Set();

  public async start(): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia is not supported by this browser.');
        return false;
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      await this.videoElement.play();

      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 160;
      this.canvasElement.height = 120;
      this.ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });

      this.isRunning = true;
      useRigStore.getState().setGestureCameraActive(true);

      this.processLoop();
      return true;
    } catch (err) {
      console.error('Failed to initialize Jarvis Vision Camera:', err);
      useRigStore.getState().setGestureCameraActive(false);
      return false;
    }
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
      this.videoElement = null;
    }

    useRigStore.getState().setGestureCameraActive(false);
    useRigStore.getState().setGestureDetected(null, 0);
  }

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
   * Fast, zero-latency chroma & morphology hand analyzer
   */
  private analyzeFrame(imgData: ImageData, w: number, h: number): GestureTrackingResult {
    const data = imgData.data;
    let sumX = 0;
    let sumY = 0;
    let skinPixelCount = 0;
    const skinPoints: { x: number; y: number }[] = [];

    // Step 1: Skin chroma segmentation (YCrCb / RGB heuristics)
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Skin detection rule
        const isSkin =
          r > 85 &&
          g > 35 &&
          b > 20 &&
          r > g &&
          r > b &&
          Math.abs(r - g) > 12 &&
          r - b > 15;

        if (isSkin) {
          sumX += x;
          sumY += y;
          skinPixelCount++;
          if (skinPixelCount % 4 === 0) {
            skinPoints.push({ x, y });
          }
        }
      }
    }

    const totalSampled = (w * h) / 4;
    const skinRatio = skinPixelCount / totalSampled;

    if (skinPixelCount < 50 || skinRatio < 0.015) {
      return {
        gesture: null,
        confidence: 0,
        handX: 0.5,
        handY: 0.5,
        palmRadius: 0,
        isPinching: false,
        isTwoHanded: false,
        landmarks: [],
      };
    }

    const cx = sumX / skinPixelCount / w;
    const cy = sumY / skinPixelCount / h;
    const now = performance.now();

    // Step 2: Compute bounding dispersion & landmarks
    let maxDistSq = 0;
    let topLandmark = { x: cx, y: cy };
    let leftLandmark = { x: cx, y: cy };
    let rightLandmark = { x: cx, y: cy };

    skinPoints.forEach((p) => {
      const nx = p.x / w;
      const ny = p.y / h;
      const distSq = (nx - cx) ** 2 + (ny - cy) ** 2;
      if (distSq > maxDistSq) maxDistSq = distSq;
      if (ny < topLandmark.y) topLandmark = { x: nx, y: ny };
      if (nx < leftLandmark.x) leftLandmark = { x: nx, y: ny };
      if (nx > rightLandmark.x) rightLandmark = { x: nx, y: ny };
    });

    const palmRadius = Math.sqrt(maxDistSq);
    const handWidth = rightLandmark.x - leftLandmark.x;

    // Step 3: Fast swipe motion detection -> "SLICE"
    let isSlice = false;
    if (this.prevCentroid) {
      const dt = (now - this.prevCentroid.time) / 1000;
      if (dt > 0.02 && dt < 0.25) {
        const vx = (cx - this.prevCentroid.x) / dt;
        const vy = (cy - this.prevCentroid.y) / dt;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 2.8 && now - this.lastSliceTime > 1600) {
          isSlice = true;
          this.lastSliceTime = now;
        }
      }
    }
    this.prevCentroid = { x: cx, y: cy, time: now };

    // Step 4: Classify gestures
    let gesture: RecognizedGesture = 'PALM';
    let confidence = 0.85;

    if (isSlice) {
      gesture = 'SLICE';
      confidence = 0.95;
    } else if (handWidth > 0.42 && skinRatio > 0.12) {
      // Wide two hands spread apart -> "SPLIT"
      gesture = 'SPLIT';
      confidence = 0.9;
    } else if (palmRadius < 0.14 && skinRatio < 0.07) {
      // Small tight area -> "PINCH"
      gesture = 'PINCH';
      confidence = 0.88;
    } else if (topLandmark.y < cy - 0.16 && handWidth < 0.18) {
      // Pointing upward -> "POINT"
      gesture = 'POINT';
      confidence = 0.82;
    } else if (palmRadius < 0.12 && skinRatio > 0.05) {
      // Closed fist -> "FIST"
      gesture = 'FIST';
      confidence = 0.8;
    } else {
      gesture = 'PALM';
      confidence = 0.85;
    }

    const landmarks = [
      { x: cx, y: cy },
      topLandmark,
      leftLandmark,
      rightLandmark,
      { x: cx - palmRadius * 0.5, y: cy - palmRadius * 0.5 },
      { x: cx + palmRadius * 0.5, y: cy - palmRadius * 0.5 },
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
    };
  }

  /**
   * Translates recognized hand gestures into active 3D Digital Twin controls
   */
  private handleGestureAction(res: GestureTrackingResult): void {
    const store = useRigStore.getState();
    const now = performance.now();

    if (res.gesture === 'SLICE' && now - this.lastSliceTime < 200) {
      // Trigger slice pipe cross-section
      if (!store.isPipeSliced) {
        store.setPipeSliced(true);
      }
    } else if (res.gesture === 'SPLIT') {
      // Trigger Jarvis exploded split view if two hands spread apart
      if (!store.isSplitViewActive && now - this.lastSplitTime > 2500) {
        this.lastSplitTime = now;
        store.setSplitViewActive(true);
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
