import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { HOLO } from '../../shaders/HoloPalette';

interface SubsystemTargetVolume {
  id: HolographicComponentType;
  label: string;
  category: 'topside' | 'subsea' | 'bridge';
  center: THREE.Vector3;
  radius: number;
  color: string;
}

/**
 * 3D Holographic Laser Targeting Pointer & Part Identification Reticle
 * - Casts spatial ray from user's finger pointer into 3D scene.
 * - Identifies exact subsea/topside subsystem being focused/zoomed into.
 * - Displays floating cybernetic targeting HUD badge.
 * - Syncs targetedPartId with useRigStore for right-to-left swipe instant inspection.
 */
export const HolographicTargetPointer: React.FC = () => {
  const { camera } = useThree();
  const isGestureActive = useRigStore((s) => s.isGestureCameraActive);
  const setTargetedPartId = useRigStore((s) => s.setTargetedPartId);

  const reticleGroupRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const [activeTarget, setActiveTarget] = React.useState<SubsystemTargetVolume | null>(null);

  // Defined 3D Subsystem Target Volumes across KG-D6 platform
  const subsystemCatalog: SubsystemTargetVolume[] = useMemo(
    () => [
      {
        id: 'helipad',
        label: 'CAP 437 HELIDECK',
        category: 'topside',
        center: new THREE.Vector3(-22.0, 32.4, -3.2),
        radius: 12.0,
        color: HOLO.primary,
      },
      {
        id: 'crane1',
        label: 'PORT CRANE 1 (LATTICE BOOM)',
        category: 'topside',
        center: new THREE.Vector3(-3.9, 33.1, 8.5),
        radius: 14.0,
        color: HOLO.primary,
      },
      {
        id: 'crane2',
        label: 'STARBOARD CRANE 2 (PEDESTAL)',
        category: 'topside',
        center: new THREE.Vector3(-9.9, 28.4, -9.7),
        radius: 12.0,
        color: HOLO.primary,
      },
      {
        id: 'command_dock',
        label: 'TACTICAL COMMAND DOCK BRIDGE',
        category: 'bridge',
        center: new THREE.Vector3(0.0, 16.0, 0.0),
        radius: 15.0,
        color: HOLO.primary,
      },
      {
        id: 'accommodation',
        label: 'LIVING QUARTERS & MAIN DECK',
        category: 'topside',
        center: new THREE.Vector3(15.1, 18.9, -5.7),
        radius: 13.0,
        color: HOLO.primary,
      },
      {
        id: 'drill',
        label: 'ROTARY DRILL RIG & DERRICK',
        category: 'topside',
        center: new THREE.Vector3(0.0, 30.0, 0.0),
        radius: 16.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe1',
        label: 'SUBSEA PIPE 1 (RISER ALPHA)',
        category: 'subsea',
        center: new THREE.Vector3(-12.0, -18.0, 18.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe2',
        label: 'SUBSEA PIPE 2 (RISER BRAVO)',
        category: 'subsea',
        center: new THREE.Vector3(12.0, -18.0, 18.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe3',
        label: 'SUBSEA PIPE 3 (EXPORT FLOWLINE)',
        category: 'subsea',
        center: new THREE.Vector3(-12.0, -18.0, -18.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe4',
        label: 'SUBSEA PIPE 4 (GAS INJECTION)',
        category: 'subsea',
        center: new THREE.Vector3(12.0, -18.0, -18.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe5',
        label: 'SUBSEA PIPE 5 (NORTH-WEST HEADER)',
        category: 'subsea',
        center: new THREE.Vector3(-28.0, -16.0, 0.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe6',
        label: 'SUBSEA PIPE 6 (SOUTH-EAST HEADER)',
        category: 'subsea',
        center: new THREE.Vector3(28.0, -16.0, 0.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe7',
        label: 'SUBSEA PIPE 7 (WELLHEAD 07 TRUNK)',
        category: 'subsea',
        center: new THREE.Vector3(0.0, -16.0, -28.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe8',
        label: 'SUBSEA PIPE 8 (WELLHEAD 08 TRUNK)',
        category: 'subsea',
        center: new THREE.Vector3(0.0, -16.0, 28.0),
        radius: 9.0,
        color: HOLO.primary,
      },
      {
        id: 'pipe9',
        label: 'SUBSEA PIPE 9 (CORE GATHERING HEADER)',
        category: 'subsea',
        center: new THREE.Vector3(0.0, -15.5, 0.0),
        radius: 9.0,
        color: HOLO.primary,
      },
    ],
    []
  );

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const bestHit = useMemo(() => new THREE.Vector3(), []);
  const spheres = useMemo(() => subsystemCatalog.map((s) => new THREE.Sphere(s.center, s.radius)), [subsystemCatalog]);
  const lastTargetId = useRef<string | null>(null);

  // Ray-casts the fingertip into the scene every frame, but only touches React state
  // when the locked target actually changes (no 60 Hz re-renders).
  useFrame(({ clock }) => {
    if (!isGestureActive) {
      if (lastTargetId.current) {
        lastTargetId.current = null;
        setActiveTarget(null);
        setTargetedPartId(null);
      }
      return;
    }

    const { pointerCursor, gestureSpatial } = useRigStore.getState();
    const hand = gestureSpatial?.primaryHand;
    const hx = pointerCursor.active ? pointerCursor.x : hand ? hand.x : 0.5;
    const hy = pointerCursor.active ? pointerCursor.y : hand ? hand.y : 0.5;
    raycaster.setFromCamera(ndc.set(hx * 2 - 1, -(hy * 2 - 1)), camera);
    const ray = raycaster.ray;

    let closest: SubsystemTargetVolume | null = null;
    let closestDist = Infinity;
    spheres.forEach((sphere, i) => {
      if (ray.intersectSphere(sphere, hit)) {
        const d = camera.position.distanceTo(hit);
        if (d < closestDist) {
          closestDist = d;
          closest = subsystemCatalog[i];
          bestHit.copy(hit);
        }
      }
    });

    const g = reticleGroupRef.current;
    if (g) {
      if (closest) g.position.copy(bestHit);
      else ray.at(35.0, g.position);
      g.lookAt(camera.position);
    }
    if (outerRingRef.current) outerRingRef.current.rotation.z = clock.getElapsedTime() * 2.5;

    const id = closest ? (closest as SubsystemTargetVolume).id : null;
    if (id !== lastTargetId.current) {
      lastTargetId.current = id;
      setActiveTarget(closest);
      setTargetedPartId(id as HolographicComponentType | null);
    }
  });
  if (!isGestureActive) return null;

  return (
    <group ref={reticleGroupRef}>
      {/* 3D Holographic Reticle Rings */}
      <mesh ref={outerRingRef}>
        <ringGeometry args={[1.2, 1.45, 32]} />
        <meshBasicMaterial
          color={activeTarget ? HOLO.hot : HOLO.primary}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh>
        <ringGeometry args={[0.3, 0.45, 16]} />
        <meshBasicMaterial
          color={HOLO.hot}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Target Crosshair Ticks */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={8}
            array={new Float32Array([
              -2.0, 0, 0, -0.8, 0, 0,
              0.8, 0, 0, 2.0, 0, 0,
              0, -2.0, 0, 0, -0.8, 0,
              0, 0.8, 0, 0, 2.0, 0,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={activeTarget ? HOLO.hot : HOLO.primary} linewidth={2} />
      </lineSegments>

      {/* Floating 3D Holographic Target Lock Badge */}
      {activeTarget && (
        <Html position={[2.2, 1.2, 0]} center distanceFactor={28} className="pointer-events-none select-none">
          <div className="bg-black/90 border border-cyan-400/80 rounded-lg p-2 font-mono text-[10px] text-white shadow-cyan-glow backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap min-w-[180px]">
            <div className="flex items-center gap-1.5 pb-1 border-b border-cyan-400/30 text-cyan-300 font-extrabold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
              <span>🎯 TARGET LOCKED</span>
            </div>
            <div className="pt-1 text-white font-bold text-[11px]">
              {activeTarget.label}
            </div>
            <div className="text-[8px] text-cyan-400/80 pt-0.5 flex items-center justify-between">
              <span>CAT: {activeTarget.category.toUpperCase()}</span>
              <span className="text-cyan-200 font-bold">HOLD TO OPEN</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
