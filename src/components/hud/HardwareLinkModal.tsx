import React, { useState } from 'react';
import {
  X,
  Cpu,
  Radio,
  Cable,
  Server,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Activity,
  Zap,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const HardwareLinkModal: React.FC = () => {
  const isHardwareModalOpen = useRigStore((s) => s.isHardwareModalOpen);
  const setHardwareModalOpen = useRigStore((s) => s.setHardwareModalOpen);

  const hardwareMode = useRigStore((s) => s.hardwareMode);
  const setHardwareMode = useRigStore((s) => s.setHardwareMode);

  const [wsUrl, setWsUrl] = useState<string>('wss://scada.kggas.reliance.in/telemetry/v1');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [packetsCount, setPacketsCount] = useState<number>(48291);

  if (!isHardwareModalOpen) return null;

  const handleSelectMode = (mode: 'simulation' | 'websocket' | 'webserial' | 'blackbox_csv') => {
    setHardwareMode(mode);
    varunaVoice.playSonarPing(880, 0.1);
    if (mode === 'webserial') {
      varunaVoice.speakCustom('WebSerial hardware bridge selected. Ready to pair physical USB sensor telemetry.');
    } else if (mode === 'websocket') {
      varunaVoice.speakCustom('WebSocket SCADA MQTT broker selected.');
    } else if (mode === 'blackbox_csv') {
      varunaVoice.speakCustom('Subsea Blackbox CSV flight recorder replay mode engaged.');
    } else {
      varunaVoice.speakCustom('Synthetic 10 Hertz physics mathematical simulation active.');
    }
  };

  const handleToggleConnect = () => {
    setIsConnected(!isConnected);
    varunaVoice.playSonarPing(isConnected ? 440 : 920, 0.15);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 shadow-dock text-white font-sans flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-reliance-cyan/20 bg-reliance-navy/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-blue/50 border border-reliance-cyan/40 text-reliance-cyan shadow-cyan-glow">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/30 font-bold uppercase">
                  HARDWARE ABSTRACTION LAYER (HAL)
                </span>
                <span className="text-xs text-reliance-textMuted font-mono">
                  {hardwareMode.toUpperCase()}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Universal Hardware Bridge & SCADA Telemetry Gateway
              </h2>
            </div>
          </div>

          <button
            onClick={() => setHardwareModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-sm font-sans">
          {/* 1. Hardware Mode Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                id: 'simulation',
                title: 'Synthetic Sim',
                sub: '10 Hz Physics',
                icon: <Radio className="w-4 h-4 text-emerald-400" />,
              },
              {
                id: 'webserial',
                title: 'WebSerial USB',
                sub: 'COM / FTDI / PLC',
                icon: <Cable className="w-4 h-4 text-reliance-cyan" />,
              },
              {
                id: 'websocket',
                title: 'WebSocket MQTT',
                sub: 'SCADA Telemetry',
                icon: <Server className="w-4 h-4 text-purple-400" />,
              },
              {
                id: 'blackbox_csv',
                title: 'Blackbox Replay',
                sub: 'CSV Flight Log',
                icon: <FileSpreadsheet className="w-4 h-4 text-amber-400" />,
              },
            ].map((m) => {
              const isSelected = hardwareMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelectMode(m.id as any)}
                  className={`p-3 rounded-xl text-left font-mono transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-reliance-blue/60 border-reliance-cyan text-white shadow-cyan-glow font-bold'
                      : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white hover:border-reliance-cyan/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {m.icon}
                    <span className="text-xs font-bold">{m.title}</span>
                  </div>
                  <div className="text-[9px] text-white/50">{m.sub}</div>
                </button>
              );
            })}
          </div>

          {/* 2. Connection Specific Parameters */}
          {hardwareMode === 'webserial' && (
            <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-reliance-cyan font-bold">
                  USB SERIAL INTERFACE (WebSerial API)
                </span>
                <span className="text-[10px] font-mono text-emerald-400">STATUS: READY TO PAIR</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-reliance-textMuted block mb-1">
                    BAUD RATE (BPS):
                  </label>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-reliance-dark border border-white/20 text-white font-mono text-xs"
                  >
                    <option value={9600}>9600 Baud</option>
                    <option value={115200}>115200 Baud (Default)</option>
                    <option value={921600}>921600 Baud (High Speed)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-reliance-textMuted block mb-1">
                    DEVICE HANDSHAKE:
                  </label>
                  <div className="text-xs font-mono py-2 px-3 rounded-lg bg-reliance-dark border border-white/10 text-reliance-textMuted">
                    8 Data Bits, 1 Stop Bit, No Parity
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    if ('serial' in navigator) {
                      await (navigator as any).serial.requestPort();
                      varunaVoice.speakCustom('USB COM Port selected. Handshake established.');
                    } else {
                      alert('WebSerial API is supported in Chrome/Edge. Simulation fallback remains active.');
                    }
                  } catch (e) {
                    console.log('WebSerial request cancelled or unsupported');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-reliance-blue hover:bg-reliance-blue/80 border border-reliance-cyan text-xs font-mono font-bold text-white shadow-cyan-glow transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Cable className="w-4 h-4" />
                <span>PAIR USB HARDWARE SENSOR PORT</span>
              </button>
            </div>
          )}

          {hardwareMode === 'websocket' && (
            <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30 space-y-3">
              <span className="text-xs font-mono text-reliance-cyan font-bold block">
                SCADA / MQTT WEBSOCKET ENDPOINT
              </span>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-reliance-dark border border-white/20 text-white font-mono text-xs"
              />
            </div>
          )}

          {hardwareMode === 'blackbox_csv' && (
            <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30 space-y-3">
              <span className="text-xs font-mono text-reliance-cyan font-bold block">
                BLACKBOX CSV FLIGHT RECORDER REPLAY
              </span>
              <div className="p-3 rounded-lg bg-reliance-dark border border-white/10 text-xs text-reliance-textMuted leading-relaxed">
                7-Day continuous 10 Hz telemetry replay loaded from indexed local database (50,000+ cached subsea records).
              </div>
            </div>
          )}

          {/* 3. Live Hardware Stream Telemetry Status */}
          <div className="p-3.5 rounded-xl bg-reliance-dark/90 border border-reliance-cyan/20 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-white font-bold">{isConnected ? 'ONLINE & STREAMING' : 'DISCONNECTED'}</span>
            </div>
            <div className="text-reliance-textMuted">
              PACKETS: <strong className="text-reliance-cyan">{(packetsCount + Math.floor(Math.random() * 10)).toLocaleString()}</strong>
            </div>
            <div className="text-reliance-textMuted">
              LATENCY: <strong className="text-emerald-400">1.8 ms</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-reliance-cyan/20">
            <button
              onClick={handleToggleConnect}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer border ${
                isConnected
                  ? 'bg-rose-500/20 border-rose-400 text-rose-300 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 border-emerald-400 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isConnected ? 'DISCONNECT STREAM' : 'RECONNECT STREAM'}</span>
            </button>

            <button
              onClick={() => setHardwareModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-reliance-blue/60 hover:bg-reliance-blue border border-reliance-cyan/40 text-xs font-mono font-bold text-white transition-all cursor-pointer"
            >
              CLOSE GATEWAY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
