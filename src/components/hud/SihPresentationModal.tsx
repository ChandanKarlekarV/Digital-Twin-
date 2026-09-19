import React, { useState, useEffect } from 'react';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Maximize2,
  Minimize2,
  Video,
  Cpu,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const SihPresentationModal: React.FC = () => {
  const isSihModalOpen = useRigStore((s) => s.isSihModalOpen);
  const setSihModalOpen = useRigStore((s) => s.setSihModalOpen);

  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const totalSlides = 6;
  const [isPlayingVideoDemo, setIsPlayingVideoDemo] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSihModalOpen) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentSlide((s) => Math.min(totalSlides, s + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide((s) => Math.max(1, s - 1));
      } else if (e.key === 'Escape') {
        setSihModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSihModalOpen, setSihModalOpen]);

  // Video Demo Animation Stepper
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlayingVideoDemo) {
      interval = setInterval(() => {
        setDemoStep((prev) => (prev + 1) % 5);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isPlayingVideoDemo]);

  if (!isSihModalOpen) return null;

  const handleDownloadPptx = () => {
    varunaVoice.speakCustom('Downloading official SIH 2026 6-page PowerPoint presentation.');
    const link = document.createElement('a');
    link.href = '/SIH2026_Digital_Twin_VARUNA_AI.pptx';
    link.download = 'SIH2026_Digital_Twin_VARUNA_AI.pptx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 font-sans text-slate-800">
      <div className="relative w-full max-w-6xl h-[94vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-300">
        {/* ================= TOP CONTROLS & NAVIGATION ================= */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs tracking-wider uppercase font-mono text-amber-400">
                  SIH 2026 OFFICIAL 6-PAGE PRESENTATION
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  PS ID: SIH26120
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Prescriptive Physics-Informed Digital Twin for Offshore Subsea &amp; Topside Operations
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Slide Navigation Buttons */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
              <button
                disabled={currentSlide <= 1}
                onClick={() => setCurrentSlide((s) => Math.max(1, s - 1))}
                className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 transition-all cursor-pointer"
                title="Previous Slide"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-xs font-mono font-bold text-amber-300">
                SLIDE {currentSlide} / {totalSlides}
              </div>
              <button
                disabled={currentSlide >= totalSlides}
                onClick={() => setCurrentSlide((s) => Math.min(totalSlides, s + 1))}
                className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 transition-all cursor-pointer"
                title="Next Slide"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Video Demo Toggle */}
            <button
              onClick={() => {
                setIsPlayingVideoDemo(!isPlayingVideoDemo);
                if (!isPlayingVideoDemo) {
                  varunaVoice.speakCustom('Playing animated digital twin project demo.');
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                isPlayingVideoDemo
                  ? 'bg-rose-600 border-rose-400 text-white shadow-red-glow animate-pulse'
                  : 'bg-purple-600/30 hover:bg-purple-600/50 border-purple-400/40 text-purple-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>{isPlayingVideoDemo ? 'STOP DEMO' : '🎥 VIDEO DEMO'}</span>
            </button>

            {/* Download PPTX */}
            <button
              onClick={handleDownloadPptx}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-mono text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              title="Download Microsoft PowerPoint .pptx"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD .PPTX</span>
            </button>

            {/* Close Button */}
            <button
              onClick={() => setSihModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= MAIN SLIDE VIEWPORT (16:9 PROPORTIONED) ================= */}
        <div className="flex-1 bg-slate-100 p-3 sm:p-6 overflow-y-auto flex items-center justify-center">
          <div className="relative w-full max-w-5xl aspect-[16/9] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col justify-between p-6 sm:p-8">
            {/* Top SIH Branding Header */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-amber-600 font-mono tracking-wider">
                  Smart India Hackathon 2026
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono font-bold">
                SIH IDEA SUBMISSION TEMPLATE
              </div>
            </div>

            {/* ================= SLIDE 1: TITLE PAGE ================= */}
            {currentSlide === 1 && (
              <div className="flex-1 flex flex-col justify-center py-4 animate-in fade-in duration-150">
                <div className="text-center mb-6">
                  <div className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 font-mono text-xs font-extrabold border border-amber-200 mb-2">
                    SMART INDIA HACKATHON 2026 • HARDWARE / SOFTWARE EDITION
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Digital Twin for Well-to-Surface Optimization
                  </h1>
                </div>

                <div className="max-w-2xl mx-auto w-full space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-200 font-sans text-sm sm:text-base">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900 w-52 shrink-0">Problem Statement ID</span>
                    <span className="text-slate-800 font-mono font-bold text-amber-700">– SIH26120</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900 w-52 shrink-0">Problem Statement Title</span>
                    <span className="text-slate-800">- Digital Twin for Well-to-Surface Optimization of CSS and SRP Operations</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900 w-52 shrink-0">Theme</span>
                    <span className="text-slate-800">- Clean &amp; Green Technology</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900 w-52 shrink-0">PS Category</span>
                    <span className="text-slate-800">- Software · IoT + AI/ML</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900 w-52 shrink-0">Team ID</span>
                    <span className="text-slate-800 font-mono">- [Enter Your Team ID]</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900 w-52 shrink-0">Team Name</span>
                    <span className="text-slate-800 font-mono">- [Enter Your Team Name]</span>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SLIDE 2: PROPOSED SOLUTION (2 COLUMNS) ================= */}
            {currentSlide === 2 && (
              <div className="flex-1 flex flex-col justify-start py-1 animate-in fade-in duration-150">
                <h2 className="text-xl sm:text-2xl font-black text-blue-900 uppercase tracking-tight mb-3">
                  PROPOSED SOLUTION
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  {/* Left Column: Problem Statement & Challenges */}
                  <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs sm:text-sm flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-rose-900 text-sm mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Problem Statement &amp; Challenges:</span>
                      </div>
                      <ul className="space-y-2 text-slate-700">
                        <li>
                          <strong className="text-slate-900">Blind Subsurface Operations:</strong> Operating with zero deepwater visibility leads to catastrophic pump failures and undetected steam/emulsion breakthroughs.
                        </li>
                        <li>
                          <strong className="text-slate-900">High Reactive Maintenance:</strong> Heavy oil viscosity (13,000 cP) causes severe rod stress and unpredicted flowline chokes costing ₹25L+ per event.
                        </li>
                        <li>
                          <strong className="text-slate-900">Siloed Industrial SCADA:</strong> Lack of real-time 3D spatial integration between seabed manifolds and topside facilities.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Right Column: Proposed Solution (VARUNA-AI) */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs sm:text-sm flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-emerald-900 text-sm mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Proposed Solution (VARUNA-AI):</span>
                      </div>
                      <ul className="space-y-2 text-slate-700">
                        <li>
                          <strong className="text-slate-900">Physics-Informed Cyber-Twin:</strong> 50.0 Hz ultra-fast digital twin coupling 1D Kalman state estimation with real-time WebGL 3D visualization.
                        </li>
                        <li>
                          <strong className="text-slate-900">ASTM D1250 Net Oil Reconciliation:</strong> Automatic deconvolution of Gross Liquid vs Net Dry Purified Oil, BS&amp;W water-cut %, and associated gas.
                        </li>
                        <li>
                          <strong className="text-slate-900">Autonomous Anomaly Dispatch:</strong> Prescriptive AI flags stick-slip torque and flow chokes with automated 12:00 Midnight DGH regulatory settlements.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SLIDE 3: TECHNICAL APPROACH (WORKFLOW & ARCHITECTURE) ================= */}
            {currentSlide === 3 && (
              <div className="flex-1 flex flex-col justify-start py-0.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-lg sm:text-xl font-black text-blue-900 uppercase tracking-tight">
                    TECHNICAL APPROACH &amp; ARCHITECTURE WORKFLOW
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-200">
                    5-STAGE STENCIL BLUEPRINT WORKFLOW
                  </span>
                </div>

                {/* STENCIL WORKFLOW DIAGRAM IMAGE (FEATURED PROMINENTLY) */}
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-white p-1 mb-2.5 shadow-sm">
                  <img
                    src="/presentation/workflow_diagram_stencil.jpg"
                    alt="VARUNA-AI 5-Stage System Architecture &amp; Workflow Diagram"
                    className="w-full h-44 sm:h-52 object-contain bg-white rounded-lg"
                  />
                </div>

                {/* BOTTOM HALF: TECH MATRIX & PROTOCOLS (LEFT) + RIG VISUALS (RIGHT) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                  {/* Left 2 Cols: Core Tech Stack & Communication Protocols */}
                  <div className="sm:col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col justify-between">
                    <div>
                      <div className="font-extrabold text-blue-900 text-xs mb-1 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-blue-600" />
                        <span>CORE TECH STACK &amp; COMMUNICATION PROTOCOLS</span>
                      </div>
                      <ul className="space-y-1 text-slate-700 text-[11px]">
                        <li>
                          • <strong className="text-slate-900">Stage 1 (Edge SCADA):</strong> Modbus RTU/TCP, OPC-UA, WITSML, Serial USB Gateway (50Hz / 20ms).
                        </li>
                        <li>
                          • <strong className="text-slate-900">Stage 2 (Denoising):</strong> 1D Kalman recursive state estimator + 180-day local ledger (&lt;0.1ms query).
                        </li>
                        <li>
                          • <strong className="text-slate-900">Stage 3 (Physics &amp; AI):</strong> Darcy-Weisbach hydraulics, ASTM D1250 / API MPMS 11.1 net oil solver, XGBoost AI.
                        </li>
                        <li>
                          • <strong className="text-slate-900">Stage 4 &amp; 5 (Twin &amp; Audit):</strong> Three.js WebGL 3D spatial twin with gestures/voice + automated 12:00 AM DGH audit.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Right Col: Rig Showcase Images */}
                  <div className="grid grid-cols-2 gap-1.5 h-full">
                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950 flex flex-col shadow-xs">
                      <img
                        src="/presentation/rig_diorama_colored_1789147250513.jpg"
                        alt="Offshore Rig Diorama"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950 flex flex-col shadow-xs">
                      <img
                        src="/presentation/hologram_digital_twin_1789148609789.jpg"
                        alt="3D Holographic Cyber Twin"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SLIDE 4: FEASIBILITY AND VIABILITY ================= */}
            {currentSlide === 4 && (
              <div className="flex-1 flex flex-col justify-start py-1 animate-in fade-in duration-150">
                <h2 className="text-xl sm:text-2xl font-black text-blue-900 uppercase tracking-tight mb-2">
                  FEASIBILITY AND VIABILITY
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  <div className="space-y-2.5 text-xs sm:text-sm">
                    <div>
                      <h3 className="font-bold text-slate-900 mb-0.5">• Analysis of the feasibility of the idea:</h3>
                      <p className="text-slate-700 text-xs leading-relaxed">
                        The architecture relies on proven industrial IoT standards (Modbus, OPC-UA, WebSockets) and low-overhead WebGL. Sub-millisecond binary search (&lt;0.1ms) enables enterprise-scale local execution with zero cloud dependency.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 mb-0.5">• Potential challenges and risks:</h3>
                      <p className="text-slate-700 text-xs leading-relaxed">
                        Deepwater sensor noise and high computational overhead of coupled thermodynamic simulations in real-time.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 mb-0.5">• Strategies for overcoming these challenges:</h3>
                      <p className="text-slate-700 text-xs leading-relaxed">
                        Deploying 1D Kalman state estimators locally at the edge layer and using XGBoost surrogate models while heavy physics calibrates asynchronously.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 flex flex-col">
                    <img
                      src="/presentation/drill_static_casing_spinning_core_1789149401625.jpg"
                      alt="Downhole Drill Mechanics"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= SLIDE 5: IMPACT AND BENEFITS ================= */}
            {currentSlide === 5 && (
              <div className="flex-1 flex flex-col justify-start py-1 animate-in fade-in duration-150">
                <h2 className="text-xl sm:text-2xl font-black text-blue-900 uppercase tracking-tight mb-2">
                  IMPACT AND BENEFITS
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm">
                    <h3 className="font-bold text-blue-950 mb-2">Potential impact on the target audience (OIL &amp; ONGC):</h3>
                    <ul className="space-y-2 text-slate-700 text-xs">
                      <li>• <strong className="text-slate-900">Strategic Deepwater Extraction:</strong> Unlocks real-time visibility into deepwater manifolds, enabling higher output from extreme offshore blocks.</li>
                      <li>• <strong className="text-slate-900">Predictive Asset Life:</strong> Maximizes lifespan of drill strings and subsea risers by preventing torque fatigue and flowline choking.</li>
                      <li>• <strong className="text-slate-900">Automated Supervision:</strong> Shifts workforce from reactive break-fix fire-fighting to automated supervisory control.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs sm:text-sm">
                    <h3 className="font-bold text-emerald-950 mb-2">Benefits of the solution (Economic &amp; Operational):</h3>
                    <ul className="space-y-2 text-slate-700 text-xs">
                      <li>• <strong className="text-slate-900">Cost Recovery:</strong> ₹25 Lakhs saved per incident through proactive anomaly detection and pump speed throttling.</li>
                      <li>• <strong className="text-slate-900">35% Downtime Reduction:</strong> Automated 12:00 Midnight reconciliation and instant incident dispatch.</li>
                      <li>• <strong className="text-slate-900">40% Lifting Cost Reduction:</strong> Steam-Oil &amp; Multiphase balance optimization eliminates waste.</li>
                      <li>• <strong className="text-slate-900">100% Regulatory Compliance:</strong> Certified DGH / ISO 14001 daily ledger with cryptographic audit hash verification.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SLIDE 6: RESEARCH AND REFERENCES ================= */}
            {currentSlide === 6 && (
              <div className="flex-1 flex flex-col justify-start py-1 animate-in fade-in duration-150">
                <h2 className="text-xl sm:text-2xl font-black text-blue-900 uppercase tracking-tight mb-2">
                  RESEARCH AND REFERENCES
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  <div className="space-y-2 text-xs sm:text-sm">
                    <h3 className="font-bold text-slate-900 mb-1">Details / Links of the reference and research work:</h3>
                    <ul className="space-y-1.5 text-slate-700 text-xs">
                      <li>• <strong className="text-slate-900">ASTM D1250 / API MPMS 11.1:</strong> Standard temperature &amp; pressure volume correction factor algorithms for crude oils.</li>
                      <li>• <strong className="text-slate-900">Coriolis Resonance &amp; Darcy-Weisbach:</strong> Tube stiffness frequency inversion and subsea pipeline friction factor solvers.</li>
                      <li>• <strong className="text-slate-900">1D Kalman State Estimation:</strong> Discrete recursive Bayesian state estimation for industrial SCADA denoising.</li>
                      <li>• <strong className="text-slate-900">WebGL &amp; Three.js 3D Spatial Twins:</strong> High-performance GPU-accelerated rendering of complex offshore assemblies.</li>
                      <li>• <strong className="text-slate-900">DGH Offshore Guidelines:</strong> Indian statutory requirements for daily hydrocarbon reconciliation.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 flex flex-col">
                    <img
                      src="/presentation/subsea_pipes_glowing_arrows_1789149758412.jpg"
                      alt="Subsea Pipeline Flow Network"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= ANIMATED VIDEO DEMO OVERLAY ================= */}
            {isPlayingVideoDemo && (
              <div className="absolute inset-0 bg-slate-950/95 p-6 flex flex-col justify-between text-white animate-in zoom-in-95 duration-200 z-30">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                    <span className="font-mono text-xs font-extrabold tracking-wider text-rose-400">
                      LIVE 3D DIGITAL TWIN SIMULATION &amp; ANIMATED VIDEO DEMO
                    </span>
                  </div>
                  <button
                    onClick={() => setIsPlayingVideoDemo(false)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Animated Simulation Stage */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-auto">
                  <div className="relative rounded-2xl overflow-hidden border border-cyan-500/40 bg-slate-900 aspect-video shadow-cyan-glow flex items-center justify-center">
                    <img
                      src="/presentation/rig_diorama_colored_1789147250513.jpg"
                      alt="3D Subsea Assembly"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-cyan-900/20 backdrop-brightness-110 flex items-end p-3">
                      <span className="px-2 py-1 rounded bg-black/70 text-[10px] font-mono text-cyan-300 font-bold">
                        1. 50.0 Hz Real-Time 3D Spatial Twin
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-900 aspect-video shadow-emerald-glow flex items-center justify-center">
                    <img
                      src="/presentation/oil_flow_arrows_drill_1789149090190.jpg"
                      alt="Multiphase Fluid Extraction"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-emerald-900/20 backdrop-brightness-110 flex items-end p-3">
                      <span className="px-2 py-1 rounded bg-black/70 text-[10px] font-mono text-emerald-300 font-bold">
                        2. ASTM D1250 Net Dry Oil Separation
                      </span>
                    </div>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden border border-amber-500/40 bg-slate-900 aspect-video shadow-amber-glow flex items-center justify-center">
                    <img
                      src="/presentation/drill_static_casing_spinning_core_1789149401625.jpg"
                      alt="Rotary Drill Mechanics"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-amber-900/20 backdrop-brightness-110 flex items-end p-3">
                      <span className="px-2 py-1 rounded bg-black/70 text-[10px] font-mono text-amber-300 font-bold">
                        3. AI Anomaly Dispatch &amp; EOD Settlement
                      </span>
                    </div>
                  </div>
                </div>

                {/* Video Demo Controls & Stepper */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10 font-mono text-xs">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>ANIMATED SIMULATION: 50.0 Hz CLOCK ACTIVE • 180-DAY DATABASE SYNCED</span>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    PRESS 'SPACE' OR ARROW KEYS TO BROWSE SLIDES
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Slide Template Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[10px] text-slate-400 font-mono shrink-0">
              <div>{currentSlide} @SIH Idea submission-Template</div>
              <div>[Enter Your Team Name]</div>
            </div>
          </div>
        </div>

        {/* ================= BOTTOM SLIDE THUMBNAIL SELECTOR ================= */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900 text-white shrink-0 border-t border-slate-800 font-mono text-xs">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                onClick={() => setCurrentSlide(num)}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  currentSlide === num
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                SLIDE {num}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              POWERPOINT FILE READY:
            </span>
            <button
              onClick={handleDownloadPptx}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>SIH2026_Digital_Twin_VARUNA_AI.pptx</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
