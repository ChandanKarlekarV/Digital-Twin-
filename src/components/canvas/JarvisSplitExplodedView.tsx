/**
 * JARVIS-Style Iron Man Piece-By-Piece Holographic Exploded Split-View Engine
 * Decouples the 3D digital twin into 12+ floating modular subsystems:
 * - Upper Derrick & Topside Deck
 * - Helipad Assembly
 * - Heavy Lift Crane 1 & Auxiliary Crane 2
 * - 1,200 HP Top Drive Motor & Mud Pumps
 * - Rotary Drill String & PDC Bit
 * - Pipes 1 to 9 (All 9 Subsea Flowline & Riser Conduits)
 * - Subsea Gathering Manifold Hub
 * - Subsea Wells 1 to 7 Christmas Tree Field Cluster
 * - Seabed Foundation Base
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';

interface SplitModuleDef {
  id: HolographicComponentType | string;
  name: string;
  category: string;
  offsetPos: [number, number, number];
  metrics: string;
  color: string;
}

const SPLIT_MODULES: SplitModuleDef[] = [
  // 1. Upper Rig & Lattice Derrick
  {
    id: 'upper_rig',
    name: 'Topside Derrick Mast & Quarters',
    category: 'TOPSIDE STRUCTURE',
    offsetPos: [0, 24, 4],
    metrics: 'Load: 18,400 MT • Height: +65m',
    color: '#00F5D4',
  },
  // 2. Helipad
  {
    id: 'helipad',
    name: 'CAP 437 Offshore Helideck',
    category: 'AVIATION DECK',
    offsetPos: [18, 16, 14],
    metrics: 'Sikorsky S-92 • 12.8 MT SWL',
    color: '#FACC15',
  },
  // 3. Heavy Lift Crane 1
  {
    id: 'crane1',
    name: 'Heavy-Lift Pedestal Crane 1 (Port)',
    category: 'DECK CRANE',
    offsetPos: [-18, 15, 8],
    metrics: '65 MT SWL • Boom: 42m',
    color: '#FF6D00',
  },
  // 4. Auxiliary Crane 2
  {
    id: 'crane2',
    name: 'Auxiliary Deck Crane 2 (Starboard)',
    category: 'DECK CRANE',
    offsetPos: [18, 15, -8],
    metrics: '30 MT SWL • Boom: 28m',
    color: '#FF9100',
  },
  // 5. Motor & Top Drive Skid
  {
    id: 'motor',
    name: '1,200 HP Top Drive Motor & Mud Pumps',
    category: 'POWER DRIVE',
    offsetPos: [0, 12, -10],
    metrics: '4,160V VFD • 1,200 HP • 98% Eff',
    color: '#38BDF8',
  },
  // 6. Drill String & PDC Bit
  {
    id: 'drill',
    name: 'Rotary Drill String & PDC Bit Core',
    category: 'DRILLING ASSEMBLY',
    offsetPos: [-12, -4, 0],
    metrics: '120 RPM • 28.4 kNm • SF: 9.3',
    color: '#00E5FF',
  },
  // 7. Pipe 1 (SCR Production Riser Alpha)
  {
    id: 'pipe1',
    name: 'Pipe 1 (Production Riser Alpha)',
    category: 'SUBSEA RISER',
    offsetPos: [-16, -6, -16],
    metrics: '31,469 BPD • 182.4 bar • 18.4mm',
    color: '#00FFFF',
  },
  // 8. Pipe 2 (Production Riser Beta)
  {
    id: 'pipe2',
    name: 'Pipe 2 (Production Riser Beta)',
    category: 'SUBSEA RISER',
    offsetPos: [16, -6, -16],
    metrics: '28,120 BPD • 176.2 bar • 18.2mm',
    color: '#00FFFF',
  },
  // 9. Pipe 3 (Production Riser Gamma)
  {
    id: 'pipe3',
    name: 'Pipe 3 (Production Riser Gamma)',
    category: 'SUBSEA RISER',
    offsetPos: [-16, -6, 16],
    metrics: '26,450 BPD • 180.1 bar • 18.3mm',
    color: '#00FFFF',
  },
  // 10. Pipe 4 (Production Riser Delta)
  {
    id: 'pipe4',
    name: 'Pipe 4 (Production Riser Delta)',
    category: 'SUBSEA RISER',
    offsetPos: [16, -6, 16],
    metrics: '22,890 BPD • 168.5 bar • 18.0mm',
    color: '#00FFFF',
  },
  // 11. Pipe 5 (Infield Gathering Line West)
  {
    id: 'pipe5',
    name: 'Pipe 5 (Seabed Trunkline West)',
    category: 'GATHERING LINE',
    offsetPos: [-24, -8, 0],
    metrics: '16" API 5L X70 • 142.8 bar',
    color: '#34D399',
  },
  // 12. Pipe 6 (Infield Gathering Line East)
  {
    id: 'pipe6',
    name: 'Pipe 6 (Seabed Trunkline East)',
    category: 'GATHERING LINE',
    offsetPos: [24, -8, 0],
    metrics: '16" API 5L X70 • 144.1 bar',
    color: '#34D399',
  },
  // 13. Pipe 7 (Reservoir Feed North)
  {
    id: 'pipe7',
    name: 'Pipe 7 (Subsea Deep Feed North)',
    category: 'FLOWLINE',
    offsetPos: [0, -8, -24],
    metrics: '12" Inconel Clad • 210 bar',
    color: '#34D399',
  },
  // 14. Pipe 8 (Reservoir Feed South)
  {
    id: 'pipe8',
    name: 'Pipe 8 (Subsea Deep Feed South)',
    category: 'FLOWLINE',
    offsetPos: [0, -8, 24],
    metrics: '12" Inconel Clad • 208 bar',
    color: '#34D399',
  },
  // 15. Pipe 9 (Manifold Gathering Header)
  {
    id: 'pipe9',
    name: 'Pipe 9 (Dual-Header Gathering Hub)',
    category: 'MANIFOLD HEADER',
    offsetPos: [0, -12, 0],
    metrics: '20" Dual Loop • 240 bar',
    color: '#38BDF8',
  },
  // 16. Subsea Wells 1 to 7 Cluster
  {
    id: 'wells1_7',
    name: 'Subsea Wells 1–7 Christmas Tree Cluster',
    category: 'WELLHEAD HUB',
    offsetPos: [0, -18, -14],
    metrics: '7 Active Wells • 690 bar Rating',
    color: '#A855F7',
  },
];

export const JarvisSplitExplodedView: React.FC = () => {
  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);
  const setPipeSliceModalOpen = useRigStore((s) => s.setPipeSliceModalOpen);
  const selectedSplitPartId = useRigStore((s) => s.selectedSplitPartId);
  const zoomToSplitPart = useRigStore((s) => s.zoomToSplitPart);
  const openHoloModal = useRigStore((s) => s.openHoloModal);

  const groupRefs = useRef<{ [key: string]: THREE.Group | null }>({});
  const sliceGroupRef = useRef<THREE.Group>(null);
  const currentSplitFactor = useRef(0.0);

  // 3D Sliced Pipe Geometry (Half Cylinder with annular layers)
  const { outerShellGeo, innerFluidGeo, fiberGeo } = useMemo(() => {
    const outer = new THREE.CylinderGeometry(1.6, 1.6, 14, 32, 1, false, 0, Math.PI);
    const inner = new THREE.CylinderGeometry(1.35, 1.35, 13.8, 32, 1, false, 0, Math.PI);
    const fiber = new THREE.BoxGeometry(0.12, 13.9, 0.12);
    fiber.translate(0, 0, 1.55);
    return { outerShellGeo: outer, innerFluidGeo: inner, fiberGeo: fiber };
  }, []);

  useFrame((_, delta) => {
    const targetFactor = isSplitViewActive ? 1.0 : 0.0;
    currentSplitFactor.current = THREE.MathUtils.lerp(
      currentSplitFactor.current,
      targetFactor,
      delta * 3.2
    );

    const f = currentSplitFactor.current;

    // Animate each decoupled subsystem offset with spring kinematics
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
          g.position.y += Math.sin(t + mod.offsetPos[0] * 0.2) * 0.3 * f;
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
      {/* 1. JARVIS 12-MODULE EXPLODED SPLIT HUDS & CONNECTING TETHERS */}
      {SPLIT_MODULES.map((mod) => {
        const isSelected = selectedSplitPartId === mod.id;

        return (
          <group
            key={mod.id}
            ref={(el) => (groupRefs.current[mod.id] = el)}
            position={[0, 0, 0]}
          >
            {/* Holographic Interactive Targeting Bracket & 3D Gizmo */}
            {isSplitViewActive && (
              <group position={[0, 0, 0]}>
                {/* Outer Holographic Bounding Rings */}
                <mesh
                  onClick={(e) => {
                    e.stopPropagation();
                    zoomToSplitPart(mod.id);
                    openHoloModal(mod.id as HolographicComponentType);
                  }}
                  onPointerOver={() => (document.body.style.cursor = 'pointer')}
                  onPointerOut={() => (document.body.style.cursor = 'default')}
                >
                  <sphereGeometry args={[2.8, 16, 16]} />
                  <meshBasicMaterial
                    color={isSelected ? '#00FFFF' : mod.color}
                    wireframe
                    transparent
                    opacity={isSelected ? 0.45 : 0.18}
                  />
                </mesh>

                {/* Floating Cyberpunk HTML Badge */}
                <Html
                  position={[0, 3.2, 0]}
                  center
                  distanceFactor={45}
                  zIndexRange={[100, 0]}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      zoomToSplitPart(mod.id);
                      openHoloModal(mod.id as HolographicComponentType);
                    }}
                    className={`px-3 py-1.5 rounded-xl border backdrop-blur-md cursor-pointer select-none transition-all duration-200 font-mono shadow-dock ${
                      isSelected
                        ? 'bg-reliance-cyan/90 text-reliance-deepnavy border-white shadow-cyan-glow scale-110 font-bold'
                        : 'bg-reliance-deepnavy/90 text-white border-reliance-cyan/40 hover:border-reliance-cyan hover:scale-105'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full animate-ping"
                        style={{ backgroundColor: mod.color }}
                      />
                      <span className="text-[10px] tracking-wider uppercase font-extrabold">
                        {mod.name}
                      </span>
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
