import React, { useEffect, useRef, useState } from 'react';
import {
  Zap,
  Mic,
  Video,
  ChevronDown,
  ChevronUp,
  Layers,
  Scissors,
  Power,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { varunaGestureEngine } from '../../vision/VarunaGestureEngine';
import { varunaVoiceCommander } from '../../voice/VarunaVoiceCommander';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

const GESTURE_GUIDE: [string, string][] = [
  ['Open palm, move', 'Rotate'],
  ['Palm still', 'Freeze'],
  ['Two hands apart', 'Zoom in'],
  ['Two hands together', 'Zoom out'],
  ['OK sign, move up', 'Zoom in'],
  ['OK sign, move down', 'Zoom out'],
  ['Thumb up', 'Layer up'],
  ['Thumb down', 'Layer down'],
  ['1 finger / point', 'Helipad or pointed part'],
  ['2 fingers', 'Crane 1'],
  ['3 fingers', 'Crane 2'],
  ['4 fingers', 'Command dock'],
  ['Thumb + pinky', 'Living quarters'],
  ['Fist', 'Open selection'],
  ['Two fists', 'Exploded view'],
];

const GESTURE_NAMES: Record<string, string> = {
  PALM: 'Freeze', MOVE: 'Rotating', ZOOM: 'Zooming', PINCH: 'OK: move to zoom', FIST: 'Fist', MERGE: 'Two fists',
  THUMB_UP: 'Layer up', THUMB_DOWN: 'Layer down', INDEX_1: '1 finger', INDEX_2: '2 fingers',
  INDEX_3: '3 fingers', INDEX_4: '4 fingers', INDEX_5: 'Thumb + pinky',
};

export const VarunaGestureVoiceHUD: React.FC = () => {
  const isGestureCameraActive = useRigStore((s) => s.isGestureCameraActive);
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
  const gestureSelection = useRigStore((s) => s.gestureSelection);
  const pointerCursor = useRigStore((s) => s.pointerCursor);

  const setSplitViewActive = useRigStore((s) => s.setSplitViewActive);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);

  const [isExpanded, setIsExpanded] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const micState = useRigStore((s) => s.micState);
  const micMessage = useRigStore((s) => s.micMessage);
  const voiceStatus = useRigStore((s) => s.voiceStatus);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    // Works at once if the microphone was allowed before; otherwise the first click starts it
    varunaVoiceCommander.start();
    const firstClick = () => {
      varunaVoice.unlock();
      const s = useRigStore.getState().micState;
      if (s !== 'listening' && s !== 'starting') varunaVoiceCommander.start();
    };
    window.addEventListener('pointerdown', firstClick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', firstClick);
      varunaVoiceCommander.stop();
      varunaGestureEngine.stop();
    };
  }, []);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    varunaVoiceCommander.ask(typed);
    setTyped('');
  };

  const micLabel: Record<string, string> = {
    listening: 'Mic on',
    starting: 'Starting mic…',
    off: 'Mic off',
    blocked: 'Mic blocked',
    unsupported: 'No voice in this browser',
    error: 'Mic problem',
  };
  const micOk = micState === 'listening';
  const showReply = voiceStatus.lastMessage && Date.now() - voiceStatus.timestamp < 30000;

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

  // Connect viewfinder canvas to dual-hand skeleton output with Varuna Holographic UI
  useEffect(() => {
    if (!isGestureCameraActive) return;

    const unregister = varunaGestureEngine.registerFrameCallback((result, video) => {
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
      ctx.strokeStyle = '#5CC2D6';
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
        drawHandSkeleton(ctx, hand.landmarks, w, h, '#5CC2D6', '#E4ECF2');

        // Hand Role Tag
        const hx = hand.centroid.x * w;
        const hy = hand.centroid.y * h;
        ctx.fillStyle = hand.role === 'ZOOM' ? '#AEE2EC' : '#5CC2D6';
        ctx.font = 'bold 7.5px monospace';
        ctx.fillText(
          `HAND 1: [${hand.gesture || 'TRACKING'}]`,
          Math.max(8, hx - 45),
          Math.max(16, hy - 16)
        );

        // Laser pointer ring on index fingertip
        if ((hand.gesture === 'INDEX_1' || (hand as any)._isPoint) && hand.indexTip) {
          ctx.beginPath();
          ctx.arc(hand.indexTip.x * w, hand.indexTip.y * h, 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#5CC2D6';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Render Hand 2 (Emerald/Yellow)
      if (result.secondaryHand && result.secondaryHand.landmarks.length > 0) {
        const hand = result.secondaryHand;
        drawHandSkeleton(ctx, hand.landmarks, w, h, '#55BB86', '#DCA444');

        const hx = hand.centroid.x * w;
        const hy = hand.centroid.y * h;
        ctx.fillStyle = hand.role === 'ZOOM' ? '#AEE2EC' : '#55BB86';
        ctx.font = 'bold 7.5px monospace';
        ctx.fillText(
          `HAND 2: [${hand.gesture || 'TRACKING'}]`,
          Math.max(8, hx - 45),
          Math.max(16, hy - 16)
        );

        if ((hand.gesture === 'INDEX_1' || (hand as any)._isPoint) && hand.indexTip) {
          ctx.beginPath();
          ctx.arc(hand.indexTip.x * w, hand.indexTip.y * h, 7, 0, Math.PI * 2);
          ctx.strokeStyle = '#55BB86';
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
        ctx.strokeStyle = '#5CC2D6';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center Midpoint Reticle
        ctx.beginPath();
        ctx.arc(midX, midY, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#DCA444';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 234, 0, 0.25)';
        ctx.fill();

        ctx.fillStyle = '#DCA444';
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
      varunaGestureEngine.stop();
      varunaVoice.speakCustom('Gesture camera disabled.');
    } else {
      const ok = await varunaGestureEngine.start();
      if (ok) {
        varunaVoice.speakCustom(
          'Gestures on. Move an open palm to rotate, stretch two hands or move an OK sign up and down to zoom, thumb up or down to change layer, and hold up fingers then make a fist to open a part.'
        );
      }
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
              <span>Voice and gestures</span>
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
                    {isVarunaAwake ? 'Listening' : 'Standing by'}
                  </div>
                  <div className="text-[8px] opacity-80">
                    {isVarunaAwake
                      ? `Listening: ${secondsRemaining}s remaining`
                      : 'Say "Varuna" to wake up'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => varunaVoiceCommander.wake()}
                className="px-2 py-1 rounded-lg bg-reliance-blue/70 hover:bg-reliance-blue border border-reliance-cyan/40 text-white font-bold text-[9px] transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                title="Turn the microphone on and listen now"
              >
                <Power className="w-2.5 h-2.5 text-emerald-300" />
                <span>WAKE</span>
              </button>
            </div>

            {/* Microphone status, with the reason when it is not listening */}
            <div
              className={`p-1.5 rounded-lg border flex items-start gap-1.5 ${
                micOk ? 'bg-black/60 border-white/10' : 'bg-warning-950 border-warning-600'
              }`}
            >
              <Mic
                className={`w-3 h-3 mt-0.5 shrink-0 ${
                  isListeningSpeech ? 'text-success-300 animate-pulse' : micOk ? 'text-ink-muted' : 'text-warning-300'
                }`}
              />
              <div className="min-w-0 text-[10px] leading-snug">
                <div className={micOk ? 'text-ink-muted' : 'text-warning-200 font-semibold'}>{micLabel[micState] ?? 'Mic'}</div>
                {!micOk && (
                  <div className="text-warning-200">
                    {micMessage ?? 'Press Wake to turn the microphone on.'}
                  </div>
                )}
                {isVarunaAwake && (
                  <div className="text-success-300 truncate">
                    You: {voiceTranscript ? `“${voiceTranscript}”` : 'listening…'}
                  </div>
                )}
                {showReply && (
                  <div className="text-ink line-clamp-3">VARUNA: {voiceStatus.lastMessage}</div>
                )}
              </div>
            </div>

            {/* Type instead of speaking (noisy rooms, browsers without speech) */}
            <form onSubmit={submitTyped} className="flex items-center gap-1">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type to ask VARUNA, e.g. is there a leak?"
                aria-label="Ask VARUNA"
                className="flex-1 min-w-0 h-7 px-2 rounded-md bg-black/60 border border-white/15 text-[11px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent-500"
              />
              <button type="submit" className="btn h-7 px-2 text-[10px]" disabled={!typed.trim()}>
                Ask
              </button>
            </form>

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

                  {/* Tracking status */}
                  <div className="absolute top-1 left-1 right-1 flex items-center justify-between gap-1 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-surface/90 border border-line text-ink-muted">
                      {gestureSpatial?.handsCount >= 2 ? 'Two hands' : gestureSpatial?.handsCount === 1 ? 'One hand' : 'Show your hand'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface/90 border border-accent-600 text-accent-200 font-medium">
                      {GESTURE_NAMES[gestureDetected ?? ''] ?? 'Ready'}
                    </span>
                  </div>
                </div>

                {/* Selected part: waits for a fist */}
                {gestureSelection && (
                  <div className="p-2 rounded-md bg-accent-950 border border-accent-600 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-accent-100">
                      Selected <strong className="font-semibold capitalize">{gestureSelection.label}</strong>
                    </span>
                    <span className="text-[10px] text-ink-muted">Make a fist to open</span>
                  </div>
                )}

                {/* Gesture guide */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-2 rounded-md bg-surface-2 border border-line text-[10px]">
                  {GESTURE_GUIDE.map(([pose, action]) => (
                    <div key={pose} className="flex justify-between gap-2">
                      <span className="text-ink">{pose}</span>
                      <span className="text-ink-muted text-right">{action}</span>
                    </div>
                  ))}
                </div>
              </div>            ) : (
              <div className="p-2.5 rounded-xl bg-reliance-navy/50 border border-white/10 text-center space-y-2">
                <div className="text-[9px] text-reliance-textMuted">
                  {cameraErrorMessage ? (
                    <span className="text-amber-300">{cameraErrorMessage}</span>
                  ) : (
                    'Start the camera to steer the rig with your hands. Fingers select a part, a fist opens it.'
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
                      {cameraPermissionState === 'requesting' ? 'Connecting...' : 'Start camera'}
                    </span>
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
                <span>{isSplitViewActive ? 'Assemble' : 'Exploded view'}</span>
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
                <span>{isPipeSliced ? 'Close section' : 'Pipe 1 section'}</span>
                <Scissors className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
