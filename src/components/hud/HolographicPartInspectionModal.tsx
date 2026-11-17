import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Scan,
  Volume2,
  Maximize2,
} from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { KaTeXBlock } from '../common/KaTeXBlock';
import { partData } from './partCatalog';
import { telemetryDb } from '../../db/TelemetryDatabase';
import { useLeakStatus } from '../../services/LeakDetector';
import { KgD6WeatherService, KgD6WeatherReport } from '../../services/KgD6WeatherService';
import { rigModelCache, RigPart, COMPONENT_TO_PART, DEFAULT_RIG_URL } from '../../services/RigModelCache';
import { createHolographicMaterial } from '../../shaders/HolographicMaterial';
import { HOLO, holoMaterial } from '../../shaders/HoloPalette';

interface HoloRigSectionProps {
  type: HolographicComponentType;
  autoRotate: boolean;
  orbitControlsRef: React.RefObject<any>;
}

const MODEL_SCALE = 45.0;

/**
 * Dedicated part view: only the selected sub-assembly of the real model is shown, centred
 * and auto-framed, as a cyan hologram inside a scan cage sized to the part. Pipes (which are
 * not part of the model mesh) are shown as a cut-away pipe spool.
 */
const HoloRigCroppedSection: React.FC<HoloRigSectionProps> = ({ type, autoRotate, orbitControlsRef }) => {
  const customObjUrl = useRigStore((s) => s.customObjUrl || DEFAULT_RIG_URL);
  const [part, setPart] = useState<RigPart | null>(null);
  const pipeFluidMeshRef = useRef<THREE.Mesh>(null);
  const laserRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const isPipe = type.startsWith('pipe');
  const partId = COMPONENT_TO_PART[type];

  useEffect(() => {
    if (isPipe || !partId) return;
    let cancelled = false;
    rigModelCache.preload(customObjUrl).then(() => {
      if (!cancelled) setPart(rigModelCache.getPart(customObjUrl, partId));
    });
    return () => {
      cancelled = true;
    };
  }, [customObjUrl, partId, isPipe]);

  const material = useMemo(
    () => createHolographicMaterial({ baseColor: '#000000', glowColor: HOLO.primary, opacity: 0.6, scanlineFreq: 1.4, glowIntensity: 1.4 }),
    []
  );
  // Solid lit body + rim glow + crisp edges: stays sharp when zoomed in
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0B2A3A',
        emissive: '#03141D',
        roughness: 0.55,
        metalness: 0.35,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    []
  );
  const edgeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: HOLO.primary, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );
  const wireMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: HOLO.primary, wireframe: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );

  // World-space size of the part (model is rotated -90° about Y, so X/Z swap)
  const frame = useMemo(() => {
    if (isPipe) return { size: new THREE.Vector3(5, 16.5, 5), center: new THREE.Vector3() };
    const box = part?.geometry.boundingBox;
    if (!box) return null;
    const s = box.getSize(new THREE.Vector3()).multiplyScalar(MODEL_SCALE);
    return { size: new THREE.Vector3(s.z, s.y, s.x), center: box.getCenter(new THREE.Vector3()) };
  }, [part, isPipe]);

  // Auto-fit the camera to the part
  useEffect(() => {
    if (!frame) return;
    const radius = frame.size.length() / 2;
    const dist = radius * 2.1 + 2;
    camera.position.set(dist * 0.62, dist * 0.42, dist * 0.66);
    camera.lookAt(0, 0, 0);
    if (orbitControlsRef.current) {
      orbitControlsRef.current.target.set(0, 0, 0);
      orbitControlsRef.current.maxDistance = dist * 3;
      orbitControlsRef.current.update();
      orbitControlsRef.current.saveState?.();
    }
  }, [frame, camera, orbitControlsRef]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    if (laserRef.current && frame) laserRef.current.position.y = Math.sin(t * 1.6) * (frame.size.y / 2);
    if (pipeFluidMeshRef.current) pipeFluidMeshRef.current.rotation.y = t * 1.5;
  });

  return (
    <group>
      {isPipe ? (
        <group>
          {/* Pipe wall cage */}
          <mesh material={holoMaterial({ color: HOLO.primary, opacity: 0.4, wireframe: true })}>
            <cylinderGeometry args={[2.0, 2.0, 16.0, 36, 18, true]} />
          </mesh>
          {/* Multiphase core */}
          <mesh ref={pipeFluidMeshRef} material={holoMaterial({ color: HOLO.mid, opacity: 0.45 })}>
            <cylinderGeometry args={[1.5, 1.5, 15.8, 28, 1]} />
          </mesh>
          {/* Flanges */}
          {[-6.5, -3.2, 0, 3.2, 6.5].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={holoMaterial({ color: HOLO.hot, opacity: 0.8 })}>
              <torusGeometry args={[2.3, 0.18, 12, 48]} />
            </mesh>
          ))}
          {/* Fibre-optic strain line */}
          <mesh position={[2.05, 0, 0]} material={holoMaterial({ color: HOLO.hot, opacity: 0.95 })}>
            <cylinderGeometry args={[0.06, 0.06, 16.0, 8]} />
          </mesh>
        </group>
      ) : (
        part &&
        frame && (
          <group scale={MODEL_SCALE} rotation={[0, -Math.PI / 2, 0]}>
            <group position={[-frame.center.x, -frame.center.y, -frame.center.z]}>
              <mesh geometry={part.geometry} material={bodyMaterial} />
              <mesh geometry={part.geometry} material={material} />
              {part.edges ? (
                <lineSegments geometry={part.edges} material={edgeMaterial} />
              ) : (
                <mesh geometry={part.geometry} material={wireMaterial} />
              )}
            </group>
          </group>
        )
      )}

      {/* Scan cage sized to the part + sweeping scan plane */}
      {frame && (
        <group>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(frame.size.x * 1.08, frame.size.y * 1.08, frame.size.z * 1.08)]} />
            <lineBasicMaterial color={HOLO.primary} transparent opacity={0.6} />
          </lineSegments>
          <mesh ref={laserRef} rotation={[-Math.PI / 2, 0, 0]} material={holoMaterial({ color: HOLO.primary, opacity: 0.12 })}>
            <planeGeometry args={[frame.size.x * 1.06, frame.size.z * 1.06]} />
          </mesh>
        </group>
      )}

      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enableRotate
        enableZoom
        enablePan
        autoRotate={autoRotate}
        autoRotateSpeed={1.8}
        minDistance={1.0}
        dampingFactor={0.08}
      />
    </group>
  );
};
export const HolographicPartInspectionModal: React.FC = () => {
  const activeHoloModal = useRigStore((s) => s.activeHoloModal);
  const closeHoloModal = useRigStore((s) => s.closeHoloModal);
  const openHoloModal = useRigStore((s) => s.openHoloModal);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);

  // Re-render with every telemetry update so live metrics stay current
  useTelemetryStore((s) => s.currentRecord);
  const leak = useLeakStatus();
  const [weather, setWeather] = useState<KgD6WeatherReport | null>(KgD6WeatherService.getCachedReport());
  useEffect(() => {
    let alive = true;
    KgD6WeatherService.getLiveWeather().then((r) => alive && setWeather(r)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const [isScanning, setIsScanning] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isExpanded3D, setIsExpanded3D] = useState(false);
  const orbitControlsRef = useRef<any>(null);

  if (!activeHoloModal) return null;

  const handleZoomIn = () => {
    if (orbitControlsRef.current?.object) {
      orbitControlsRef.current.object.position.multiplyScalar(0.85);
      orbitControlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (orbitControlsRef.current?.object) {
      orbitControlsRef.current.object.position.multiplyScalar(1.18);
      orbitControlsRef.current.update();
    }
  };

  const handleResetView = () => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.reset();
    }
  };

  const handleScan = () => {
    setIsScanning(true);
    varunaVoice.playSonarPing(880, 0.15);
    varunaVoice.speakCustom('Scan view. Wall-thickness and crack results need ultrasonic or ROV inspection data, which is not connected.');
    setTimeout(() => setIsScanning(false), 2200);
  };

  const data = partData(activeHoloModal, { latest: (id) => telemetryDb.getLatest(id), weather, leak });

  // Quick navigation items list
  const navTabs: { id: HolographicComponentType; label: string }[] = [
    { id: 'pipe1', label: 'Pipe 1' },
    { id: 'pipe2', label: 'Pipe 2' },
    { id: 'pipe3', label: 'Pipe 3' },
    { id: 'pipe4', label: 'Pipe 4' },
    { id: 'pipe5', label: 'Pipe 5' },
    { id: 'pipe6', label: 'Pipe 6' },
    { id: 'pipe7', label: 'Pipe 7' },
    { id: 'pipe8', label: 'Pipe 8' },
    { id: 'pipe9', label: 'Pipe 9' },
    { id: 'helipad', label: 'Helipad' },
    { id: 'crane1', label: 'Crane 1' },
    { id: 'crane2', label: 'Crane 2' },
    { id: 'command_dock', label: 'Command Dock' },
    { id: 'accommodation', label: 'Accommodation' },
    { id: 'industrial_pipes', label: 'Industrial Pipes' },
    { id: 'jackup_legs', label: 'Support Legs' },
    { id: 'drill_string', label: 'Drill String' },
    { id: 'drill_bit', label: 'Drill Bit' },
    { id: 'main_deck', label: 'Main Deck' },
    { id: 'motor', label: 'Motor VFD' },
    { id: 'upper_rig', label: 'Upper Rig' },
    { id: 'wells1_7', label: 'Wells 1–7' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-reliance-dark/90 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] glass-panel border border-reliance-cyan/50 bg-reliance-deepnavy/98 rounded-3xl shadow-cyan-glow flex flex-col overflow-hidden text-white font-sans">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-reliance-cyan/30 bg-reliance-blue/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/40 animate-pulse">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-reliance-cyan bg-reliance-cyan/20 px-2 py-0.5 rounded border border-reliance-cyan/40">
                  Part inspection
                </span>
                <span className="text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
                  Live · model · design values are tagged
                </span>
              </div>
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-white mt-0.5 font-mono">
                {data.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded3D(!isExpanded3D)}
              className="px-2.5 py-1.5 rounded-xl bg-reliance-navy/80 hover:bg-reliance-blue/60 text-reliance-cyan border border-reliance-cyan/40 text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Toggle Full 3D View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isExpanded3D ? 'SPLIT TELEMETRY' : 'EXPAND 3D'}</span>
            </button>
            <button
              onClick={closeHoloModal}
              className="p-2 rounded-xl bg-reliance-navy/80 hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer border border-white/15"
              title="Close Holographic Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className={`flex-1 grid gap-4 p-3.5 sm:p-4 overflow-y-auto ${isExpanded3D ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
          {/* 3D Holographic Interactive Rotating Canvas (Large and Long) */}
          <div className={`flex flex-col space-y-3 ${isExpanded3D ? 'col-span-1 h-full min-h-[550px]' : 'lg:col-span-7'}`}>
            <div className="relative flex-1 min-h-[360px] sm:min-h-[460px] lg:min-h-[500px] rounded-2xl bg-black/85 border border-reliance-cyan/40 p-3 flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Holographic Grid Overlay */}

              {/* 3D Canvas Rendering */}
              <div className="absolute inset-0">
                <Canvas camera={{ position: [0, 0, 18], fov: 45, near: 0.1, far: 2000 }} dpr={[1, 2]}>
                  <ambientLight intensity={0.35} color={HOLO.primary} />
                  <hemisphereLight args={['#9FEFFF', '#02101A', 0.6]} />
                  <directionalLight position={[30, 60, 20]} intensity={2.2} color="#E6FBFF" />
                  <HoloRigCroppedSection
                    type={activeHoloModal}
                    autoRotate={autoRotate}
                    orbitControlsRef={orbitControlsRef}
                  />
                </Canvas>
              </div>

              {/* Top HUD Badges */}
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono pointer-events-none">
                <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/40 px-2.5 py-1 rounded-lg backdrop-blur-md pointer-events-auto">
                  <span className="text-reliance-cyan font-bold">TAG: </span>
                  <span className="text-white">{data.tag}</span>
                </div>
                <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/40 px-2.5 py-1 rounded-lg backdrop-blur-md text-cyan-200 font-bold pointer-events-auto">
                  <span>DEPTH: {data.depth}</span>
                </div>
              </div>

              {/* Interactive 360 Orbit & Zoom Control Dock (Top-Right Floating) */}
              <div className="absolute top-12 right-3 z-20 flex flex-col gap-1.5 font-mono text-[10px]">
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-dock backdrop-blur-md ${
                    autoRotate
                      ? 'bg-reliance-cyan/30 border-reliance-cyan text-white shadow-cyan-glow font-bold'
                      : 'bg-black/70 border-white/20 text-white/70 hover:text-white hover:border-reliance-cyan'
                  }`}
                  title="Toggle 360° Auto-Rotation"
                >
                  <span>Rotate 360°</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${autoRotate ? 'bg-cyan-300 animate-ping' : 'bg-white/30'}`} />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleZoomIn}
                    className="flex-1 py-1 px-2 rounded-lg bg-black/75 hover:bg-reliance-blue/60 border border-reliance-cyan/40 text-white font-bold transition-all cursor-pointer text-center"
                    title="Zoom In (+)"
                  >
                    +
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="flex-1 py-1 px-2 rounded-lg bg-black/75 hover:bg-reliance-blue/60 border border-reliance-cyan/40 text-white font-bold transition-all cursor-pointer text-center"
                    title="Zoom Out (-)"
                  >
                    -
                  </button>
                  <button
                    onClick={handleResetView}
                    className="py-1 px-2 rounded-lg bg-black/75 hover:bg-reliance-blue/60 border border-reliance-cyan/40 text-reliance-cyan font-bold transition-all cursor-pointer"
                    title="Reset Center View"
                  >
                    RESET
                  </button>
                </div>
              </div>

              {/* Bottom HUD Badges & 360 Navigation Tip */}
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[9px] font-mono text-reliance-cyan/90 bg-reliance-deepnavy/85 p-2 rounded-xl border border-reliance-cyan/20 gap-1 backdrop-blur-md">
                <span>SPEC: {data.spec}</span>
                <span className="text-cyan-300 font-bold flex items-center gap-1">
                  <span>Drag to rotate · scroll to zoom</span>
                </span>
              </div>
            </div>

            {/* LaTeX Mathematical Formula */}
            <div className="p-3 rounded-2xl bg-reliance-navy/50 border border-reliance-cyan/25 font-mono text-xs">
              <div className="text-[10px] font-bold text-reliance-cyan uppercase tracking-wider mb-1">
                PHYSICS & GOVERNING EQUATIONS
              </div>
              <KaTeXBlock math={data.latex} />
            </div>
          </div>

          {/* Right 5 Cols: Live Engineering Telemetry & Controls (Hidden when Expanded 3D is active) */}
          {!isExpanded3D && (
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              {/* 6 Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5 font-mono">
                {data.metrics.map((m, idx) => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-reliance-navy/60 border border-reliance-cyan/30 flex flex-col justify-between shadow-dock hover:border-reliance-cyan transition-all"
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] text-reliance-textMuted mb-1">
                        <span className="truncate">{m.label}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <span
                            className={`px-1 rounded text-[9px] font-semibold uppercase ${
                              m.source === 'live' ? 'bg-success-900 text-success-300' : m.source === 'model' ? 'bg-accent-900 text-accent-200' : 'bg-surface-3 text-ink-muted'
                            }`}
                            title={m.source === 'live' ? 'Live reading' : m.source === 'model' ? 'Computed by the twin physics' : 'Design rating (illustrative)'}
                          >
                            {m.source}
                          </span>
                          <Icon className="w-3.5 h-3.5 text-cyan-400" />
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-cyan-100">
                        {m.val}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 font-mono text-xs">
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="w-full py-2.5 px-4 rounded-xl bg-reliance-blue hover:bg-reliance-blue/80 border border-reliance-cyan text-white font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-cyan-glow"
                >
                  <Scan className={`w-4 h-4 text-reliance-cyan ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'TRANSDUCER SWEEP ACTIVE...' : 'ULTRASONIC NDT SCAN'}</span>
                </button>

                <button
                  onClick={() => {
                    varunaVoice.speakCustom(`Playing active acoustic vibration harmonic for ${data.tag}.`);
                    varunaVoice.playSonarPing(440, 0.25);
                  }}
                  className="w-full py-2 px-4 rounded-xl bg-reliance-navy/60 hover:bg-reliance-navy border border-white/15 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>AUDIO HARMONIC FREQUENCY</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Horizontal Quick-Navigation Strip */}
        <div className="p-2.5 sm:p-3 border-t border-reliance-cyan/30 bg-reliance-deepnavy/95 shrink-0 overflow-x-auto flex items-center gap-1.5 font-mono text-xs scrollbar-none">
          <span className="text-[10px] text-reliance-textMuted font-bold uppercase tracking-widest mr-2 shrink-0">
            QUICK BOX:
          </span>
          {navTabs.map((tab) => {
            const isCur = activeHoloModal === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  openHoloModal(tab.id);
                  setCameraViewMode(tab.id as any);
                }}
                className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-extrabold border transition-all cursor-pointer ${
                  isCur
                    ? 'bg-reliance-cyan text-reliance-deepnavy border-white shadow-cyan-glow'
                    : 'bg-reliance-navy/60 text-white/80 border-white/10 hover:border-reliance-cyan/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
