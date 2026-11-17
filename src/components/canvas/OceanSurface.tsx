import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createOceanMaterial } from '../../shaders/OceanShader';
import { useRigStore } from '../../store/useRigStore';

// Wave height multiplier per sea state
const WAVE_SCALE: Record<string, number> = {
  slow: 0.45,
  moderate: 1.0,
  fast: 1.8,
  extreme: 3.2,
  storm: 4.8,
};

/**
 * Holographic sea surface at Y = 0: a single uniform dark tone with glowing wave-crest
 * contour lines. Wave phase is integrated over time, so changing the current speed
 * changes the wave speed smoothly instead of making the sea jump.
 */
export const OceanSurface: React.FC = () => {
  const { camera } = useThree();
  const oceanMaterial = useMemo(() => createOceanMaterial(), []);
  const oceanGeometry = useMemo(() => new THREE.PlaneGeometry(700, 700, 260, 260), []);
  const phase = useRef(0);
  const waveScale = useRef(1);

  useFrame((_, delta) => {
    const { currentSpeedKnots, currentDirectionDeg, currentFlowPower } = useRigStore.getState();
    const u = oceanMaterial.uniforms;

    // Wave clock runs faster with stronger current (2.4 kn = nominal)
    phase.current += Math.min(delta, 0.1) * Math.max(0.3, currentSpeedKnots / 2.4);
    u.uTime.value = phase.current;

    // Ease sea-state changes over ~1 s
    const target = WAVE_SCALE[currentFlowPower] ?? 1.0;
    waveScale.current += (target - waveScale.current) * Math.min(1, delta * 1.5);
    u.uWaveHeightScale.value = waveScale.current;
    u.uIsUnderwater.value = camera.position.y < 0 ? 1.0 : 0.0;

    // Align wave trains with the current heading
    const dirRad = (currentDirectionDeg * Math.PI) / 180;
    const dX = Math.sin(dirRad);
    const dZ = Math.cos(dirRad);
    u.uWaveA.value.set(dX, dZ, 0.22, 45.0);
    u.uWaveB.value.set(dX * 0.86 + dZ * 0.5, dZ * 0.86 - dX * 0.5, 0.16, 28.0);
    u.uWaveC.value.set(dX * 0.7 - dZ * 0.7, dZ * 0.7 + dX * 0.7, 0.11, 16.0);
  });

  return <mesh geometry={oceanGeometry} material={oceanMaterial} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} />;
};
