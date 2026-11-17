import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { HOLO, holoMaterial } from '../../shaders/HoloPalette';

interface FlowPipeDefinition {
  id: string;
  name: string;
  points: THREE.Vector3[];
  arrowCount: number;
  speed: number;
  radius: number;
}

/**
 * Subsea Pipeline Flow Network (9 Seabed Pipes & Ground Flowlines)
 * Features:
 * - 4 Curved subsea wellhead jumper loops
 * - 4 Long ground seabed pipelines extending across the terrain
 * - 1 Transverse subsea manifold gathering header
 * - Thick, high-visibility 3D arrow marks flowing continuously
 * - Reactive visual manifestation during Pipe Congestion, Hydrate Plugging & Oil Overload
 */
export const SubseaPipelineFlowNetwork: React.FC = () => {
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);
  const scannerMode = useRigStore((s) => s.scannerMode);
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);

  // Define 9 Subsea Pipes & Ground Flowlines on the seabed (Y = -16.425m)
  const pipeDefinitions: FlowPipeDefinition[] = useMemo(
    () => [
      // 1. Wellhead Jumper 1 (North-West Wellhead Loop)
      {
        id: 'JUMPER-NW',
        name: 'Wellhead Jumper D6-NW',
        points: [
          new THREE.Vector3(-26, -16.2, -26),
          new THREE.Vector3(-18, -14.0, -20),
          new THREE.Vector3(-10, -14.6, -12),
          new THREE.Vector3(-3, -15.3, -3),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 5,
        speed: 0.18,
        radius: 0.45,
      },
      // 2. Wellhead Jumper 2 (North-East Wellhead Loop)
      {
        id: 'JUMPER-NE',
        name: 'Wellhead Jumper D6-NE',
        points: [
          new THREE.Vector3(26, -16.2, -26),
          new THREE.Vector3(18, -14.0, -20),
          new THREE.Vector3(10, -14.6, -12),
          new THREE.Vector3(3, -15.3, -3),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 5,
        speed: 0.18,
        radius: 0.45,
      },
      // 3. Wellhead Jumper 3 (South-West Wellhead Loop)
      {
        id: 'JUMPER-SW',
        name: 'Wellhead Jumper D6-SW',
        points: [
          new THREE.Vector3(-26, -16.2, 26),
          new THREE.Vector3(-18, -14.0, 20),
          new THREE.Vector3(-10, -14.6, 12),
          new THREE.Vector3(-3, -15.3, 3),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 5,
        speed: 0.18,
        radius: 0.45,
      },
      // 4. Wellhead Jumper 4 (South-East Wellhead Loop)
      {
        id: 'JUMPER-SE',
        name: 'Wellhead Jumper D6-SE',
        points: [
          new THREE.Vector3(26, -16.2, 26),
          new THREE.Vector3(18, -14.0, 20),
          new THREE.Vector3(10, -14.6, 12),
          new THREE.Vector3(3, -15.3, 3),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 5,
        speed: 0.18,
        radius: 0.45,
      },
      // 5. Ground Pipeline West (Infield Gathering Trunkline)
      {
        id: 'GROUND-PIPE-W',
        name: 'Seabed Gathering Line West',
        points: [
          new THREE.Vector3(-52, -16.1, -6),
          new THREE.Vector3(-38, -16.1, -5),
          new THREE.Vector3(-24, -16.1, -3),
          new THREE.Vector3(-10, -15.8, -1),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 6,
        speed: 0.14,
        radius: 0.55,
      },
      // 6. Ground Pipeline East (Infield Gathering Trunkline)
      {
        id: 'GROUND-PIPE-E',
        name: 'Seabed Gathering Line East',
        points: [
          new THREE.Vector3(52, -16.1, 6),
          new THREE.Vector3(38, -16.1, 5),
          new THREE.Vector3(24, -16.1, 3),
          new THREE.Vector3(10, -15.8, 1),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 6,
        speed: 0.14,
        radius: 0.55,
      },
      // 7. Ground Pipeline North (Deep Field Feed Line)
      {
        id: 'GROUND-PIPE-N',
        name: 'Subsea Reservoir Feed North',
        points: [
          new THREE.Vector3(-6, -16.1, -52),
          new THREE.Vector3(-5, -16.1, -38),
          new THREE.Vector3(-3, -16.1, -22),
          new THREE.Vector3(-1, -15.8, -8),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 6,
        speed: 0.14,
        radius: 0.55,
      },
      // 8. Ground Pipeline South (Deep Field Feed Line)
      {
        id: 'GROUND-PIPE-S',
        name: 'Subsea Reservoir Feed South',
        points: [
          new THREE.Vector3(6, -16.1, 52),
          new THREE.Vector3(5, -16.1, 38),
          new THREE.Vector3(3, -16.1, 22),
          new THREE.Vector3(1, -15.8, 8),
          new THREE.Vector3(0, -15.5, 0),
        ],
        arrowCount: 6,
        speed: 0.14,
        radius: 0.55,
      },
      // 9. Subsea Manifold Transverse Dual Header
      {
        id: 'MANIFOLD-HEADER',
        name: 'Dual-Header Gathering Manifold',
        points: [
          new THREE.Vector3(-16, -15.2, 0),
          new THREE.Vector3(-8, -15.2, 0),
          new THREE.Vector3(0, -15.2, 0),
          new THREE.Vector3(8, -15.2, 0),
          new THREE.Vector3(16, -15.2, 0),
        ],
        arrowCount: 4,
        speed: 0.22,
        radius: 0.65,
      },
    ],
    []
  );

  // Build 3D Tube Geometries & Curves
  const pipeData = useMemo(() => {
    return pipeDefinitions.map((def) => {
      const curve = new THREE.CatmullRomCurve3(def.points);
      const tubeGeo = new THREE.TubeGeometry(curve, 48, def.radius, 12, false);
      return {
        ...def,
        curve,
        tubeGeo,
      };
    });
  }, [pipeDefinitions]);

  // Thick 3D Arrow Mark Geometry (Thick Chevron Cone + Thick Cylinder Stem)
  const thickArrowGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const coneGeo = new THREE.ConeGeometry(0.72, 1.8, 16);
    coneGeo.translate(0, 0.9, 0); // Cone sits on top

    const stemGeo = new THREE.CylinderGeometry(0.36, 0.36, 1.5, 16);
    stemGeo.translate(0, -0.75, 0); // Thick stem below cone

    const conePos = coneGeo.attributes.position.array;
    const stemPos = stemGeo.attributes.position.array;
    const coneNorm = coneGeo.attributes.normal.array;
    const stemNorm = stemGeo.attributes.normal.array;

    const mergedPos = new Float32Array(conePos.length + stemPos.length);
    mergedPos.set(conePos, 0);
    mergedPos.set(stemPos, conePos.length);

    const mergedNorm = new Float32Array(coneNorm.length + stemNorm.length);
    mergedNorm.set(coneNorm, 0);
    mergedNorm.set(stemNorm, coneNorm.length);

    geo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));

    return geo;
  }, []);

  // Hologram materials: state is shown by brightness, not colour.
  // Blockage dims the flow arrows and makes the pipe walls flare; overload brightens the flow.
  const isBlockageActive = emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug';
  const isOverloadActive = emergencyScenario === 'oil_overload';
  const dynamicArrowMat = holoMaterial({
    color: isOverloadActive ? HOLO.hot : HOLO.primary,
    opacity: isBlockageActive ? (incidentPhase >= 3 ? 0.2 : 0.45) : isOverloadActive ? 0.95 : 0.8,
  });
  const pipeMaterial = holoMaterial({
    color: isBlockageActive && incidentPhase >= 2 ? HOLO.hot : HOLO.mid,
    opacity: isBlockageActive && incidentPhase >= 2 ? 0.55 : 0.3,
  });
  const flangeMaterial = holoMaterial({ color: HOLO.primary, opacity: 0.6 });
  // References for all moving arrows across all 9 pipes
  const arrowMeshRefs = useRef<(THREE.Mesh | null)[][]>(
    pipeData.map((p) => new Array(p.arrowCount).fill(null))
  );

  const blockageBeaconRef = useRef<THREE.Group>(null);
  const pipeGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const explode = useRef(0);
  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const anyPanelOpen = useRigStore((s) => !!s.activeHoloModal || s.isEodModalOpen || s.isSihModalOpen || s.isReportModalOpen);

  // Exploded view: each of the 9 pipes slides away from the manifold on its own line —
  // outward along the direction it comes from, and slightly down; the header drops below.
  const explodeOffsets = useMemo(
    () =>
      pipeDefinitions.map((def) => {
        const start = def.points[0];
        const dir = new THREE.Vector2(start.x, start.z);
        if (def.id === 'MANIFOLD-HEADER' || dir.lengthSq() < 1) return new THREE.Vector3(0, -10, 0);
        dir.normalize().multiplyScalar(def.id.startsWith('JUMPER') ? 16 : 24);
        return new THREE.Vector3(dir.x, -4, dir.y);
      }),
    [pipeDefinitions]
  );

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();

    const target = useRigStore.getState().isSplitViewActive ? 1 : 0;
    explode.current += (target - explode.current) * Math.min(1, delta * 4);
    const ease = explode.current * explode.current * (3 - 2 * explode.current);
    pipeGroupRefs.current.forEach((g, i) => g && g.position.copy(explodeOffsets[i]).multiplyScalar(ease));
    const upVector = new THREE.Vector3(0, 1, 0);

    // Speed multiplier based on incident
    const isBlockage = emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug';
    const isOverload = emergencyScenario === 'oil_overload';

    let speedMul = 1.0;
    if (isBlockage) {
      speedMul = incidentPhase === 1 ? 0.6 : incidentPhase === 2 ? 0.25 : incidentPhase === 3 ? 0.02 : 0.8;
    } else if (isOverload) {
      speedMul = 1.0 + incidentPhase * 0.45; // Surges up to 2.8x speed
    }

    pipeData.forEach((pipe, pipeIdx) => {
      const meshes = arrowMeshRefs.current[pipeIdx];
      if (!meshes) return;

      meshes.forEach((mesh, arrowIdx) => {
        if (!mesh) return;

        const baseOffset = arrowIdx / pipe.arrowCount;
        const progress = (baseOffset + time * pipe.speed * speedMul) % 1.0;

        const point = pipe.curve.getPointAt(progress);
        const tangent = pipe.curve.getTangentAt(progress).normalize();

        mesh.position.copy(point);
        mesh.quaternion.setFromUnitVectors(upVector, tangent);

        // Subtle pulsing scale
        const pulse = Math.sin(time * 5.0 + arrowIdx + pipeIdx) * 0.1 + 1.0;
        mesh.scale.set(pulse, pulse, pulse);
      });
    });

    // Animate Blockage Warning Beacon if blockage is active
    if (blockageBeaconRef.current && isBlockage) {
      blockageBeaconRef.current.rotation.y = time * 3.0;
      const s = 1.0 + Math.sin(time * 8.0) * 0.2;
      blockageBeaconRef.current.scale.set(s, s, s);
    }
  });

  const isBlockage = emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug';

  return (
    <group
      position={[0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedAssetId('MANIFOLD-D6-MAIN');
        varunaVoice.speakDiagnostic('MANIFOLD-D6-MAIN');
      }}
    >
      {/* 9 Subsea Pipe Tubes + Animated Thick Glowing Arrows + 3D Holographic Labels */}
      {pipeData.map((pipe, pipeIdx) => {
        const pipeKey = `pipe${pipeIdx + 1}` as HolographicComponentType;
        const midPoint = pipe.points[Math.floor(pipe.points.length / 2)] || pipe.points[0];

        return (
          <group key={pipe.id} ref={(el) => (pipeGroupRefs.current[pipeIdx] = el)}>
            {isSplitViewActive && !anyPanelOpen && (
              <Html position={midPoint.toArray()} center zIndexRange={[20, 0]}>
                <button
                  onClick={() => {
                    useRigStore.getState().openHoloModal(pipeKey);
                  }}
                  className="whitespace-nowrap px-2 py-0.5 rounded-md border font-mono text-[10px] tracking-wider uppercase backdrop-blur-sm bg-slate-950/70 text-cyan-200 border-cyan-400/40 hover:border-cyan-300 hover:text-white"
                >
                  Pipe {pipeIdx + 1}
                </button>
              </Html>
            )}
            {/* Static Subsea Pipe Tube */}
            <mesh
              geometry={pipe.tubeGeo}
              material={pipeMaterial}
              onClick={(e) => {
                e.stopPropagation();
                useRigStore.getState().openHoloModal(pipeKey);
                useRigStore.getState().setCameraViewMode(pipeKey);
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = 'default')}
            />

            {/* Wellhead / Pipeline Ground Connection Flanges */}
            <mesh position={pipe.points[0]} material={flangeMaterial}>
              <cylinderGeometry args={[pipe.radius * 1.6, pipe.radius * 1.6, 0.8, 16]} />
            </mesh>

            {/* Animated Thick Glowing Dark Blue / Alert Arrows moving along the pipe */}
            {Array.from({ length: pipe.arrowCount }).map((_, arrowIdx) => (
              <mesh
                key={`arrow-${pipe.id}-${arrowIdx}`}
                ref={(el) => {
                  if (!arrowMeshRefs.current[pipeIdx]) {
                    arrowMeshRefs.current[pipeIdx] = [];
                  }
                  arrowMeshRefs.current[pipeIdx][arrowIdx] = el;
                }}
                geometry={thickArrowGeo}
                material={dynamicArrowMat}
              />
            ))}
          </group>
        );
      })}

      {/* 3D Pulsing Obstruction Beacon at the Manifold Blockage Junction */}
      {isBlockage && (
        <group ref={blockageBeaconRef} position={[0, -14.8, 0]}>
          <mesh material={holoMaterial({ color: HOLO.hot, opacity: 0.9, wireframe: true })}>
            <sphereGeometry args={[1.2, 16, 12]} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={holoMaterial({ color: HOLO.hot, opacity: 0.8 })}>
            <ringGeometry args={[1.8, 2.4, 48]} />
          </mesh>
        </group>
      )}
    </group>
  );
};
