/**
 * Pipe 1 (riser alpha) holographic cross-section shown when the pipe is sliced.
 * (The exploded view itself is done by CustomObjRig, which moves the model's real parts.)
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useRigStore } from '../../store/useRigStore';
import { HOLO, holoMaterial } from '../../shaders/HoloPalette';

export const PipeSliceView: React.FC = () => {
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);
  const isPipeSliceModalOpen = useRigStore((s) => s.isPipeSliceModalOpen);
  const activeHoloModal = useRigStore((s) => s.activeHoloModal);
  const setPipeSliceModalOpen = useRigStore((s) => s.setPipeSliceModalOpen);

  const sliceGroupRef = useRef<THREE.Group>(null);

  // 3D Sliced Pipe Geometry (Half Cylinder with annular layers)
  const { outerShellGeo, innerFluidGeo, fiberGeo } = useMemo(() => {
    const outer = new THREE.CylinderGeometry(1.6, 1.6, 14, 32, 1, false, 0, Math.PI);
    const inner = new THREE.CylinderGeometry(1.35, 1.35, 13.8, 32, 1, false, 0, Math.PI);
    const fiber = new THREE.BoxGeometry(0.12, 13.9, 0.12);
    fiber.translate(0, 0, 1.55);
    return { outerShellGeo: outer, innerFluidGeo: inner, fiberGeo: fiber };
  }, []);

  useFrame(() => {
    // Animate fluid pulse inside sliced pipe
    if (sliceGroupRef.current && isPipeSliced) {
      const t = performance.now() * 0.003;
      sliceGroupRef.current.rotation.y = Math.sin(t * 0.5) * 0.15 + Math.PI / 4;
    }
  });

  return (
    <group position={[0, 0, 0]}>
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
          <mesh geometry={outerShellGeo} material={holoMaterial({ color: HOLO.mid, opacity: 0.45 })} />

          {/* Inner Multi-Phase Oil & Gas Fluid Core */}
          <mesh geometry={innerFluidGeo} material={holoMaterial({ color: HOLO.primary, opacity: 0.7 })} />

          {/* Embedded Optical Fiber Sensor Line */}
          <mesh geometry={fiberGeo} material={holoMaterial({ color: HOLO.hot, opacity: 0.95 })} />

          {/* Sliced Pipe 3D Hologram Callout */}
          {!activeHoloModal && !isPipeSliceModalOpen && (
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
          )}
        </group>
      )}
    </group>
  );
};
