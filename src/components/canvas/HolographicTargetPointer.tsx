import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';

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
  const [targetPoint, setTargetPoint] = React.useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const [isHovered, setIsHovered] = React.useState(false);

  // Defined 3D Subsystem Target Volumes across KG-D6 platform
  const subsystemCatalog: SubsystemTargetVolume[] = useMemo(
    () => [
      {
        id: 'helipad',
        label: 'CAP 437 HELIDECK',
        category: 'topside',
        center: new THREE.Vector3(-22.0, 32.4, -3.2),
        radius: 12.0,
        color: '#00FF66',
      },
      {
        id: 'crane1',
        label: 'PORT CRANE 1 (LATTICE BOOM)',
        category: 'topside',
        center: new THREE.Vector3(-3.9, 33.1, 8.5),
        radius: 14.0,
        color: '#FF9900',
      },
      {
        id: 'crane2',
        label: 'STARBOARD CRANE 2 (PEDESTAL)',
        category: 'topside',
        center: new THREE.Vector3(-9.9, 28.4, -9.7),
        radius: 12.0,
        color: '#FF007F',
      },
      {
        id: 'command_dock',
        label: 'TACTICAL COMMAND DOCK BRIDGE',
        category: 'bridge',
        center: new THREE.Vector3(0.0, 16.0, 0.0),
        radius: 15.0,
        color: '#00E5FF',
      },
      {
        id: 'accommodation',
        label: 'LIVING QUARTERS & MAIN DECK',
        category: 'topside',
        center: new THREE.Vector3(15.1, 18.9, -5.7),
        radius: 13.0,
        color: '#FFEA00',
      },
      {
        id: 'drill',
        label: 'ROTARY DRILL RIG & DERRICK',
        category: 'topside',
        center: new THREE.Vector3(0.0, 30.0, 0.0),
        radius: 16.0,
        color: '#00F0FF',
      },
      {
        id: 'pipe1',
        label: 'SUBSEA PIPE 1 (RISER ALPHA)',
        category: 'subsea',
        center: new THREE.Vector3(-12.0, -18.0, 18.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe2',
        label: 'SUBSEA PIPE 2 (RISER BRAVO)',
        category: 'subsea',
        center: new THREE.Vector3(12.0, -18.0, 18.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe3',
        label: 'SUBSEA PIPE 3 (EXPORT FLOWLINE)',
        category: 'subsea',
        center: new THREE.Vector3(-12.0, -18.0, -18.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe4',
        label: 'SUBSEA PIPE 4 (GAS INJECTION)',
        category: 'subsea',
        center: new THREE.Vector3(12.0, -18.0, -18.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe5',
        label: 'SUBSEA PIPE 5 (NORTH-WEST HEADER)',
        category: 'subsea',
        center: new THREE.Vector3(-28.0, -16.0, 0.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe6',
        label: 'SUBSEA PIPE 6 (SOUTH-EAST HEADER)',
        category: 'subsea',
        center: new THREE.Vector3(28.0, -16.0, 0.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe7',
        label: 'SUBSEA PIPE 7 (WELLHEAD 07 TRUNK)',
        category: 'subsea',
        center: new THREE.Vector3(0.0, -16.0, -28.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe8',
        label: 'SUBSEA PIPE 8 (WELLHEAD 08 TRUNK)',
        category: 'subsea',
        center: new THREE.Vector3(0.0, -16.0, 28.0),
        radius: 9.0,
        color: '#00E5FF',
      },
      {
        id: 'pipe9',
        label: 'SUBSEA PIPE 9 (CORE GATHERING HEADER)',
        category: 'subsea',
        center: new THREE.Vector3(0.0, -15.5, 0.0),
        radius: 9.0,
        color: '#00E5FF',
      },
    ],
    []
  );

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const tempRayOrigin = useMemo(() => new THREE.Vector3(), []);
  const tempRayDir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!isGestureActive) {
      if (isHovered) {
        setIsHovered(false);
        setActiveTarget(null);
        setTargetedPartId(null);
      }
      return;
    }

    const t = clock.getElapsedTime();
    const spatial = useRigStore.getState().gestureSpatial;

    // Determine 2D screen pointer coordinate from primary hand pointing finger or centroid
    const hand = spatial?.primaryHand;
    const hx = hand ? hand.x : spatial?.deltaX ? 0.5 + spatial.deltaX * 5 : 0.5;
    const hy = hand ? hand.y : spatial?.deltaY ? 0.5 + spatial.deltaY * 5 : 0.5;

    // Convert to Normalized Device Coordinates (NDC: -1 to +1)
    const ndcX = hx * 2.0 - 1.0;
    const ndcY = -(hy * 2.0 - 1.0);

    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const ray = raycaster.ray;

    // Find closest intersecting subsystem volume
    let closestTarget: SubsystemTargetVolume | null = null;
    let closestDist = Infinity;
    let hitPosition = new THREE.Vector3();

    subsystemCatalog.forEach((subsys) => {
      // Ray-Sphere distance test
      const sphere = new THREE.Sphere(subsys.center, subsys.radius);
      const targetPointOnRay = new THREE.Vector3();
      const hasIntersection = ray.intersectSphere(sphere, targetPointOnRay);

      if (hasIntersection) {
        const distFromCam = camera.position.distanceTo(targetPointOnRay);
        if (distFromCam < closestDist) {
          closestDist = distFromCam;
          closestTarget = subsys;
          hitPosition.copy(targetPointOnRay);
        }
      }
    });

    if (closestTarget) {
      setIsHovered(true);
      setActiveTarget(closestTarget);
      setTargetPoint(hitPosition);
      setTargetedPartId((closestTarget as SubsystemTargetVolume).id);

      if (reticleGroupRef.current) {
        reticleGroupRef.current.position.copy(hitPosition);
        reticleGroupRef.current.lookAt(camera.position);
      }

      if (outerRingRef.current) {
        outerRingRef.current.rotation.z = t * 2.5;
      }
    } else {
      // If no direct bounding volume hit, project default reticle at fixed ray distance
      ray.at(35.0, tempRayOrigin);
      setTargetPoint(tempRayOrigin);

      if (reticleGroupRef.current) {
        reticleGroupRef.current.position.copy(tempRayOrigin);
        reticleGroupRef.current.lookAt(camera.position);
      }

      if (isHovered) {
        setIsHovered(false);
        setActiveTarget(null);
        setTargetedPartId(null);
      }
    }
  });

  if (!isGestureActive) return null;

  return (
    <group ref={reticleGroupRef}>
      {/* 3D Holographic Reticle Rings */}
      <mesh ref={outerRingRef}>
        <ringGeometry args={[1.2, 1.45, 32]} />
        <meshBasicMaterial
          color={activeTarget ? activeTarget.color : '#00ffff'}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh>
        <ringGeometry args={[0.3, 0.45, 16]} />
        <meshBasicMaterial
          color="#ffffff"
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
        <lineBasicMaterial color={activeTarget ? activeTarget.color : '#00ffff'} linewidth={2} />
      </lineSegments>

      {/* Floating 3D Holographic Target Lock Badge */}
      {activeTarget && (
        <Html position={[2.2, 1.2, 0]} center distanceFactor={28} className="pointer-events-none select-none">
          <div className="bg-black/90 border border-cyan-400/80 rounded-lg p-2 font-mono text-[10px] text-white shadow-cyan-glow backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap min-w-[180px]">
            <div className="flex items-center gap-1.5 pb-1 border-b border-cyan-400/30 text-cyan-300 font-extrabold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>🎯 TARGET LOCKED</span>
            </div>
            <div className="pt-1 text-white font-bold text-[11px]">
              {activeTarget.label}
            </div>
            <div className="text-[8px] text-cyan-400/80 pt-0.5 flex items-center justify-between">
              <span>CAT: {activeTarget.category.toUpperCase()}</span>
              <span className="text-amber-300 font-bold">SWIPE LEFT ◀ TO OPEN</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
