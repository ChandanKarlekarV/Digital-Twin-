import React, { useState } from 'react';
import {
  Waves,
  Wind,
  Compass,
  Zap,
  Gauge,
  ChevronUp,
  ChevronDown,
  CloudLightning,
  Play,
  Pause,
  CloudRain,
  ExternalLink,
} from 'lucide-react';
import { useRigStore, CurrentFlowPower } from '../../store/useRigStore';
import { dynamicTideEngine, TIDE_PHASES_SCHEDULE } from '../../physics/DynamicTideEngine';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const CurrentControlWidget: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const currentFlowPower = useRigStore((s) => s.currentFlowPower);
  const currentSpeedKnots = useRigStore((s) => s.currentSpeedKnots);
  const currentDirectionDeg = useRigStore((s) => s.currentDirectionDeg);
  const currentDirectionLabel = useRigStore((s) => s.currentDirectionLabel);
  const tidePhase = useRigStore((s) => s.tidePhase);
  const tidePhaseIndex = useRigStore((s) => s.tidePhaseIndex);
  const isDynamicTideCycling = useRigStore((s) => s.isDynamicTideCycling);
  const dynamicTideSecondsRemaining = useRigStore((s) => s.dynamicTideSecondsRemaining);

  const setCurrentFlowPower = useRigStore((s) => s.setCurrentFlowPower);
  const setCurrentSpeedKnots = useRigStore((s) => s.setCurrentSpeedKnots);
  const setCurrentDirectionDeg = useRigStore((s) => s.setCurrentDirectionDeg);
  const setDynamicTideCycling = useRigStore((s) => s.setDynamicTideCycling);
  const toggleWeatherPanel = useRigStore((s) => s.toggleWeatherPanel);

  const powerLevels: {
    id: CurrentFlowPower;
    label: string;
    speedText: string;
    color: string;
    bgActive: string;
    border: string;
  }[] = [
    {
      id: 'slow',
      label: 'SLOW TIDE',
      speedText: '0.6 kt (0.3 m/s)',
      color: 'text-emerald-400',
      bgActive: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
      border: 'border-emerald-500/30',
    },
    {
      id: 'moderate',
      label: 'MODERATE',
      speedText: '2.4 kt (1.2 m/s)',
      color: 'text-reliance-cyan',
      bgActive: 'bg-reliance-blue/60 border-reliance-cyan text-white shadow-cyan-glow',
      border: 'border-reliance-cyan/40',
    },
    {
      id: 'fast',
      label: 'FAST FLOW',
      speedText: '4.6 kt (2.4 m/s)',
      color: 'text-amber-400',
      bgActive: 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-amber-glow',
      border: 'border-amber-500/30',
    },
    {
      id: 'extreme',
      label: 'EXTREME SURGE',
      speedText: '8.2 kt (4.2 m/s)',
      color: 'text-orange-400',
      bgActive: 'bg-orange-500/30 border-orange-400 text-orange-200 shadow-amber-glow',
      border: 'border-orange-500/40',
    },
    {
      id: 'storm',
      label: 'CYCLONIC STORM',
      speedText: '8.8 kt (4.5 m/s)',
      color: 'text-rose-400',
      bgActive: 'bg-rose-500/35 border-rose-400 text-rose-200 shadow-red-glow animate-pulse',
      border: 'border-rose-500/50',
    },
  ];

  const cardinalButtons = [
    { label: 'N', deg: 0 },
    { label: 'NE', deg: 45 },
    { label: 'E', deg: 90 },
    { label: 'SE', deg: 135 },
    { label: 'S', deg: 180 },
    { label: 'SW', deg: 225 },
    { label: 'W', deg: 270 },
    { label: 'NW', deg: 315 },
  ];

  const handlePowerChange = (power: CurrentFlowPower) => {
    setCurrentFlowPower(power);
    varunaVoice.playSonarPing(800, 0.08);

    const speed =
      power === 'slow'
        ? '0.6'
        : power === 'moderate'
        ? '2.4'
        : power === 'fast'
        ? '4.6'
        : power === 'extreme'
        ? '8.2'
        : '8.8';
    varunaVoice.speakCustom(
      `${power.toUpperCase().replace('_', ' ')} water current active at ${speed} knots flowing towards ${currentDirectionLabel}.`
    );
  };

  const handleDirectionChange = (deg: number) => {
    setCurrentDirectionDeg(deg);
    varunaVoice.playSonarPing(650, 0.05);
  };

  return (
    <div className="absolute bottom-12 left-4 z-40 w-76 sm:w-88 glass-panel border border-reliance-cyan/35 bg-reliance-deepnavy/92 rounded-2xl shadow-dock backdrop-blur-xl text-white font-sans transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-3 border-b border-reliance-cyan/20">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-reliance-cyan animate-pulse" />
          <div>
            <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-reliance-cyan flex items-center gap-1.5">
              <span>WATER STREAM & TIDES</span>
            </h3>
            <div className="text-[10px] font-mono text-reliance-textMuted flex items-center gap-2">
              <span>
                FLOW: <strong className="text-white">{currentDirectionLabel}</strong>
              </span>
              <span>•</span>
              <span>
                SPD: <strong className="text-emerald-400">{currentSpeedKnots.toFixed(1)} kt</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Dropdown Trigger Box */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-2 py-1 rounded-lg bg-reliance-navy/80 hover:bg-reliance-blue/60 border border-reliance-cyan/40 text-[10px] font-mono text-reliance-cyan flex items-center gap-1 transition-all cursor-pointer shadow-cyan-glow"
              title="Quick Ocean Current & Metocean Presets Dropdown"
            >
              <span className="capitalize font-bold">{currentFlowPower}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Beside Stream */}
            {isDropdownOpen && (
              <div className="absolute bottom-full mb-1 left-0 w-64 rounded-xl glass-panel border border-reliance-cyan/50 bg-reliance-deepnavy/98 p-1.5 shadow-dock backdrop-blur-2xl z-50 text-xs font-mono animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="px-2 py-1 text-[9px] text-reliance-textMuted uppercase font-bold border-b border-white/10 mb-1">
                  METOCEAN STREAM PRESETS
                </div>
                {powerLevels.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      handlePowerChange(p.id);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between mb-0.5 ${
                      currentFlowPower === p.id
                        ? 'bg-reliance-cyan/20 text-reliance-cyan font-bold border border-reliance-cyan/40'
                        : 'hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className="text-[9px] opacity-70">{p.speedText.split(' ')[0]} kt</span>
                  </button>
                ))}

                <div className="border-t border-white/10 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setDynamicTideCycling(!isDynamicTideCycling);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 text-amber-300 font-bold transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>10s Dynamic Cycle</span>
                    </span>
                    <span className="text-[9px] bg-amber-500/20 px-1 py-0.5 rounded">
                      {isDynamicTideCycling ? 'ACTIVE' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg hover:bg-white/10 text-reliance-cyan transition-all cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Dynamic 10-Second Tide Cycling Status Bar */}
          <div className="p-2.5 rounded-xl bg-reliance-cyan/10 border border-reliance-cyan/30 text-[10px] font-mono space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-reliance-cyan font-bold">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span>10s DYNAMIC TIDE PHASE</span>
              </span>
              <button
                onClick={() => setDynamicTideCycling(!isDynamicTideCycling)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-reliance-navy hover:bg-reliance-blue/60 text-white border border-white/20 transition-all cursor-pointer flex items-center gap-1"
              >
                {isDynamicTideCycling ? (
                  <>
                    <Pause className="w-2.5 h-2.5 text-amber-400" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-2.5 h-2.5 text-emerald-400" />
                    <span>CYCLE</span>
                  </>
                )}
              </button>
            </div>

            {/* Countdown Progress Bar */}
            <div className="flex items-center justify-between text-[9px] text-reliance-textMuted">
              <span>{TIDE_PHASES_SCHEDULE[tidePhaseIndex]?.label}</span>
              <span className="text-white font-bold">{dynamicTideSecondsRemaining}s left</span>
            </div>
            <div className="w-full h-1 bg-reliance-navy rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-reliance-cyan to-emerald-400 transition-all duration-1000"
                style={{ width: `${(dynamicTideSecondsRemaining / 10) * 100}%` }}
              />
            </div>
          </div>

          {/* 1. FLOW POWER SELECTOR (Slow -> Moderate -> Fast -> Extreme -> Storm) */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono text-reliance-textMuted uppercase mb-1.5">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-reliance-cyan" />
                <span>Water Flow Power Level</span>
              </span>
              <span className="text-[9px] font-bold text-reliance-cyan uppercase">
                {currentFlowPower}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {powerLevels.map((lvl) => {
                const isActive = currentFlowPower === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    onClick={() => handlePowerChange(lvl.id)}
                    className={`p-2 rounded-xl text-left font-mono transition-all cursor-pointer border ${
                      isActive ? lvl.bgActive : 'bg-reliance-navy/50 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[11px] font-bold ${isActive ? 'text-white' : lvl.color}`}>
                        {lvl.label}
                      </span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-reliance-cyan animate-ping" />}
                    </div>
                    <div className="text-[9px] text-reliance-textMuted">
                      {lvl.speedText}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. PRECISE CURRENT SPEED SLIDER */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono text-reliance-textMuted mb-1">
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-reliance-cyan" />
                <span>Water Flow Velocity</span>
              </span>
              <span className="font-bold text-reliance-cyan text-[11px]">
                {currentSpeedKnots.toFixed(1)} Knots ({(currentSpeedKnots * 0.5144).toFixed(2)} m/s)
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="10.0"
              step="0.1"
              value={currentSpeedKnots}
              onChange={(e) => setCurrentSpeedKnots(parseFloat(e.target.value))}
              className="w-full accent-reliance-cyan h-1.5 bg-reliance-navy/80 rounded-lg cursor-pointer"
            />
          </div>

          {/* 3. CURRENT FLOW DIRECTION (Compass Heading) */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono text-reliance-textMuted mb-1.5">
              <span className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-400" />
                <span>Current Drift Direction</span>
              </span>
              <span className="font-bold text-amber-300 text-[11px]">
                {currentDirectionLabel}
              </span>
            </div>

            {/* 8-Point Compass Buttons */}
            <div className="grid grid-cols-4 gap-1 mb-2">
              {cardinalButtons.map((btn) => {
                const isSelected = Math.abs(currentDirectionDeg - btn.deg) < 22.5;
                return (
                  <button
                    key={btn.label}
                    onClick={() => handleDirectionChange(btn.deg)}
                    className={`py-1 text-center text-[10px] font-mono rounded-lg transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500/30 border-amber-400 text-amber-300 font-bold shadow-amber-glow'
                        : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white'
                    }`}
                  >
                    {btn.label} ({btn.deg}°)
                  </button>
                );
              })}
            </div>

            {/* 360-Degree Angle Slider */}
            <input
              type="range"
              min="0"
              max="359"
              value={currentDirectionDeg}
              onChange={(e) => handleDirectionChange(parseInt(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-reliance-navy/80 rounded-lg cursor-pointer"
            />
          </div>

          {/* 4. REAL-TIME METOCEAN TIDE STATUS & WEATHER LINK */}
          <div className="p-2.5 rounded-xl bg-reliance-navy/40 border border-reliance-cyan/20 text-[10px] font-mono space-y-1.5">
            <div className="flex items-center justify-between text-reliance-textMuted">
              <span>Tidal State:</span>
              <span className="text-white font-bold capitalize">{tidePhase.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center justify-between text-reliance-textMuted">
              <span>Subsea Column Drag:</span>
              <span className="text-emerald-400 font-bold">{(currentSpeedKnots * 18.2).toFixed(1)} kN</span>
            </div>
            <div className="flex items-center justify-between text-reliance-textMuted">
              <span>Surface Swell Height:</span>
              <span className="text-reliance-cyan font-bold">
                {currentFlowPower === 'slow'
                  ? '0.4 m'
                  : currentFlowPower === 'moderate'
                  ? '1.2 m'
                  : currentFlowPower === 'fast'
                  ? '2.8 m'
                  : currentFlowPower === 'extreme'
                  ? '5.6 m'
                  : '6.5 m (Storm)'}
              </span>
            </div>

            <button
              onClick={toggleWeatherPanel}
              className="w-full mt-1 py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Wind className="w-3 h-3 text-amber-400" />
              <span>OPEN KG-D6 WEATHER REPORT</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
