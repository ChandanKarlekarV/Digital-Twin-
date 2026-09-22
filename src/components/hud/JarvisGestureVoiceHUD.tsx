import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Layers,
  Scissors,
  Zap,
  Radio,
  Volume2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Target,
  Maximize2,
  Bot,
  Power,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { jarvisGestureEngine } from '../../vision/JarvisGestureVisionEngine';
import { jarvisVoiceCommander } from '../../voice/JarvisVoiceCommander';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const JarvisGestureVoiceHUD: React.FC = () => {
  const isGestureCameraActive = useRigStore((s) => s.isGestureCameraActive);
  const gestureDetected = useRigStore((s) => s.gestureDetected);
  const isVoiceCommanderActive = useRigStore((s) => s.isVoiceCommanderActive);
  const isVarunaAwake = useRigStore((s) => s.isVarunaAwake);
  const varunaWakeExpiry = useRigStore((s) => s.varunaWakeExpiry);
  const wakeVaruna = useRigStore((s) => s.wakeVaruna);
  const isListeningSpeech = useRigStore((s) => s.isListeningSpeech);
  const voiceTranscript = useRigStore((s) => s.voiceTranscript);
  const lastVoiceCommand = useRigStore((s) => s.lastVoiceCommand);
  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);

  const setSplitViewActive = useRigStore((s) => s.setSplitViewActive);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);
  const executeVoiceCommand = useRigStore((s) => s.executeVoiceCommand);

  const [isExpanded, setIsExpanded] = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
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

  // Connect viewfinder canvas to gesture engine output with neon glowing skeleton
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

      // Cyberpunk HUD overlay
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
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

      // Draw tracking reticle & neon glowing hand skeleton
      if (result.gesture && result.landmarks.length > 0) {
        const hx = result.handX * w;
        const hy = result.handY * h;

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00ff88';

        // Connecting glowing skeleton bones
        if (result.landmarks.length >= 5) {
          const palmPt = result.landmarks.find((l) => l.type === 'palm') || result.landmarks[0];
          const wristPt = result.landmarks.find((l) => l.type === 'wrist') || result.landmarks[4];

          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 2;

          // Wrist to palm
          if (wristPt && palmPt) {
            ctx.beginPath();
            ctx.moveTo(wristPt.x * w, wristPt.y * h);
            ctx.lineTo(palmPt.x * w, palmPt.y * h);
            ctx.stroke();
          }

          // Palm to fingers
          result.landmarks.forEach((pt) => {
            if (pt.type !== 'palm' && pt.type !== 'wrist') {
              ctx.beginPath();
              ctx.moveTo(palmPt.x * w, palmPt.y * h);
              ctx.lineTo(pt.x * w, pt.y * h);
              ctx.stroke();
            }
          });
        }

        // Center reticle
        ctx.beginPath();
        ctx.arc(hx, hy, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.fill();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(hx - 16, hy);
        ctx.lineTo(hx + 16, hy);
        ctx.moveTo(hx, hy - 16);
        ctx.lineTo(hx, hy + 16);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Finger nodes
        result.landmarks.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#00ff88';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        ctx.restore();
      }
    });

    return () => unregister();
  }, [isGestureCameraActive]);

  const handleToggleCamera = async () => {
    if (isGestureCameraActive) {
      jarvisGestureEngine.stop();
      varunaVoice.speakCustom('Gesture camera disabled.');
    } else {
      const ok = await jarvisGestureEngine.start();
      if (ok) {
        varunaVoice.speakCustom('Gesture recognition camera active. Open palm to orbit, pinch to zoom, two hands to split.');
      }
    }
  };

  const isSyntheticCameraActive = useRigStore((s) => s.isSyntheticCameraActive);
  const cameraPermissionState = useRigStore((s) => s.cameraPermissionState);
  const cameraErrorMessage = useRigStore((s) => s.cameraErrorMessage);
  const setGestureDetected = useRigStore((s) => s.setGestureDetected);

  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const handleStartDemoVision = () => {
    jarvisGestureEngine.startSynthetic();
    varunaVoice.speakCustom('Synthetic demo vision mode active.');
  };

  const triggerSpecificGesture = (gesture: 'PALM' | 'PINCH' | 'SPLIT' | 'SLICE' | 'POINT' | 'FIST') => {
    setGestureDetected(gesture, 0.98);
    if (gesture === 'SPLIT') setSplitViewActive(true);
    else if (gesture === 'FIST') setSplitViewActive(false);
    else if (gesture === 'SLICE') setPipeSliced(true);
    else if (gesture === 'POINT') executeVoiceCommand('varuna open pipe 1');
  };

  return (
    <div className="font-mono text-xs animate-in fade-in duration-200 shrink-0">
      <div className="w-68 sm:w-76 glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 rounded-2xl p-2.5 shadow-dock backdrop-blur-2xl text-white">
        {/* HUD Header */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-reliance-cyan/20">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-reliance-cyan animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-reliance-cyan flex items-center gap-1">
              <span>VARUNA VOICE &amp; VISION</span>
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
            <div className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
              isVarunaAwake
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-cyan-glow'
                : 'bg-reliance-navy/60 border-white/10 text-reliance-textMuted'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isVarunaAwake ? 'bg-emerald-400 animate-ping' : 'bg-white/30'}`} />
                <div>
                  <div className="font-extrabold tracking-wide">
                    {isVarunaAwake ? 'VARUNA AWAKE' : 'VARUNA SLEEPING'}
                  </div>
                  <div className="text-[8px] opacity-80">
                    {isVarunaAwake ? `Listening: ${secondsRemaining}s remaining` : 'Say "Varuna" to wake up'}
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
              <Mic className={`w-3 h-3 shrink-0 ${isListeningSpeech ? 'text-purple-400 animate-pulse' : 'text-reliance-textMuted'}`} />
              <div className="truncate italic text-[9px] text-white/80">
                {voiceTranscript ? `"${voiceTranscript}"` : 'Say: "Varuna open jarvis view", "Varuna open pipe 1"...'}
              </div>
            </div>

            {/* Gesture Camera Viewfinder Box */}
            {isGestureCameraActive ? (
              <div className="space-y-1">
                <div className="relative w-full h-24 rounded-lg bg-black/90 overflow-hidden border border-reliance-cyan/40 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={240}
                    height={120}
                    className="w-full h-full object-cover"
                  />

                  {/* Active Gesture Detection Badge */}
                  <div className="absolute top-1 left-1 bg-reliance-deepnavy/90 border border-reliance-cyan/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-reliance-cyan font-bold flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{gestureDetected ? `[${gestureDetected}]` : 'TRACKING...'}</span>
                  </div>

                  <div className="absolute bottom-1 right-1 text-[7px] text-emerald-400 bg-black/70 px-1 rounded">
                    {isSyntheticCameraActive ? 'SYNTHETIC 30 FPS' : 'WEBCAM 30 FPS'}
                  </div>
                </div>

                {/* Gesture Simulator Quick Pills */}
                <div className="flex items-center justify-between gap-1 pt-0.5 overflow-x-auto text-[8px] scrollbar-none">
                  <button
                    onClick={() => triggerSpecificGesture('PALM')}
                    className="px-1.5 py-0.5 rounded bg-reliance-navy/60 hover:bg-reliance-blue/60 border border-white/15 text-white/80 cursor-pointer"
                  >
                    ✋ Orbit
                  </button>
                  <button
                    onClick={() => triggerSpecificGesture('PINCH')}
                    className="px-1.5 py-0.5 rounded bg-reliance-navy/60 hover:bg-reliance-blue/60 border border-white/15 text-white/80 cursor-pointer"
                  >
                    🤏 Zoom
                  </button>
                  <button
                    onClick={() => triggerSpecificGesture('SPLIT')}
                    className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/40 text-amber-200 cursor-pointer"
                  >
                    👐 Split
                  </button>
                  <button
                    onClick={() => triggerSpecificGesture('SLICE')}
                    className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/40 text-cyan-200 cursor-pointer"
                  >
                    ✌️ Slice
                  </button>
                  <button
                    onClick={() => triggerSpecificGesture('FIST')}
                    className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-400/40 text-emerald-200 cursor-pointer"
                  >
                    ✊ Join
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-reliance-navy/50 border border-white/10 text-center space-y-1.5">
                <div className="text-[9px] text-reliance-textMuted">
                  {cameraErrorMessage ? (
                    <span className="text-amber-300">⚠️ {cameraErrorMessage}</span>
                  ) : (
                    'Gesture tracking ready'
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleToggleCamera}
                    disabled={cameraPermissionState === 'requesting'}
                    className="flex-1 py-1 px-2 rounded-lg bg-reliance-blue/70 hover:bg-reliance-blue border border-reliance-cyan/50 text-[9px] font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-1 shadow-cyan-glow disabled:opacity-50"
                  >
                    <Video className="w-3 h-3 text-reliance-cyan" />
                    <span>{cameraPermissionState === 'requesting' ? 'CONNECTING...' : 'WEBCAM'}</span>
                  </button>

                  <button
                    onClick={handleStartDemoVision}
                    className="flex-1 py-1 px-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-[9px] font-bold text-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    <span>DEMO</span>
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

