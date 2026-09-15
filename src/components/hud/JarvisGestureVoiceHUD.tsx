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
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { jarvisGestureEngine } from '../../vision/JarvisGestureVisionEngine';
import { jarvisVoiceCommander } from '../../voice/JarvisVoiceCommander';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const JarvisGestureVoiceHUD: React.FC = () => {
  const isGestureCameraActive = useRigStore((s) => s.isGestureCameraActive);
  const gestureDetected = useRigStore((s) => s.gestureDetected);
  const isVoiceCommanderActive = useRigStore((s) => s.isVoiceCommanderActive);
  const isListeningSpeech = useRigStore((s) => s.isListeningSpeech);
  const voiceTranscript = useRigStore((s) => s.voiceTranscript);
  const lastVoiceCommand = useRigStore((s) => s.lastVoiceCommand);
  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);

  const setSplitViewActive = useRigStore((s) => s.setSplitViewActive);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);
  const executeVoiceCommand = useRigStore((s) => s.executeVoiceCommand);

  const [isExpanded, setIsExpanded] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize continuous voice commander on component mount
  useEffect(() => {
    jarvisVoiceCommander.start();
    return () => {
      jarvisVoiceCommander.stop();
      jarvisGestureEngine.stop();
    };
  }, []);

  // Connect viewfinder canvas to gesture engine output
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

      // Cyberpunk Jarvis HUD overlay
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, w - 16, h - 16);

      // Corner brackets
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(8, 20);
      ctx.lineTo(8, 8);
      ctx.lineTo(20, 8);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(w - 20, 8);
      ctx.lineTo(w - 8, 8);
      ctx.lineTo(w - 8, 20);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(8, h - 20);
      ctx.lineTo(8, h - 8);
      ctx.lineTo(20, h - 8);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(w - 20, h - 8);
      ctx.lineTo(w - 8, h - 8);
      ctx.lineTo(w - 8, h - 20);
      ctx.stroke();

      // Draw tracking reticle & hand skeleton landmarks
      if (result.gesture) {
        const hx = result.handX * w;
        const hy = result.handY * h;

        // Draw connecting skeleton bones
        if (result.landmarks.length >= 5) {
          const palmPt = result.landmarks.find((l) => l.type === 'palm') || result.landmarks[0];
          const wristPt = result.landmarks.find((l) => l.type === 'wrist') || result.landmarks[4];

          ctx.strokeStyle = 'rgba(0, 255, 136, 0.65)';
          ctx.lineWidth = 1.5;

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

        // Glowing center reticle
        ctx.beginPath();
        ctx.arc(hx, hy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 255, 255, 0.25)';
        ctx.fill();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(hx - 20, hy);
        ctx.lineTo(hx + 20, hy);
        ctx.moveTo(hx, hy - 20);
        ctx.lineTo(hx, hy + 20);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw finger landmark nodes
        result.landmarks.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#00ff88';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
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

  const handleToggleVoice = () => {
    jarvisVoiceCommander.toggle();
    if (!isVoiceCommanderActive) {
      varunaVoice.speakCustom('Jarvis voice listener online.');
    }
  };

  const cameraPermissionState = useRigStore((s) => s.cameraPermissionState);
  const openHoloModal = useRigStore((s) => s.openHoloModal);

  return (
    <div className="absolute top-16 right-4 sm:right-6 z-40 w-72 sm:w-80 glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 rounded-2xl shadow-dock backdrop-blur-2xl text-white font-sans transition-all animate-in fade-in duration-200">
      {/* HUD Header */}
      <div className="flex items-center justify-between p-2.5 border-b border-reliance-cyan/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-reliance-cyan animate-pulse" />
          <div>
            <div className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-reliance-cyan flex items-center gap-1">
              <span>JARVIS AI INTERACTION</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg hover:bg-white/10 text-reliance-cyan transition-all cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-2.5 space-y-2.5">
          {/* Gesture Camera Viewfinder Box */}
          {isGestureCameraActive ? (
            <div className="relative w-full h-32 rounded-xl bg-black/80 overflow-hidden border border-reliance-cyan/40 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={280}
                height={160}
                className="w-full h-full object-cover"
              />

              {/* Active Gesture Detection Badge */}
              <div className="absolute top-1.5 left-2 bg-reliance-deepnavy/90 border border-reliance-cyan/60 px-2 py-0.5 rounded text-[9px] font-mono text-reliance-cyan font-bold flex items-center gap-1 shadow-cyan-glow">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  GESTURE: {gestureDetected ? `[${gestureDetected}]` : 'TRACKING...'}
                </span>
              </div>

              {/* Viewfinder Status Overlay */}
              <div className="absolute bottom-1.5 right-2 text-[8px] font-mono text-emerald-400 bg-black/70 px-1.5 py-0.5 rounded">
                30 FPS • VISION ENGINE
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-reliance-navy/50 border border-white/10 text-center font-mono space-y-2">
              <div className="text-[10px] text-reliance-textMuted">
                {cameraPermissionState === 'requesting'
                  ? 'Requesting webcam access...'
                  : cameraPermissionState === 'denied'
                  ? '⚠️ Camera access blocked in browser. Click the lock/tune icon in address bar to Allow.'
                  : cameraPermissionState === 'error'
                  ? '⚠️ Unable to access camera device. Verify no other app is using it.'
                  : 'Webcam gesture tracking ready'}
              </div>
              <button
                onClick={handleToggleCamera}
                disabled={cameraPermissionState === 'requesting'}
                className="w-full py-1.5 px-3 rounded-lg bg-reliance-blue/70 hover:bg-reliance-blue border border-reliance-cyan/50 text-[11px] font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-cyan-glow disabled:opacity-50"
              >
                <Video className="w-3.5 h-3.5 text-reliance-cyan" />
                <span>
                  {cameraPermissionState === 'requesting'
                    ? 'CONNECTING CAMERA...'
                    : cameraPermissionState === 'denied'
                    ? 'RETRY CAMERA ACCESS'
                    : 'TURN ON GESTURE CAMERA'}
                </span>
              </button>
            </div>
          )}

          {/* Continuous Speech Recognition Listener Bar */}
          <div className="p-2 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/25 font-mono text-xs space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                <Mic className={`w-3.5 h-3.5 ${isListeningSpeech ? 'text-purple-400 animate-pulse' : 'text-reliance-textMuted'}`} />
                <span>JARVIS VOICE COMMANDER</span>
              </span>
              <span className={`text-[8px] px-1.5 py-0.2 rounded font-bold ${
                isVoiceCommanderActive ? 'bg-purple-500/30 text-purple-200' : 'bg-white/10 text-white/50'
              }`}>
                {isVoiceCommanderActive ? 'LISTENING' : 'OFF'}
              </span>
            </div>

            {/* Live Transcript Bubble */}
            <div className="text-[10px] text-white/90 bg-reliance-dark/80 p-1.5 rounded border border-white/10 italic truncate">
              {voiceTranscript ? (
                <span>"{voiceTranscript}"</span>
              ) : (
                <span className="text-reliance-textMuted">
                  Say: "pipe 1", "slice it", "split", "assemble"...
                </span>
              )}
            </div>
          </div>

          {/* Quick Jarvis Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
            {/* Split / Explode Button */}
            <button
              onClick={() => setSplitViewActive(!isSplitViewActive)}
              className={`p-2 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                isSplitViewActive
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-amber-glow font-bold'
                  : 'bg-reliance-navy/50 border-white/10 text-reliance-textMuted hover:text-white hover:border-amber-400/40'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="font-bold">SPLIT VIEW</span>
                <Layers className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-[8px] opacity-75">
                {isSplitViewActive ? 'DISASSEMBLED' : 'EXPLODE 6 PARTS'}
              </div>
            </button>

            {/* Slice Pipe 1 Button */}
            <button
              onClick={() => setPipeSliced(!isPipeSliced)}
              className={`p-2 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                isPipeSliced
                  ? 'bg-reliance-cyan/25 border-reliance-cyan text-white shadow-cyan-glow font-bold'
                  : 'bg-reliance-navy/50 border-white/10 text-reliance-textMuted hover:text-white hover:border-reliance-cyan/40'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="font-bold">SLICE PIPE 1</span>
                <Scissors className="w-3.5 h-3.5 text-reliance-cyan" />
              </div>
              <div className="text-[8px] opacity-75">
                {isPipeSliced ? 'CROSS-SECTION OPEN' : 'CUT AXIAL PROFILE'}
              </div>
            </button>

            {/* Target Pipe 1 Zoom */}
            <button
              onClick={() => executeVoiceCommand('pipe 1')}
              className="p-1.5 rounded-lg bg-reliance-navy/40 hover:bg-reliance-blue/40 border border-white/10 text-white text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Target className="w-3 h-3 text-reliance-cyan" />
              <span>ZOOM PIPE 1</span>
            </button>

            {/* Toggle Camera Mode */}
            <button
              onClick={handleToggleCamera}
              className="p-1.5 rounded-lg bg-reliance-navy/40 hover:bg-reliance-blue/40 border border-white/10 text-white text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isGestureCameraActive ? (
                <>
                  <VideoOff className="w-3 h-3 text-rose-400" />
                  <span>STOP CAM</span>
                </>
              ) : (
                <>
                  <Video className="w-3 h-3 text-emerald-400" />
                  <span>START CAM</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
