import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useRigStore } from '../../../store/useRigStore';
import { useTelemetryStore } from '../../../store/useTelemetryStore';

/**
 * Gamma Radiometric Tomography Mode (Virtual MPFM Cross-Section)
 * Visualizes 3-phase fluid segregation (Gas Core, Oil Intermediate Layer, Water Boundary)
 * and multi-chord gamma ray attenuation rays.
 */
export const GammaCrossSection: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const rayGroupRef = useRef<THREE.Group>(null);
  const scannerMode = useRigStore((s) => s.scannerMode);
  const currentRecord = useTelemetryStore((s) => s.currentRecord);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.05;
    }
    if (rayGroupRef.current) {
      rayGroupRef.current.rotation.z = t * 0.4;
    }
  });

  if (scannerMode !== 'gamma') return null;

  const waterCut = currentRecord ? currentRecord.water_cut_pct : 4.2;
  const gasFraction = 0.35; // 35% GVF in core

  return (
    <group position={[-14, -45, -7]}>
      {/* 1. Main Tomography Disc Slice */}
      <group ref={groupRef}>
        {/* Outer Steel Pipe Wall */}
        <mesh>
          <ringGeometry args={[4.2, 5.0, 48]} />
          <meshBasicMaterial color="#004B87" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>

        {/* Phase 1: Annular Water Boundary (Bottom/Perimeter ring) */}
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry args={[3.2, 4.2, 48]} />
          <meshBasicMaterial
            color="#0088FF"
            side={THREE.DoubleSide}
            transparent
            opacity={0.65 + (waterCut / 100) * 0.3}
          />
        </mesh>

        {/* Phase 2: Intermediate Oil Hydrocarbon Layer */}
        <mesh position={[0, 0, 0.04]}>
          <ringGeometry args={[1.8, 3.2, 48]} />
          <meshBasicMaterial color="#FFAA00" side={THREE.DoubleSide} transparent opacity={0.75} />
        </mesh>

        {/* Phase 3: High-Velocity Gas Core Void */}
        <mesh position={[0, 0, 0.06]}>
          <circleGeometry args={[1.8, 32]} />
          <meshBasicMaterial color="#00F0FF" side={THREE.DoubleSide} transparent opacity={0.55} />
        </mesh>

        {/* Tomography Sensor Ring Brackets */}
        <mesh position={[0, 0, 0.08]}>
          <ringGeometry args={[5.2, 5.4, 32]} />
          <meshBasicMaterial color="#ED1B24" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 2. Rotating Gamma Ray Attenuation Beams */}
      <group ref={rayGroupRef} position={[0, 0, 0.1]}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((angle, idx) => (
          <mesh key={`gamma-beam-${idx}`} rotation={[0, 0, angle]}>
            <planeGeometry args={[10.5, 0.08]} />
            <meshBasicMaterial color="#00F0FF" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>

      {/* 3. Floating 3D HUD Diagnostics Overlay */}
      <Html position={[6.5, 3, 0]} distanceFactor={35} className="pointer-events-none">
        <div className="p-3.5 rounded-xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 shadow-cyan-glow w-64 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-reliance-cyan/20 pb-1.5 mb-2">
            <span className="text-reliance-cyan font-bold text-[11px] uppercase">
              GAMMA TOMOGRAPHY (MPFM)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
              Cs-137 / Ba-133
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-reliance-textMuted">Gas Void Fraction (GVF):</span>
              <span className="text-reliance-cyan font-bold">{(gasFraction * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-reliance-textMuted">Oil Phase Volume:</span>
              <span className="text-amber-400 font-bold">{(100 - waterCut - gasFraction * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-reliance-textMuted">Water-Cut (WC):</span>
              <span className="text-sky-400 font-bold">{waterCut.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-white/10 text-[10px]">
              <span className="text-reliance-textMuted">Attenuation ($\mu\rho x$):</span>
              <span className="text-white font-bold">0.428 cm⁻¹</span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};
