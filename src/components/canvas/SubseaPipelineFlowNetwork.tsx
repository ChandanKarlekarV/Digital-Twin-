import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

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

  // Dynamic Flow Arrow Material based on Emergency State
  const dynamicArrowMat = useMemo(() => {
    const isBlockage = emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug';
    const isOverload = emergencyScenario === 'oil_overload';

    let coreColor = '#001F66';
    let emissiveColor = '#0044FF';
    let intensity = 3.5;

    if (isBlockage) {
      if (incidentPhase >= 3) {
        coreColor = '#7F1D1D'; // Critical Dark Red
        emissiveColor = '#EF4444'; // Flashing Red
        intensity = 4.5;
      } else {
        coreColor = '#78350F'; // Amber warning
        emissiveColor = '#F59E0B';
        intensity = 3.8;
      }
    } else if (isOverload) {
      coreColor = '#FF4500'; // Orange-Red Surge
      emissiveColor = '#FFAA00'; // Bright Gold Glow
      intensity = 5.0;
    }

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(coreColor),
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity: intensity,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
  }, [emergencyScenario, incidentPhase]);

  // Steel Pipe Material with Holographic & Blockage Warning support
  const pipeMaterial = useMemo(() => {
    const isHolo = scannerMode === 'hologram';
    const isBlockage = (emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug') && incidentPhase >= 2;

    let base = isHolo ? '#002B4D' : '#64748B';
    let emissive = isHolo ? '#00E5FF' : '#001122';
    let emissiveIntensity = isHolo ? 0.35 : 0.1;

    if (isBlockage) {
      base = '#450A0A';
      emissive = '#DC2626';
      emissiveIntensity = 0.8;
    }

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(base),
      roughness: 0.38,
      metalness: 0.75,
      emissive: new THREE.Color(emissive),
      emissiveIntensity,
      transparent: isHolo,
      opacity: isHolo ? 0.75 : 1.0,
      side: THREE.DoubleSide,
    });
  }, [scannerMode, emergencyScenario, incidentPhase]);

  // References for all moving arrows across all 9 pipes
  const arrowMeshRefs = useRef<(THREE.Mesh | null)[][]>(
    pipeData.map((p) => new Array(p.arrowCount).fill(null))
  );

  const blockageBeaconRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
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
          <group key={pipe.id}>
            {/* Static Subsea Pipe Tube */}
            <mesh
              geometry={pipe.tubeGeo}
              material={pipeMaterial}
              receiveShadow
              castShadow
              onClick={(e) => {
                e.stopPropagation();
                useRigStore.getState().openHoloModal(pipeKey);
                useRigStore.getState().setCameraViewMode(pipeKey);
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = 'default')}
            />

            {/* Wellhead / Pipeline Ground Connection Flanges */}
            <mesh position={pipe.points[0]}>
              <cylinderGeometry args={[pipe.radius * 1.6, pipe.radius * 1.6, 0.8, 16]} />
              <meshStandardMaterial
                color={isBlockage ? '#EF4444' : '#F59E0B'}
                metalness={0.8}
                roughness={0.2}
                emissive={isBlockage ? '#DC2626' : '#FF8800'}
                emissiveIntensity={isBlockage ? 1.5 : 0.3}
              />
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
          <mesh>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial
              color="#FF0033"
              emissive="#FF0000"
              emissiveIntensity={4.0}
              transparent
              opacity={0.85}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.8, 2.4, 32]} />
            <meshBasicMaterial color="#FF3300" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
};
