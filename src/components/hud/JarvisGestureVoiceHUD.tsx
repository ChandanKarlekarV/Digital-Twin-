import React, { useEffect, useRef, useState } from 'react';
import {
  Zap,
  Mic,
  Video,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  Scissors,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FolderOpen,
  Power,
  Hand,
} from 'lucide-react';
import { useRigStore, RecognizedGesture } from '../../store/useRigStore';
import { jarvisGestureEngine } from '../../vision/JarvisGestureVisionEngine';
import { jarvisVoiceCommander } from '../../voice/JarvisVoiceCommander';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const JarvisGestureVoiceHUD: React.FC = () => {
  const isGestureCameraActive = useRigStore((s) => s.isGestureCameraActive);
  const isSyntheticCameraActive = useRigStore((s) => s.isSyntheticCameraActive);
  const cameraPermissionState = useRigStore((s) => s.cameraPermissionState);
  const cameraErrorMessage = useRigStore((s) => s.cameraErrorMessage);
  const gestureDetected = useRigStore((s) => s.gestureDetected);
  const gestureSpatial = useRigStore((s) => s.gestureSpatial);

  const isVarunaAwake = useRigStore((s) => s.isVarunaAwake);
  const varunaWakeExpiry = useRigStore((s) => s.varunaWakeExpiry);
  const wakeVaruna = useRigStore((s) => s.wakeVaruna);
  const isListeningSpeech = useRigStore((s) => s.isListeningSpeech);
  const voiceTranscript = useRigStore((s) => s.voiceTranscript);
  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);

  const setSplitViewActive = useRigStore((s) => s.setSplitViewActive);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);
  const setGestureDetected = useRigStore((s) => s.setGestureDetected);
  const openSubsystemByIndex = useRigStore((s) => s.openSubsystemByIndex);

  const [isExpanded, setIsExpanded] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [selectedSubsystemIndex, setSelectedSubsystemIndex] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize continuous voice commander on component mount
  useEffect(() => {
    jarvisVoiceCommander.start();
    return () => {
      jarvisVoiceCommander.stop();
      jarvisGestureEngine.stop();
    };
  }, []);

  // Update wake countdown timer
  useEffect(() => {
    if (!isVarunaAwake) {
      setSecondsRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const rem = Math.max(0, Math.ceil((varunaWakeExpiry - Date.now()) / 1000));
      setSecondsRemaining(rem);
      if (rem <= 0) {
        useRigStore.setState({ isVarunaAwake: false });
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isVarunaAwake, varunaWakeExpiry]);

  // Connect viewfinder canvas to dual-hand skeleton output
  useEffect(() => {
    if (!isGestureCameraActive) return;

    const unregister = jarvisGestureEngine.registerFrameCallback((result, video) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Draw mirrored camera feed
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -w, 0, w, h);
      ctx.restore();

      // Cyberpunk HUD bounding grid
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(6, 6, w - 12, h - 12);

      // Corner brackets
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(6, 16);
      ctx.lineTo(6, 6);
      ctx.lineTo(16, 6);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(w - 16, 6);
      ctx.lineTo(w - 6, 6);
      ctx.lineTo(w - 6, 16);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(6, h - 16);
      ctx.lineTo(6, h - 6);
      ctx.lineTo(16, h - 6);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(w - 16, h - 6);
      ctx.lineTo(w - 6, h - 6);
      ctx.lineTo(w - 6, h - 16);
      ctx.stroke();

      // Render Primary Hand (Cyan Skeletons & Nodes)
      if (result.primaryHand && result.primaryHand.landmarks.length > 0) {
        drawHandSkeleton(ctx, result.primaryHand.landmarks, w, h, '#00e5ff', '#ffffff');
      }

      // Render Secondary Hand (Emerald / Amber Skeletons & Nodes)
      if (result.secondaryHand && result.secondaryHand.landmarks.length > 0) {
        drawHandSkeleton(ctx, result.secondaryHand.landmarks, w, h, '#00ff88', '#ffea00');
      }

      // Render Dual Hand Spatial Tether Laser Connection
      if (result.isTwoHanded && result.primaryHand && result.secondaryHand) {
        const p1x = result.primaryHand.centroid.x * w;
        const p1y = result.primaryHand.centroid.y * h;
        const p2x = result.secondaryHand.centroid.x * w;
        const p2y = result.secondaryHand.centroid.y * h;
        const midX = result.handX * w;
        const midY = result.handY * h;

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center Midpoint Reticle
        ctx.beginPath();
        ctx.arc(midX, midY, 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 234, 0, 0.25)';
        ctx.fill();

        // Distance Tag in Viewfinder
        ctx.fillStyle = '#ffea00';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(`DIST: ${result.handDistance.toFixed(2)}`, midX - 22, midY - 12);

        ctx.restore();
      } else if (result.gesture && result.landmarks.length > 0) {
        // Single hand reticle
        const hx = result.handX * w;
        const hy = result.handY * h;

        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hx - 14, hy);
        ctx.lineTo(hx + 14, hy);
        ctx.moveTo(hx, hy - 14);
        ctx.lineTo(hx, hy + 14);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    });

    return () => unregister();
  }, [isGestureCameraActive]);

  const drawHandSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: { x: number; y: number; type?: string }[],
    w: number,
    h: number,
    boneColor: string,
    nodeColor: string
  ) => {
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = boneColor;
    ctx.strokeStyle = boneColor;
    ctx.lineWidth = 2;

    const wrist = landmarks[0];
    const palm = landmarks.find((l) => l.type === 'palm') || landmarks[9] || landmarks[0];

    // Connect wrist to fingers / palm
    if (wrist && palm) {
      ctx.beginPath();
      ctx.moveTo(wrist.x * w, wrist.y * h);
      ctx.lineTo(palm.x * w, palm.y * h);
      ctx.stroke();
    }

    landmarks.forEach((p) => {
      if (p !== wrist && p !== palm) {
        ctx.beginPath();
        ctx.moveTo(palm.x * w, palm.y * h);
        ctx.lineTo(p.x * w, p.y * h);
        ctx.stroke();
      }
    });

    // Draw Joint Nodes
    landmarks.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.strokeStyle = boneColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.restore();
  };

  const handleToggleCamera = async () => {
    if (isGestureCameraActive) {
      jarvisGestureEngine.stop();
      varunaVoice.speakCustom('Gesture camera disabled.');
    } else {
      const ok = await jarvisGestureEngine.start();
      if (ok) {
        varunaVoice.speakCustom(
          'Two-hand gesture vision active. Move both hands to pan and orbit, change distance to zoom simultaneously.'
        );
      }
    }
  };

  const handleStartDemoVision = () => {
    jarvisGestureEngine.startSynthetic();
    varunaVoice.speakCustom('Synthetic dual-hand demo vision mode active.');
  };

  // Trigger one of the 6 Core Trackable Hand Gestures
  const triggerGesture = (type: 'SPLIT' | 'MERGE' | 'MOVE' | 'ZOOM_IN' | 'ZOOM_OUT' | 'INDEX') => {
    if (type === 'SPLIT') {
      setGestureDetected('SPLIT', 0.98);
      setSplitViewActive(true);
      varunaVoice.speakCustom('Split view activated. Subsystem modules exploded.');
    } else if (type === 'MERGE') {
      setGestureDetected('MERGE', 0.98);
      setSplitViewActive(false);
      varunaVoice.speakCustom('Merge gesture activated. Reassembling full rig.');
    } else if (type === 'MOVE') {
      setGestureDetected('MOVE', 0.98);
      useRigStore.getState().setGestureSpatial({
        deltaX: 0.015,
        deltaY: -0.008,
        activeMode: 'ORBIT',
      });
      varunaVoice.speakCustom('Model move and orbit tracking engaged.');
    } else if (type === 'ZOOM_IN') {
      setGestureDetected('ZOOM_IN', 0.98);
      useRigStore.getState().setGestureSpatial({
        zoomDelta: 0.025,
        activeMode: 'ZOOM',
      });
      varunaVoice.speakCustom('Zoom in command executed.');
    } else if (type === 'ZOOM_OUT') {
      setGestureDetected('ZOOM_OUT', 0.98);
      useRigStore.getState().setGestureSpatial({
        zoomDelta: -0.025,
        activeMode: 'ZOOM',
      });
      varunaVoice.speakCustom('Zoom out command executed.');
    } else if (type === 'INDEX') {
      openSubsystemByIndex(selectedSubsystemIndex);
    }
  };

  return (
    <div className="font-mono text-xs animate-in fade-in duration-200 shrink-0">
      <div className="w-72 sm:w-80 glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 rounded-2xl p-2.5 shadow-dock backdrop-blur-2xl text-white">
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-reliance-cyan/20">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-reliance-cyan animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-reliance-cyan flex items-center gap-1">
              <span>VARUNA DUAL-HAND VISION</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 rounded hover:bg-white/10 text-reliance-cyan cursor-pointer transition-all"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-2 text-[10px]">
            {/* VARUNA WAKE WORD STATUS BANNER */}
            <div
              className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                isVarunaAwake
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-cyan-glow'
                  : 'bg-reliance-navy/60 border-white/10 text-reliance-textMuted'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isVarunaAwake ? 'bg-emerald-400 animate-ping' : 'bg-white/30'
                  }`}
                />
                <div>
                  <div className="font-extrabold tracking-wide">
                    {isVarunaAwake ? 'VARUNA AWAKE' : 'VARUNA SLEEPING'}
                  </div>
                  <div className="text-[8px] opacity-80">
                    {isVarunaAwake
                      ? `Listening: ${secondsRemaining}s remaining`
                      : 'Say "Varuna" to wake up'}
                  </div>
                </div>
              </div>

              <button
                onClick={wakeVaruna}
                className="px-2 py-1 rounded-lg bg-reliance-blue/70 hover:bg-reliance-blue border border-reliance-cyan/40 text-white font-bold text-[9px] transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                title="Manually wake Varuna AI"
              >
                <Power className="w-2.5 h-2.5 text-emerald-300" />
                <span>WAKE</span>
              </button>
            </div>

            {/* Live Transcript / Speech Indicator */}
            <div className="p-1.5 rounded-lg bg-black/60 border border-white/10 flex items-center gap-1.5">
              <Mic
                className={`w-3 h-3 shrink-0 ${
                  isListeningSpeech ? 'text-purple-400 animate-pulse' : 'text-reliance-textMuted'
                }`}
              />
              <div className="truncate italic text-[9px] text-white/80">
                {voiceTranscript ? `"${voiceTranscript}"` : 'Say: "Varuna open helipad", "Varuna open crane 1"...'}
              </div>
            </div>

            {/* Gesture Camera Viewfinder Box */}
            {isGestureCameraActive ? (
              <div className="space-y-1.5">
                <div className="relative w-full h-28 rounded-lg bg-black/90 overflow-hidden border border-reliance-cyan/40 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={260}
                    height={140}
                    className="w-full h-full object-cover"
                  />

                  {/* Active Dual-Hand & Gesture Detection Badges */}
                  <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                    <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-reliance-cyan font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        {gestureSpatial?.handsCount >= 2
                          ? '2 HANDS TRACKING'
                          : gestureSpatial?.handsCount === 1
                          ? '1 HAND TRACKING'
                          : 'SEARCHING HANDS...'}
                      </span>
                    </div>

                    <div className="bg-black/80 border border-amber-400/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-amber-300 font-bold">
                      {gestureDetected ? `[${gestureDetected}]` : '[STANDBY]'}
                    </div>
                  </div>

                  {/* Mode & FPS info */}
                  <div className="absolute bottom-1 right-1 text-[7px] text-emerald-400 bg-black/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {gestureSpatial?.activeMode === 'DUAL_MOVE_ZOOM'
                      ? '⚡ SIMULTANEOUS MOVE+ZOOM'
                      : isSyntheticCameraActive
                      ? 'DEMO SIMULATOR 60 FPS'
                      : 'WEBCAM MULTI-TRACK 30 FPS'}
                  </div>
                </div>

                {/* 6 IDENTIFIABLE & TRACKABLE GESTURES BAR */}
                <div className="space-y-1 bg-black/40 p-1.5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between text-[8px] font-bold text-reliance-cyan">
                    <span>6 RECOGNIZED GESTURES:</span>
                    <span className="text-white/60">CLICK OR PERFORM IN CAM</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[8px]">
                    <button
                      onClick={() => triggerGesture('SPLIT')}
                      className={`p-1 rounded border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        isSplitViewActive
                          ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold'
                          : 'bg-reliance-navy/50 border-white/15 text-white/80 hover:bg-reliance-blue/50'
                      }`}
                      title="Gesture 1: Two hands spreading apart -> Exploded Split View"
                    >
                      <Layers className="w-2.5 h-2.5 text-amber-400" />
                      <span>1. Split</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('MERGE')}
                      className={`p-1 rounded border flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        !isSplitViewActive
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 font-bold'
                          : 'bg-reliance-navy/50 border-white/15 text-white/80 hover:bg-reliance-blue/50'
                      }`}
                      title="Gesture 2: Closed fist / Hands together -> Reassemble Digital Twin"
                    >
                      <Minimize2 className="w-2.5 h-2.5 text-emerald-400" />
                      <span>2. Merge</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('MOVE')}
                      className="p-1 rounded bg-reliance-navy/50 hover:bg-reliance-blue/50 border border-white/15 text-white/80 flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="Gesture 3: Move hand in (x,y) -> Continuous 3D Rotate & Pan"
                    >
                      <Move className="w-2.5 h-2.5 text-cyan-400" />
                      <span>3. Move</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('ZOOM_IN')}
                      className="p-1 rounded bg-reliance-navy/50 hover:bg-reliance-blue/50 border border-white/15 text-white/80 flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="Gesture 4: Hands moving apart / Pinch spread -> Zoom In"
                    >
                      <ZoomIn className="w-2.5 h-2.5 text-blue-400" />
                      <span>4. Zoom In</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('ZOOM_OUT')}
                      className="p-1 rounded bg-reliance-navy/50 hover:bg-reliance-blue/50 border border-white/15 text-white/80 flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="Gesture 5: Hands moving closer / Pinch close -> Zoom Out"
                    >
                      <ZoomOut className="w-2.5 h-2.5 text-blue-400" />
                      <span>5. Zoom Out</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('INDEX')}
                      className="p-1 rounded bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/40 text-purple-200 flex items-center justify-center gap-1 cursor-pointer transition-all font-bold"
                      title="Gesture 6: Finger count 1-5 -> Open Subsystem Index"
                    >
                      <FolderOpen className="w-2.5 h-2.5 text-purple-300" />
                      <span>6. Index [{selectedSubsystemIndex}]</span>
                    </button>
                  </div>

                  {/* Finger Count Subsystem Index Selector */}
                  <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-1 text-[7.5px]">
                    <span className="text-white/60">INDEX:</span>
                    {[
                      { idx: 1, name: '1: Helipad' },
                      { idx: 2, name: '2: Crane 1' },
                      { idx: 3, name: '3: Crane 2' },
                      { idx: 4, name: '4: Dock' },
                      { idx: 5, name: '5: Quarters' },
                    ].map((item) => (
                      <button
                        key={item.idx}
                        onClick={() => {
                          setSelectedSubsystemIndex(item.idx);
                          openSubsystemByIndex(item.idx);
                        }}
                        className={`px-1 py-0.5 rounded border transition-all cursor-pointer ${
                          selectedSubsystemIndex === item.idx
                            ? 'bg-purple-500/40 border-purple-400 text-white font-bold'
                            : 'bg-black/30 border-white/10 text-white/70 hover:border-white/30'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-reliance-navy/50 border border-white/10 text-center space-y-2">
                <div className="text-[9px] text-reliance-textMuted">
                  {cameraErrorMessage ? (
                    <span className="text-amber-300">⚠️ {cameraErrorMessage}</span>
                  ) : (
                    'Dual-Hand Tracking & 6 Gestures Ready'
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleCamera}
                    disabled={cameraPermissionState === 'requesting'}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-reliance-blue/70 hover:bg-reliance-blue border border-reliance-cyan/50 text-[9px] font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-cyan-glow disabled:opacity-50"
                  >
                    <Video className="w-3 h-3 text-reliance-cyan" />
                    <span>{cameraPermissionState === 'requesting' ? 'CONNECTING...' : 'START WEBCAM'}</span>
                  </button>

                  <button
                    onClick={handleStartDemoVision}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-[9px] font-bold text-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    <span>DEMO VISION</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Action Grid */}
            <div className="grid grid-cols-2 gap-1 pt-0.5">
              <button
                onClick={() => setSplitViewActive(!isSplitViewActive)}
                className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSplitViewActive
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold shadow-amber-glow'
                    : 'bg-reliance-navy/50 border-white/10 text-white/80 hover:border-amber-400/40'
                }`}
              >
                <span>{isSplitViewActive ? 'ASSEMBLE' : 'SPLIT RIG'}</span>
                <Layers className="w-3 h-3 text-amber-400" />
              </button>

              <button
                onClick={() => setPipeSliced(!isPipeSliced)}
                className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isPipeSliced
                    ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold shadow-cyan-glow'
                    : 'bg-reliance-navy/50 border-white/10 text-white/80 hover:border-cyan-400/40'
                }`}
              >
                <span>{isPipeSliced ? 'CLOSE SLICE' : 'SLICE PIPE 1'}</span>
                <Scissors className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
