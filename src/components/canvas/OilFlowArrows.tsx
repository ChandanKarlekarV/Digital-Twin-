import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

/**
 * Animated Upward-Moving Glowing Oil Flow Arrows
 * Represents pressurized crude oil & gas stream rising from deep reservoir (-96m)
 * to topside production separator (+14m).
 * Dynamically reacts to Oil Overload (surging speed/amber glow) and Blockages.
 */
export const OilFlowArrows: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);

  const ARROW_COUNT = 22;
  const BOTTOM_Y = -96.0;
  const TOP_Y = 14.0;
  const TOTAL_HEIGHT = TOP_Y - BOTTOM_Y; // 110m

  // Base speed
  const BASE_SPEED = 16.0;

  // Create high-precision 3D Arrow Geometry
  const arrowGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const coneGeo = new THREE.ConeGeometry(0.85, 2.2, 16);
    coneGeo.translate(0, 1.1, 0);

    const stemGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.0, 16);
    stemGeo.translate(0, -1.0, 0);

    const conePositions = coneGeo.attributes.position.array;
    const stemPositions = stemGeo.attributes.position.array;
    const coneNormals = coneGeo.attributes.normal.array;
    const stemNormals = stemGeo.attributes.normal.array;

    const mergedPositions = new Float32Array(conePositions.length + stemPositions.length);
    mergedPositions.set(conePositions, 0);
    mergedPositions.set(stemPositions, conePositions.length);

    const mergedNormals = new Float32Array(coneNormals.length + stemNormals.length);
    mergedNormals.set(coneNormals, 0);
    mergedNormals.set(stemNormals, coneNormals.length);

    geo.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));

    return geo;
  }, []);

  // Glowing Dynamic Oil Flow Material
  const arrowMaterial = useMemo(() => {
    const isOverload = emergencyScenario === 'oil_overload';
    const isBlockage = emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug';

    let color = '#001F66';
    let emissive = '#0038FF';
    let intensity = 3.2;

    if (isOverload) {
      color = '#FF5500';
      emissive = '#FFCC00'; // Intense Gold/Fire Glow
      intensity = 5.5;
    } else if (isBlockage) {
      color = '#450A0A';
      emissive = '#EF4444';
      intensity = 2.0;
    }

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(emissive),
      emissiveIntensity: intensity,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
  }, [emergencyScenario, incidentPhase]);

  // Energy Rings Material for upward acoustic flow pulse
  const ringMaterial = useMemo(() => {
    const isOverload = emergencyScenario === 'oil_overload';
    return new THREE.MeshBasicMaterial({
      color: isOverload ? new THREE.Color('#FFAA00') : new THREE.Color('#002B99'),
      transparent: true,
      opacity: isOverload ? 0.85 : 0.65,
      side: THREE.DoubleSide,
    });
  }, [emergencyScenario]);

  // References to each individual arrow mesh
  const arrowRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    const isOverload = emergencyScenario === 'oil_overload';
    const isBlockage = emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug';

    let effectiveSpeed = BASE_SPEED;
    if (isOverload) {
      effectiveSpeed = BASE_SPEED * (1.0 + incidentPhase * 0.5); // Up to 48 m/s
    } else if (isBlockage) {
      effectiveSpeed = incidentPhase >= 3 ? 1.5 : BASE_SPEED * 0.4;
    }

    arrowRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const baseOffset = (i / ARROW_COUNT) * TOTAL_HEIGHT;
        const currentY = ((baseOffset + time * effectiveSpeed) % TOTAL_HEIGHT) + BOTTOM_Y;
        mesh.position.y = currentY;

        // Slight rotation for spiral drill-follow vortex effect
        mesh.rotation.y = time * 2.5 + i * 0.4;

        // Pulse scale as fluid ascends
        const pulse = Math.sin(time * 6.0 + i) * 0.12 + 1.0;
        mesh.scale.set(pulse, pulse, pulse);
      }
    });
  });

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedAssetId('RISER-ALPHA');
        varunaVoice.speakDiagnostic('RISER-ALPHA');
      }}
    >
      {/* 22 Animated Glowing 3D Arrows moving UP */}
      {Array.from({ length: ARROW_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => (arrowRefs.current[i] = el)}
          geometry={arrowGeo}
          material={arrowMaterial}
          position={[0, BOTTOM_Y + (i / ARROW_COUNT) * TOTAL_HEIGHT, 0]}
        />
      ))}

      {/* Upward Traveling Multiphase Acoustic Flow Rings */}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh
          key={`ring-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, BOTTOM_Y + (i / 12) * TOTAL_HEIGHT, 0]}
          material={ringMaterial}
        >
          <ringGeometry args={[1.2, 1.8, 32]} />
        </mesh>
      ))}
    </group>
  );
};
