/**
 * JARVIS-Style Holographic Exploded Split-View & Pipe 1 Slicing Engine
 * Smoothly decouples the 3D digital twin into 6 floating modular subsystems
 * with interactive touch-to-zoom capabilities, holographic HUD brackets,
 * and high-fidelity longitudinal pipe cross-section rendering.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

interface SplitModuleDef {
  id: string;
  name: string;
  category: string;
  offsetPos: [number, number, number];
  metrics: string;
}

const SPLIT_MODULES: SplitModuleDef[] = [
  {
    id: 'TOPSIDE-DRILL-RIG',
    name: 'Topside Production Hub & Derrick',
    category: 'TOPSIDE PROCESS',
    offsetPos: [0, 20, 0],
    metrics: 'Load: 18,400 MT • Power: 14.2 MW',
  },
  {
    id: 'PILLAR-FOUNDATION',
    name: 'Buoyancy Columns & Submerged Pontoons',
    category: 'HULL STABILITY',
    offsetPos: [-18, 0, -18],
    metrics: 'Draft: 21.0m • Mooring: 4x2 Ch综',
  },
  {
    id: 'RISER-ALPHA',
    name: 'Pipe 1 (SCR Production Riser Alpha)',
    category: 'PRODUCTION FLOWLINE',
    offsetPos: [-16, -10, 16],
    metrics: '31,469 BPD • 182.4 bar • 18.4mm Wall',
  },
  {
    id: 'MANIFOLD-D6-MAIN',
    name: 'Subsea Gathering Manifold Hub',
    category: 'SEABED SYSTEM',
    offsetPos: [18, -12, 16],
    metrics: '4-Slot Dual Header • -1,020m Depth',
  },
  {
    id: 'DRILL-SYSTEM',
    name: 'Rotary Drill String & Top-Drive Assembly',
    category: 'DRILLING CORE',
    offsetPos: [16, 10, -16],
    metrics: '120 RPM • 28.4 kNm • SF: 9.3',
  },
  {
    id: 'SUBSEA-BEDROCK',
    name: 'Subterranean Wellhead & Borehole Casing',
    category: 'GEOLOGICAL RESERVOIR',
    offsetPos: [0, -26, 0],
    metrics: 'Target Depth: -2,040m • Sandstone Core',
  },
];

export const JarvisSplitExplodedView: React.FC = () => {
  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);
  const selectedSplitPartId = useRigStore((s) => s.selectedSplitPartId);
  const zoomToSplitPart = useRigStore((s) => s.zoomToSplitPart);
  const setPipeSliceModalOpen = useRigStore((s) => s.setPipeSliceModalOpen);

  const groupRefs = useRef<{ [key: string]: THREE.Group | null }>({});
  const sliceGroupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  // Smooth lerping factor for exploded view (0.0 = assembled, 1.0 = fully split)
  const currentSplitFactor = useRef(0.0);

  // 3D Sliced Pipe Geometry (Half Cylinder with annular layers)
  const { outerShellGeo, innerFluidGeo, fiberGeo } = useMemo(() => {
    // Semi-cylindrical outer pipe shell (180-degree half pipe)
    const outer = new THREE.CylinderGeometry(1.6, 1.6, 14, 32, 1, false, 0, Math.PI);
    // Inner multiphase liquid core
    const inner = new THREE.CylinderGeometry(1.35, 1.35, 13.8, 32, 1, false, 0, Math.PI);
    // Embedded DTS/DAS fiber optic strip
    const fiber = new THREE.BoxGeometry(0.12, 13.9, 0.12);
    fiber.translate(0, 0, 1.55);

    return { outerShellGeo: outer, innerFluidGeo: inner, fiberGeo: fiber };
  }, []);

  useFrame((_, delta) => {
    const targetFactor = isSplitViewActive ? 1.0 : 0.0;
    currentSplitFactor.current = THREE.MathUtils.lerp(
      currentSplitFactor.current,
      targetFactor,
      delta * 3.5
    );

    const f = currentSplitFactor.current;

    // Animate each decoupled subsystem offset
    SPLIT_MODULES.forEach((mod) => {
      const g = groupRefs.current[mod.id];
      if (g) {
        g.position.set(
          mod.offsetPos[0] * f,
          mod.offsetPos[1] * f,
          mod.offsetPos[2] * f
        );

        // Gentle floating heave when exploded
        if (f > 0.05) {
          const t = performance.now() * 0.0015;
          g.position.y += Math.sin(t + mod.offsetPos[0]) * 0.35 * f;
        }
      }
    });

    // Animate fluid pulse inside sliced pipe
    if (sliceGroupRef.current && isPipeSliced) {
      const t = performance.now() * 0.003;
      sliceGroupRef.current.rotation.y = Math.sin(t * 0.5) * 0.15 + Math.PI / 4;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* 1. JARVIS 6-MODULE EXPLODED SPLIT HUDS */}
      {SPLIT_MODULES.map((mod) => {
        const isSelected = selectedSplitPartId === mod.id;

        return (
          <group
            key={mod.id}
            ref={(el) => (groupRefs.current[mod.id] = el)}
            position={[0, 0, 0]}
          >
            {/* Holographic Interactive Targeting Bracket (Visible when Split is active) */}
            {isSplitViewActive && (
              <group position={[0, 0, 0]}>
                {/* Outer Holographic Bounding Rings */}
                <mesh
                  onClick={(e) => {
                    e.stopPropagation();
                    zoomToSplitPart(mod.id);
                  }}
                  onPointerOver={() => (document.body.style.cursor = 'pointer')}
                  onPointerOut={() => (document.body.style.cursor = 'default')}
                >
                  <sphereGeometry args={[4.2, 16, 16]} />
                  <meshBasicMaterial
                    color={isSelected ? '#00FFFF' : '#00E5FF'}
                    wireframe
                    transparent
                    opacity={isSelected ? 0.35 : 0.15}
                  />
                </mesh>

                {/* Floating 3D HTML Cyberpunk Inspection Card */}
                <Html position={[0, 4.8, 0]} center distanceFactor={45}>
                  <div
                    onClick={() => zoomToSplitPart(mod.id)}
                    className={`px-3 py-2 rounded-xl border backdrop-blur-xl font-mono text-xs cursor-pointer select-none transition-all duration-200 transform hover:scale-105 shadow-dock ${
                      isSelected
                        ? 'bg-reliance-cyan/25 border-reliance-cyan text-white shadow-cyan-glow'
                        : 'bg-reliance-deepnavy/90 border-reliance-cyan/40 text-reliance-cyan hover:border-reliance-cyan'
                    }`}
                    style={{ minWidth: '180px' }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-reliance-cyan">
                        {mod.category}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="font-bold text-white text-[11px] truncate">
                      {mod.name}
                    </div>
                    <div className="text-[9px] text-reliance-textMuted mt-0.5">
                      {mod.metrics}
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-white/15 flex justify-between items-center text-[8px] text-reliance-cyan">
                      <span>TOUCH TO ZOOM</span>
                      <span>[INSPECT]</span>
                    </div>
                  </div>
                </Html>
              </group>
            )}
          </group>
        );
      })}

      {/* 2. PIPE 1 (RISER ALPHA) HOLOGRAPHIC SLICED CROSS-SECTION */}
      {isPipeSliced && (
        <group
          ref={sliceGroupRef}
          position={[-14, -8, 12]}
          onClick={() => setPipeSliceModalOpen(true)}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          {/* Outer Carbon-Steel Semi-Cylinder Pipe Shell */}
          <mesh geometry={outerShellGeo}>
            <meshStandardMaterial
              color="#1C355E"
              roughness={0.3}
              metalness={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Inner Multi-Phase Oil & Gas Fluid Core */}
          <mesh geometry={innerFluidGeo}>
            <meshStandardMaterial
              color="#00E5FF"
              emissive="#00FFFF"
              emissiveIntensity={2.5}
              roughness={0.1}
              metalness={0.9}
              transparent
              opacity={0.88}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Embedded Optical Fiber Sensor Line */}
          <mesh geometry={fiberGeo}>
            <meshStandardMaterial
              color="#FF0055"
              emissive="#FF0033"
              emissiveIntensity={4.0}
            />
          </mesh>

          {/* Sliced Pipe 3D Hologram Callout */}
          <Html position={[0, 8.5, 0]} center distanceFactor={40}>
            <div
              onClick={() => setPipeSliceModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl glass-panel-alert border border-reliance-cyan/60 bg-reliance-deepnavy/95 text-white font-mono text-xs shadow-cyan-glow cursor-pointer hover:scale-105 transition-all"
            >
              <div className="flex items-center gap-1.5 text-reliance-cyan font-bold text-[10px]">
                <span className="w-2 h-2 rounded-full bg-reliance-cyan animate-ping" />
                <span>PIPE 1 AXIAL CROSS-SECTION</span>
              </div>
              <div className="text-[9px] text-white/90 mt-0.5">
                WALL: 18.4 mm • MULTIPHASE OIL/GAS CORE
              </div>
              <div className="mt-1 text-[8px] bg-reliance-cyan/20 text-reliance-cyan px-2 py-0.5 rounded text-center font-bold">
                CLICK FOR FULLSCREEN INSPECTION
              </div>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
