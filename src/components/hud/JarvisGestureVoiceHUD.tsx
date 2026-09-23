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
  FolderOpen,
  Power,
  Hand,
  Crosshair,
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
  const targetedPartId = useRigStore((s) => s.targetedPartId);
  const pointerCursor = useRigStore((s) => s.pointerCursor);

  const setSplitViewActive = useRigStore((s) => s.setSplitViewActive);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);
  const setGestureDetected = useRigStore((s) => s.setGestureDetected);
  const openSubsystemByIndex = useRigStore((s) => s.openSubsystemByIndex);
  const openNextSubsystemView = useRigStore((s) => s.openNextSubsystemView);

  const [isExpanded, setIsExpanded] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [selectedSubsystemIndex, setSelectedSubsystemIndex] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    jarvisVoiceCommander.start();
    return () => {
      jarvisVoiceCommander.stop();
      jarvisGestureEngine.stop();
    };
  }, []);

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

  // Connect viewfinder canvas to dual-hand skeleton output with Jarvis Holographic UI
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

      // Render Hand 1 (Cyan)
      if (result.primaryHand && result.primaryHand.landmarks.length > 0) {
        const hand = result.primaryHand;
        drawHandSkeleton(ctx, hand.landmarks, w, h, '#00e5ff', '#ffffff');

        // Hand Role Tag
        const hx = hand.centroid.x * w;
        const hy = hand.centroid.y * h;
        ctx.fillStyle = hand.role === 'ZOOM' ? '#ff00ff' : '#00ffff';
        ctx.font = 'bold 7.5px monospace';
        ctx.fillText(
          hand.role === 'ZOOM' ? 'HAND 1 [ZOOM CONTROLLER]' : 'HAND 1 [ORBIT CONTROLLER]',
          Math.max(8, hx - 45),
          Math.max(16, hy - 16)
        );

        // Holographic Pinch Arc if Zooming
        if (hand.role === 'ZOOM' && hand.thumbTip && hand.indexTip) {
          ctx.beginPath();
          ctx.moveTo(hand.thumbTip.x * w, hand.thumbTip.y * h);
          ctx.lineTo(hand.indexTip.x * w, hand.indexTip.y * h);
          ctx.strokeStyle = '#ff00ff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Render Hand 2 (Emerald/Yellow)
      if (result.secondaryHand && result.secondaryHand.landmarks.length > 0) {
        const hand = result.secondaryHand;
        drawHandSkeleton(ctx, hand.landmarks, w, h, '#00ff88', '#ffea00');

        const hx = hand.centroid.x * w;
        const hy = hand.centroid.y * h;
        ctx.fillStyle = hand.role === 'ZOOM' ? '#ff00ff' : '#00ff88';
        ctx.font = 'bold 7.5px monospace';
        ctx.fillText(
          hand.role === 'ZOOM' ? 'HAND 2 [ZOOM CONTROLLER]' : 'HAND 2 [ORBIT CONTROLLER]',
          Math.max(8, hx - 45),
          Math.max(16, hy - 16)
        );

        if (hand.role === 'ZOOM' && hand.thumbTip && hand.indexTip) {
          ctx.beginPath();
          ctx.moveTo(hand.thumbTip.x * w, hand.thumbTip.y * h);
          ctx.lineTo(hand.indexTip.x * w, hand.indexTip.y * h);
          ctx.strokeStyle = '#ff00ff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
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
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center Midpoint Reticle
        ctx.beginPath();
        ctx.arc(midX, midY, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 234, 0, 0.25)';
        ctx.fill();

        ctx.fillStyle = '#ffea00';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(`DIST: ${result.handDistance.toFixed(2)}`, midX - 20, midY - 10);

        ctx.restore();
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
    ctx.lineWidth = 1.8;

    const wrist = landmarks[0];
    const palm = landmarks.find((l) => l.type === 'palm') || landmarks[9] || landmarks[0];

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

    landmarks.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 2.8, 0, Math.PI * 2);
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
          'Jarvis spatial holographic vision online. Pinch in to zoom out, pinch out to zoom in, and move model with your other hand.'
        );
      }
    }
  };

  const handleStartDemoVision = () => {
    jarvisGestureEngine.startSynthetic();
    varunaVoice.speakCustom(
      'Jarvis decoupled dual-hand demo online: left hand zooming, right hand orbiting model.'
    );
  };

  const triggerGesture = (
    type:
      | 'SPLIT'
      | 'MERGE'
      | 'MOVE'
      | 'PINCH_IN'
      | 'PINCH_OUT'
      | 'INDEX'
      | 'JARVIS_DUAL'
      | 'PALM'
      | 'SWIPE_LEFT'
  ) => {
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
    } else if (type === 'PINCH_OUT') {
      // Pinch out -> Zoom in
      setGestureDetected('ZOOM_IN', 0.98);
      useRigStore.getState().setGestureSpatial({
        zoomDelta: 0.028,
        activeMode: 'ZOOM',
      });
      varunaVoice.speakCustom('Pinch out recognized: Zooming in.');
    } else if (type === 'PINCH_IN') {
      // Pinch in -> Zoom out
      setGestureDetected('ZOOM_OUT', 0.98);
      useRigStore.getState().setGestureSpatial({
        zoomDelta: -0.028,
        activeMode: 'ZOOM',
      });
      varunaVoice.speakCustom('Pinch in recognized: Zooming out.');
    } else if (type === 'PALM') {
      // Open Palm -> Instant freeze in place
      setGestureDetected('PALM', 0.99);
      useRigStore.getState().setGestureSpatial({
        deltaX: 0,
        deltaY: 0,
        zoomDelta: 0,
        activeMode: 'IDLE',
      });
      varunaVoice.speakCustom('Open palm recognized: Camera frozen immediately in place.');
    } else if (type === 'SWIPE_LEFT') {
      // Swipe Left -> Open targeted/next subsystem inspection deck
      setGestureDetected('SWIPE_LEFT', 0.99);
      openNextSubsystemView();
    } else if (type === 'JARVIS_DUAL') {
      // Decoupled dual hand: Left Zoom In + Right Orbit
      setGestureDetected('ZOOM_IN', 0.98);
      useRigStore.getState().setGestureSpatial({
        deltaX: 0.012,
        deltaY: -0.006,
        zoomDelta: 0.022,
        activeMode: 'JARVIS_DECOUPLED_DUAL',
      });
      varunaVoice.speakCustom('Jarvis decoupled mode: Simultaneous one-hand zoom, one-hand move.');
    } else if (type === 'INDEX') {
      openSubsystemByIndex(selectedSubsystemIndex);
    }
  };

  return (
    <div className="font-mono text-xs animate-in fade-in duration-200 shrink-0">
      <div className="w-76 sm:w-84 glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 rounded-2xl p-2.5 shadow-dock backdrop-blur-2xl text-white">
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-reliance-cyan/20">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-reliance-cyan animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-reliance-cyan flex items-center gap-1">
              <span>JARVIS DUAL-HAND HOLOGRAPHIC VISION</span>
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
              <div className={`truncate italic text-[9px] ${isVarunaAwake ? "text-emerald-300" : "text-white/40"}`}>
                {isVarunaAwake
                  ? (voiceTranscript ? `"${voiceTranscript}"` : '🎙️ Listening... say your command')
                  : '💤 Say "Varuna" to activate...'}
              </div>
            </div>

            {/* Gesture Camera Viewfinder Box */}
            {isGestureCameraActive ? (
              <div className="space-y-1.5">
                <div className="relative w-full h-28 rounded-lg bg-black/90 overflow-hidden border border-reliance-cyan/40 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={280}
                    height={140}
                    className="w-full h-full object-cover"
                  />

                  {/* Holographic Laser Pointer Cursor (ORBIT hand index fingertip) */}
                  {pointerCursor?.active && (
                    <div
                      className="absolute pointer-events-none z-10"
                      style={{
                        left: `${pointerCursor.x * 100}%`,
                        top: `${pointerCursor.y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-cyan-400 opacity-90 absolute -translate-x-1/2 -translate-y-1/2" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white absolute -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  )}

                  {/* Active Dual-Hand & Gesture Detection Badges */}
                  <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                    <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-reliance-cyan font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        {gestureSpatial?.handsCount >= 2
                          ? '2 HANDS TRACKED (DECOUPLED)'
                          : gestureSpatial?.handsCount === 1
                          ? '1 HAND TRACKED'
                          : 'SEARCHING HANDS...'}
                      </span>
                    </div>

                    <div className="bg-black/80 border border-amber-400/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-amber-300 font-bold">
                      {gestureDetected ? `[${gestureDetected}]` : '[STANDBY]'}
                    </div>
                  </div>

                  {/* Mode & FPS info */}
                  <div className="absolute bottom-1 right-1 text-[7px] text-emerald-400 bg-black/85 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {gestureSpatial?.activeMode === 'JARVIS_DECOUPLED_DUAL'
                      ? '🤖 RIGHT=ZOOM (✌️🤙) | LEFT=ORBIT (👆🤚)'
                      : gestureSpatial?.activeMode === 'DUAL_MOVE_ZOOM'
                      ? '⚡ SIMULTANEOUS MOVE+ZOOM'
                      : isSyntheticCameraActive
                      ? 'DEMO SIMULATOR 60 FPS'
                      : 'WEBCAM MULTI-TRACK 30 FPS'}
                  </div>
                </div>

                {/* Holographic Target Lock Readout Banner */}
                {targetedPartId && (
                  <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-400/80 flex items-center justify-between shadow-cyan-glow animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-cyan-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-extrabold text-[8.5px] tracking-wide">
                        🎯 LOCKED: [{targetedPartId.toUpperCase().replace('_', ' ')}]
                      </span>
                    </div>
                    <button
                      onClick={() => triggerGesture('SWIPE_LEFT')}
                      className="px-2 py-0.5 rounded bg-cyan-500/40 hover:bg-cyan-500/60 border border-cyan-300 text-white font-bold text-[8px] cursor-pointer shadow-sm flex items-center gap-1"
                      title="Inspect locked component"
                    >
                      <span>SWIPE LEFT ◀</span>
                    </button>
                  </div>
                )}

                {/* JARVIS DECOUPLED ACTIONS & 6 CORE GESTURES BAR */}
                <div className="space-y-1 bg-black/40 p-1.5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between text-[8px] font-bold text-reliance-cyan">
                    <span>JARVIS HOLOGRAPHIC CONTROLS:</span>
                    <span className="text-white/60">PINCH / MOVE MATRIX</span>
                  </div>

                  {/* Top Row: Decoupled Jarvis & Pinch Controls */}
                  <div className="grid grid-cols-3 gap-1 text-[8px]">
                    <button
                      onClick={() => triggerGesture('PINCH_OUT')}
                      className="p-1 rounded bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/40 text-blue-200 flex items-center justify-center gap-1 cursor-pointer transition-all font-bold"
                      title="Pinch Out (fingers spread apart) -> Zoom In"
                    >
                      <ZoomIn className="w-2.5 h-2.5 text-blue-400" />
                      <span>🤏 Pinch Out (+Zoom)</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('PINCH_IN')}
                      className="p-1 rounded bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 flex items-center justify-center gap-1 cursor-pointer transition-all font-bold"
                      title="Pinch In (fingers close together) -> Zoom Out"
                    >
                      <ZoomOut className="w-2.5 h-2.5 text-indigo-400" />
                      <span>🤏 Pinch In (-Zoom)</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('JARVIS_DUAL')}
                      className="p-1 rounded bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/50 text-purple-200 flex items-center justify-center gap-1 cursor-pointer transition-all font-bold shadow-cyan-glow"
                      title="Complete Jarvis Copy: Left Hand Zoom + Right Hand Move simultaneously"
                    >
                      <Crosshair className="w-2.5 h-2.5 text-purple-300 animate-spin" />
                      <span>🤖 Jarvis Dual Mode</span>
                    </button>
                  </div>

                  {/* Second Row: Split, Merge, Move */}
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
                      <span>1. Split Rig</span>
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
                      <Hand className="w-2.5 h-2.5 text-emerald-400" />
                      <span>2. Merge Rig</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('MOVE')}
                      className="p-1 rounded bg-reliance-navy/50 hover:bg-reliance-blue/50 border border-white/15 text-white/80 flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="Gesture 3: Move hand in (x,y) -> Continuous 3D Rotate & Pan"
                    >
                      <Move className="w-2.5 h-2.5 text-cyan-400" />
                      <span>3. Move (X,Y)</span>
                    </button>
                  </div>

                  {/* Third Row: Swipe Left & Open Palm Freeze */}
                  <div className="grid grid-cols-2 gap-1 text-[8px]">
                    <button
                      onClick={() => triggerGesture('SWIPE_LEFT')}
                      className="p-1 rounded bg-teal-500/25 hover:bg-teal-500/40 border border-teal-400/40 text-teal-200 flex items-center justify-center gap-1 cursor-pointer transition-all font-bold"
                      title="Swipe Left: Open targeted component / Next subsystem"
                    >
                      <FolderOpen className="w-2.5 h-2.5 text-teal-300" />
                      <span>◀ Swipe Left (Open View)</span>
                    </button>

                    <button
                      onClick={() => triggerGesture('PALM')}
                      className="p-1 rounded bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/40 text-rose-200 flex items-center justify-center gap-1 cursor-pointer transition-all font-bold"
                      title="Open Palm: Instantly stop and freeze camera in place"
                    >
                      <Hand className="w-2.5 h-2.5 text-rose-300" />
                      <span>🖐️ Open Palm (Freeze)</span>
                    </button>
                  </div>

                  {/* Subsystem Index Quick Bar */}
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
                    'Jarvis Holographic Tracking Ready: Pinch In/Out & Decoupled Hands'
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleCamera}
                    disabled={cameraPermissionState === 'requesting'}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-reliance-blue/70 hover:bg-reliance-blue border border-reliance-cyan/50 text-[9px] font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-cyan-glow disabled:opacity-50"
                  >
                    <Video className="w-3 h-3 text-reliance-cyan" />
                    <span>
                      {cameraPermissionState === 'requesting' ? 'CONNECTING...' : 'START WEBCAM'}
                    </span>
                  </button>

                  <button
                    onClick={handleStartDemoVision}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-[9px] font-bold text-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    <span>JARVIS DEMO</span>
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
