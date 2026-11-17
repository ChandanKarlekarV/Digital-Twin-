import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useRigStore } from '../../store/useRigStore';
import { HOLO, holoMaterial } from '../../shaders/HoloPalette';

const VECTOR_COUNT = 36;
const BOUNDS_XZ = 95.0;
const KNOTS_TO_MS = 0.5144;
/** Streamlines are shown 4x real speed so a 1-knot current is still visibly moving */
const VISUAL_SPEED_GAIN = 4.0;

const UP = new THREE.Vector3(0, 1, 0);
const flowDir = new THREE.Vector3();

/**
 * Ocean current streamlines and a floating current compass, in hologram style.
 * Drift is integrated per frame from the live current speed (knots -> m/s), so changing
 * the speed or heading changes the motion smoothly. Brightness rises with flow power.
 */
export const OceanCurrentVisualizer: React.FC = () => {
  const currentFlowPower = useRigStore((s) => s.currentFlowPower);

  const chevronGeo = useMemo(() => {
    const cone = new THREE.ConeGeometry(0.55, 1.6, 10);
    cone.translate(0, 0.8, 0);
    const stem = new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8);
    stem.translate(0, -0.6, 0);
    return mergeGeometries([cone, stem])!;
  }, []);

  const opacity =
    currentFlowPower === 'storm' ? 0.95 : currentFlowPower === 'extreme' ? 0.8 : currentFlowPower === 'fast' ? 0.65 : 0.45;
  const streamlineMaterial = holoMaterial({ color: currentFlowPower === 'storm' ? HOLO.hot : HOLO.primary, opacity });

  const particles = useMemo(
    () =>
      Array.from({ length: VECTOR_COUNT }, () => ({
        x: (Math.random() - 0.5) * BOUNDS_XZ,
        y: -Math.random() * 14.0 - 0.5, // water column above the seabed
        z: (Math.random() - 0.5) * BOUNDS_XZ,
        speedMul: 0.85 + Math.random() * 0.35,
        seed: Math.random() * 10,
      })),
    []
  );

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const compassArrowRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const { currentSpeedKnots, currentDirectionDeg } = useRigStore.getState();
    const t = clock.getElapsedTime();
    const dirRad = (currentDirectionDeg * Math.PI) / 180;
    const dirX = Math.sin(dirRad);
    const dirZ = Math.cos(dirRad);
    flowDir.set(dirX, 0, dirZ);
    const step = currentSpeedKnots * KNOTS_TO_MS * VISUAL_SPEED_GAIN * Math.min(delta, 0.1);
    const half = BOUNDS_XZ / 2;

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = particles[i];
      p.x += dirX * step * p.speedMul;
      p.z += dirZ * step * p.speedMul;
      // wrap inside the bounds
      if (p.x > half) p.x -= BOUNDS_XZ;
      else if (p.x < -half) p.x += BOUNDS_XZ;
      if (p.z > half) p.z -= BOUNDS_XZ;
      else if (p.z < -half) p.z += BOUNDS_XZ;

      mesh.position.set(p.x, p.y + Math.sin(t * 1.2 + p.seed) * 0.3, p.z);
      mesh.quaternion.setFromUnitVectors(UP, flowDir);
    });

    if (compassArrowRef.current) {
      compassArrowRef.current.rotation.y = dirRad;
      compassArrowRef.current.position.y = Math.sin(t * 1.8) * 0.4;
    }
  });

  return (
    <group>
      {particles.map((_, i) => (
        <mesh key={i} ref={(el) => (meshRefs.current[i] = el)} geometry={chevronGeo} material={streamlineMaterial} />
      ))}

      {/* Floating current compass beacon */}
      <group position={[38, 0, 38]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={holoMaterial({ color: HOLO.mid, opacity: 0.6 })}>
          <torusGeometry args={[3.2, 0.25, 12, 48]} />
        </mesh>
        <group ref={compassArrowRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.6, 1.8]} material={holoMaterial({ color: HOLO.hot, opacity: 0.9 })}>
            <coneGeometry args={[0.9, 2.5, 16]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.6, -0.6]} material={holoMaterial({ color: HOLO.primary, opacity: 0.6 })}>
            <cylinderGeometry args={[0.3, 0.3, 2.4, 12]} />
          </mesh>
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={holoMaterial({ color: HOLO.primary, opacity: 0.45 })}>
          <ringGeometry args={[3.8, 4.1, 64]} />
        </mesh>
      </group>
    </group>
  );
};
