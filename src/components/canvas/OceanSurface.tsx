import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createOceanMaterial } from '../../shaders/OceanShader';
import { useRigStore } from '../../store/useRigStore';

/**
 * Realistic Transparent Ocean Surface situated at Y = 0 (below the topside rig)
 * Seamless 360-degree all-around water visibility with dual-sided transparency.
 */
export const OceanSurface: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const metoceanCondition = useRigStore((s) => s.metoceanCondition);

  const oceanMaterial = useMemo(() => createOceanMaterial(), []);

  // Water surface plane (110m x 110m) exactly matching the land below
  const oceanGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(110, 110, 64, 64);
  }, []);

  const scannerMode = useRigStore((s) => s.scannerMode);
  const currentDirectionDeg = useRigStore((s) => s.currentDirectionDeg);
  const currentSpeedKnots = useRigStore((s) => s.currentSpeedKnots);
  const currentFlowPower = useRigStore((s) => s.currentFlowPower);

  useFrame(({ clock }) => {
    if (oceanMaterial) {
      // Scale wave time speed with water flow velocity
      const speedFactor = Math.max(0.3, currentSpeedKnots / 2.4);
      const t = clock.getElapsedTime() * speedFactor;
      oceanMaterial.uniforms.uTime.value = t;

      // Scale wave height with flow power
      let waveScale = 1.0;
      if (currentFlowPower === 'slow') waveScale = 0.45;
      else if (currentFlowPower === 'moderate') waveScale = 1.0;
      else if (currentFlowPower === 'fast') waveScale = 1.8;
      else if (currentFlowPower === 'extreme') waveScale = 3.2;

      oceanMaterial.uniforms.uWaveHeightScale.value = waveScale;
      oceanMaterial.uniforms.uIsUnderwater.value = camera.position.y < 0 ? 1.0 : 0.0;
      oceanMaterial.uniforms.uCameraPosition.value.copy(camera.position);

      // Align wave vectors with water current flow heading
      const dirRad = (currentDirectionDeg * Math.PI) / 180;
      const dX = Math.sin(dirRad);
      const dZ = Math.cos(dirRad);

      oceanMaterial.uniforms.uWaveA.value.set(dX, dZ, 0.22, 45.0);
      oceanMaterial.uniforms.uWaveB.value.set(
        dX * 0.86 + dZ * 0.5,
        dZ * 0.86 - dX * 0.5,
        0.16,
        28.0
      );
      oceanMaterial.uniforms.uWaveC.value.set(
        dX * 0.7 - dZ * 0.7,
        dZ * 0.7 + dX * 0.7,
        0.11,
        16.0
      );

      if (scannerMode === 'hologram') {
        oceanMaterial.uniforms.uDeepColor.value.set('#001830');
        oceanMaterial.uniforms.uShallowColor.value.set('#00E5FF');
        oceanMaterial.uniforms.uFoamColor.value.set('#00FFFF');
      } else {
        oceanMaterial.uniforms.uDeepColor.value.set('#002B49');
        oceanMaterial.uniforms.uShallowColor.value.set('#0077B6');
        oceanMaterial.uniforms.uFoamColor.value.set('#E0F7FA');
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={oceanGeometry}
      material={oceanMaterial}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      renderOrder={1}
    />
  );
};
