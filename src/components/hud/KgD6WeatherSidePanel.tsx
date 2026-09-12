import React, { useEffect, useState } from 'react';
import {
  CloudRain,
  CloudLightning,
  Wind,
  Waves,
  Compass,
  Thermometer,
  Gauge,
  Sun,
  Cloud,
  Eye,
  RefreshCw,
  AlertTriangle,
  Radio,
  X,
  ChevronRight,
  ShieldAlert,
  Droplets,
  Activity,
  Zap,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { KgD6WeatherService, KgD6WeatherReport } from '../../services/KgD6WeatherService';
import { dynamicTideEngine, TIDE_PHASES_SCHEDULE } from '../../physics/DynamicTideEngine';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const KgD6WeatherSidePanel: React.FC = () => {
  const isWeatherPanelOpen = useRigStore((s) => s.isWeatherPanelOpen);
  const setWeatherPanelOpen = useRigStore((s) => s.setWeatherPanelOpen);
  const toggleWeatherPanel = useRigStore((s) => s.toggleWeatherPanel);

  const currentFlowPower = useRigStore((s) => s.currentFlowPower);
  const currentSpeedKnots = useRigStore((s) => s.currentSpeedKnots);
  const currentDirectionLabel = useRigStore((s) => s.currentDirectionLabel);
  const tidePhase = useRigStore((s) => s.tidePhase);
  const tidePhaseIndex = useRigStore((s) => s.tidePhaseIndex);
  const isDynamicTideCycling = useRigStore((s) => s.isDynamicTideCycling);
  const dynamicTideSecondsRemaining = useRigStore((s) => s.dynamicTideSecondsRemaining);
  const setDynamicTideCycling = useRigStore((s) => s.setDynamicTideCycling);
  const setCurrentFlowPower = useRigStore((s) => s.setCurrentFlowPower);
  const setEmergencyScenario = useRigStore((s) => s.setEmergencyScenario);

  const [weather, setWeather] = useState<KgD6WeatherReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'current' | 'forecast' | 'tides'>('current');

  const fetchWeatherData = async (force = false) => {
    setIsLoading(true);
    try {
      const data = await KgD6WeatherService.getLiveWeather(force);
      setWeather(data);
    } catch (e) {
      console.error('Weather load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
    const interval = setInterval(() => {
      fetchWeatherData();
    }, 180000); // 3 minutes
    return () => clearInterval(interval);
  }, []);

  const handleSimulateStorm = () => {
    setCurrentFlowPower('storm');
    setEmergencyScenario('weather_squall', 2);
    varunaVoice.speakCustom('Tropical Cyclone Storm conditions simulated in KG-D6 Basin. Extreme wave heights active.');
  };

  return (
    <div
      className={`fixed top-14 bottom-8 right-0 z-40 flex transition-transform duration-300 ease-out ${
        isWeatherPanelOpen ? 'translate-x-0' : 'translate-x-[calc(100%-24px)]'
      }`}
    >
      {/* Retracted Weather Neon Trigger Edge */}
      <button
        onClick={toggleWeatherPanel}
        className="w-6 h-40 my-auto -ml-3 rounded-l-xl glass-panel border-y border-l border-amber-400/60 bg-reliance-deepnavy/95 text-amber-300 hover:bg-reliance-navy transition-all flex flex-col items-center justify-center gap-2 shadow-amber-glow cursor-pointer"
        title={isWeatherPanelOpen ? 'Close KG-D6 Weather Report' : 'Open KG-D6 Live Weather & Marine Forecast'}
      >
        {isWeatherPanelOpen ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <Wind className="w-4 h-4 animate-pulse text-amber-400" />
        )}
        <span className="[writing-mode:vertical-lr] text-[9px] font-mono font-bold tracking-widest text-amber-300 uppercase rotate-180">
          WEATHER
        </span>
      </button>

      {/* Main Slide-Out Weather Drawer */}
      <div className="w-88 sm:w-96 h-full glass-panel border-l border-amber-400/40 bg-reliance-deepnavy/98 p-4 shadow-dock text-white font-sans backdrop-blur-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-amber-400/20 pb-3 mb-3 shrink-0">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
              <span>KG-D6 METOCEAN FORECAST</span>
            </div>
            <h2 className="text-sm font-extrabold text-white truncate max-w-[240px]">
              16°18'00"N 82°20'00"E
            </h2>
            <div className="text-[9px] font-mono text-reliance-textMuted">
              Bay of Bengal • Block KG-DWN-98/3
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchWeatherData(true)}
              className={`p-1.5 rounded-lg border border-amber-400/30 hover:bg-amber-400/20 text-amber-300 transition-all cursor-pointer ${
                isLoading ? 'animate-spin' : ''
              }`}
              title="Refresh Live Metocean Forecast"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setWeatherPanelOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 gap-1 bg-reliance-navy/60 p-1 rounded-xl border border-white/10 mb-3 shrink-0 text-xs font-mono">
          <button
            onClick={() => setActiveTab('current')}
            className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
              activeTab === 'current'
                ? 'bg-amber-500/30 border border-amber-400 text-amber-200 font-bold'
                : 'text-reliance-textMuted hover:text-white'
            }`}
          >
            CURRENT
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
              activeTab === 'forecast'
                ? 'bg-amber-500/30 border border-amber-400 text-amber-200 font-bold'
                : 'text-reliance-textMuted hover:text-white'
            }`}
          >
            24H FORECAST
          </button>
          <button
            onClick={() => setActiveTab('tides')}
            className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
              activeTab === 'tides'
                ? 'bg-reliance-cyan/30 border border-reliance-cyan text-reliance-cyan font-bold'
                : 'text-reliance-textMuted hover:text-white'
            }`}
          >
            10S TIDES
          </button>
        </div>

        {/* Tab 1: CURRENT LIVE METOCEAN & RADAR */}
        {activeTab === 'current' && weather && (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {/* INCOIS Alert Banner */}
            <div
              className={`p-2.5 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                weather.incoisAlertStatus === 'RED_CYCLONE_WARNING'
                  ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                  : weather.incoisAlertStatus === 'YELLOW_WATCH'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold uppercase tracking-wider text-[10px]">
                  INCOIS / IMD DEEPWATER ADVISORY
                </div>
                <div className="text-[10px] opacity-90 mt-0.5">
                  {weather.incoisAlertMessage}
                </div>
              </div>
            </div>

            {/* Primary Marine Readings 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Significant Wave Height */}
              <div className="p-2.5 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/30 font-mono">
                <div className="flex items-center gap-1.5 text-[10px] text-reliance-cyan mb-1 font-bold">
                  <Waves className="w-3.5 h-3.5" />
                  <span>WAVE HEIGHT (Hs)</span>
                </div>
                <div className="text-xl font-extrabold text-white">
                  {weather.significantWaveHeightM.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-reliance-textMuted">m</span>
                </div>
                <div className="text-[9px] text-reliance-textMuted mt-0.5">
                  Swell: {weather.swellWaveHeightM.toFixed(1)}m • Tp: {weather.peakWavePeriodSec}s
                </div>
              </div>

              {/* Wind Speed & Direction */}
              <div className="p-2.5 rounded-xl bg-reliance-navy/60 border border-amber-400/30 font-mono">
                <div className="flex items-center gap-1.5 text-[10px] text-amber-300 mb-1 font-bold">
                  <Wind className="w-3.5 h-3.5" />
                  <span>WIND VECTOR</span>
                </div>
                <div className="text-xl font-extrabold text-white">
                  {weather.windSpeedKnots.toFixed(1)}{' '}
                  <span className="text-xs font-normal text-reliance-textMuted">kt</span>
                </div>
                <div className="text-[9px] text-reliance-textMuted mt-0.5">
                  Dir: {weather.windDirectionLabel} • Gusts: {weather.windGustsKnots} kt
                </div>
              </div>

              {/* Sea Surface & Air Temp */}
              <div className="p-2.5 rounded-xl bg-reliance-navy/60 border border-emerald-400/30 font-mono">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 mb-1 font-bold">
                  <Thermometer className="w-3.5 h-3.5" />
                  <span>SEA / AIR TEMP</span>
                </div>
                <div className="text-xl font-extrabold text-white">
                  {weather.seaSurfaceTemperatureC.toFixed(1)}°{' '}
                  <span className="text-xs font-normal text-reliance-textMuted">
                    / {weather.airTemperatureC.toFixed(1)}°C
                  </span>
                </div>
                <div className="text-[9px] text-reliance-textMuted mt-0.5">
                  Humidity: {weather.relativeHumidityPct}% • Heat Idx: {weather.apparentTemperatureC}°C
                </div>
              </div>

              {/* Surface Pressure */}
              <div className="p-2.5 rounded-xl bg-reliance-navy/60 border border-purple-400/30 font-mono">
                <div className="flex items-center gap-1.5 text-[10px] text-purple-300 mb-1 font-bold">
                  <Gauge className="w-3.5 h-3.5" />
                  <span>BAROMETER</span>
                </div>
                <div className="text-xl font-extrabold text-white">
                  {weather.surfacePressureHpa.toFixed(1)}{' '}
                  <span className="text-xs font-normal text-reliance-textMuted">hPa</span>
                </div>
                <div className="text-[9px] text-reliance-textMuted mt-0.5">
                  Sea State: {weather.seaStateClassification.split(':')[0]}
                </div>
              </div>
            </div>

            {/* Simulated Bay of Bengal Doppler Radar Graphic */}
            <div className="p-3 rounded-xl bg-reliance-navy/80 border border-white/10 font-mono">
              <div className="flex items-center justify-between text-[10px] text-reliance-textMuted uppercase mb-2">
                <span className="flex items-center gap-1.5 text-reliance-cyan font-bold">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-reliance-cyan" />
                  <span>DOPPLER RADAR • BAY OF BENGAL</span>
                </span>
                <span className="text-emerald-400 text-[9px] font-bold">250 KM RANGE</span>
              </div>

              <div className="relative w-full h-32 bg-black/40 rounded-lg overflow-hidden border border-reliance-cyan/20 flex items-center justify-center">
                {/* Radar Grid Circles */}
                <div className="absolute w-24 h-24 rounded-full border border-reliance-cyan/20 animate-ping" />
                <div className="absolute w-20 h-20 rounded-full border border-reliance-cyan/30" />
                <div className="absolute w-12 h-12 rounded-full border border-reliance-cyan/40" />
                <div className="absolute w-full h-px bg-reliance-cyan/15" />
                <div className="absolute h-full w-px bg-reliance-cyan/15" />

                {/* Sweep Hand */}
                <div className="absolute w-1/2 h-0.5 bg-gradient-to-r from-transparent to-reliance-cyan origin-left animate-spin-slow left-1/2" />

                {/* Center Rig Dot */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-reliance-cyan shadow-cyan-glow animate-pulse" />
                  <span className="text-[8px] text-reliance-cyan font-bold mt-1 bg-black/70 px-1 rounded">
                    KG-D6 PLATFORM
                  </span>
                </div>

                {/* Weather Echo Blob */}
                <div className="absolute top-4 right-8 w-10 h-8 rounded-full bg-emerald-500/30 blur-md" />
                <div className="absolute bottom-6 left-6 w-12 h-10 rounded-full bg-cyan-500/20 blur-md" />
              </div>
            </div>

            {/* Quick Storm Simulation Trigger */}
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-400/30 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>SIMULATE TROPICAL STORM</span>
                </div>
                <div className="text-[9px] font-mono text-reliance-textMuted">
                  Triggers 8.8 kt surge, 6.5m swell & cyclonic sea state
                </div>
              </div>
              <button
                onClick={handleSimulateStorm}
                className="px-3 py-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white text-[10px] font-mono font-bold transition-all cursor-pointer shadow-red-glow"
              >
                ACTIVATE
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: 24-HOUR MARINE FORECAST */}
        {activeTab === 'forecast' && weather && (
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            <div className="text-[10px] font-mono text-reliance-textMuted mb-1 flex justify-between">
              <span>HOURLY KG-D6 MARINE TIMELINE</span>
              <span className="text-amber-300 font-bold">24-HOUR OUTLOOK</span>
            </div>

            {weather.forecast24h.map((item, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xl bg-reliance-navy/50 border border-white/10 hover:border-amber-400/40 transition-all font-mono flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="text-amber-300 font-bold text-[11px] w-12">{item.hour}</div>
                  <div>
                    <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                      {item.precipitationMm > 30 ? (
                        <CloudRain className="w-3 h-3 text-cyan-400" />
                      ) : item.precipitationMm > 10 ? (
                        <Cloud className="w-3 h-3 text-amber-300" />
                      ) : (
                        <Sun className="w-3 h-3 text-amber-400" />
                      )}
                      <span>{item.condition}</span>
                    </div>
                    <div className="text-[9px] text-reliance-textMuted">
                      Precip: {item.precipitationMm}% • Temp: {item.temperatureC}°C
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-reliance-cyan text-[11px]">
                    {item.waveHeightM}m <span className="text-[9px] text-white/60">Hs</span>
                  </div>
                  <div className="text-[9px] text-amber-300">{item.windSpeedKt} kt wind</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: DYNAMIC 10-SECOND TIDES ENGINE */}
        {activeTab === 'tides' && (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1 font-mono">
            {/* Active 10-Second Cycling Indicator Card */}
            <div className="p-3 rounded-xl bg-reliance-cyan/15 border border-reliance-cyan/40">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-reliance-cyan font-bold text-xs">
                  <Zap className="w-4 h-4 animate-pulse" />
                  <span>10-SECOND DYNAMIC TIDES</span>
                </div>
                <button
                  onClick={() => setDynamicTideCycling(!isDynamicTideCycling)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all ${
                    isDynamicTideCycling
                      ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-300'
                      : 'bg-white/10 border border-white/20 text-white/60'
                  }`}
                >
                  {isDynamicTideCycling ? 'AUTOCYCLE: ON' : 'PAUSED'}
                </button>
              </div>

              {/* Countdown Progress Bar */}
              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-[10px] text-reliance-textMuted">
                  <span>Phase Transition Countdown:</span>
                  <span className="text-reliance-cyan font-bold">
                    {dynamicTideSecondsRemaining}s remaining
                  </span>
                </div>
                <div className="w-full h-1.5 bg-reliance-navy rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-reliance-cyan to-emerald-400 transition-all duration-1000"
                    style={{ width: `${(dynamicTideSecondsRemaining / 10) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-[11px] font-bold text-white bg-reliance-deepnavy/80 p-2 rounded-lg border border-white/10">
                ACTIVE PHASE: <span className="text-amber-300">{TIDE_PHASES_SCHEDULE[tidePhaseIndex]?.label}</span>
                <div className="text-[9px] font-normal text-reliance-textMuted mt-0.5">
                  {TIDE_PHASES_SCHEDULE[tidePhaseIndex]?.description}
                </div>
              </div>
            </div>

            {/* 4 Phased Tidal Schedule List */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-reliance-textMuted uppercase">
                4-Phase Tidal Oscillation Cycle:
              </div>

              {TIDE_PHASES_SCHEDULE.map((p) => {
                const isActive = tidePhaseIndex === p.index;
                return (
                  <button
                    key={p.index}
                    onClick={() => {
                      dynamicTideEngine.applyPhase(p.index);
                      varunaVoice.playSonarPing(750, 0.08);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                      isActive
                        ? p.index === 3
                          ? 'bg-rose-500/25 border-rose-400 text-rose-200 font-bold shadow-red-glow'
                          : 'bg-reliance-cyan/20 border-reliance-cyan text-reliance-cyan font-bold shadow-cyan-glow'
                        : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-bold">
                        PHASE {p.index + 1}: {p.label}
                      </span>
                      {isActive && (
                        <span className="text-[9px] bg-reliance-cyan/30 px-1.5 py-0.5 rounded text-white animate-pulse">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[9px] opacity-80">
                      <span>Flow: {p.speedKnots} kt ({p.directionDeg}°)</span>
                      <span>Swell: {p.swellHeightM} m</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
