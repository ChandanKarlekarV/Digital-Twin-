import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

/**
 * Animated Upward-Moving Glowing Dark Blue Oil Flow Arrows
 * Represents pressurized crude oil & gas stream rising from deep reservoir (-96m)
 * to topside production separator (+14m).
 */
export const OilFlowArrows: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);

  const ARROW_COUNT = 22;
  const BOTTOM_Y = -96.0;
  const TOP_Y = 14.0;
  const TOTAL_HEIGHT = TOP_Y - BOTTOM_Y; // 110m
  const SPEED = 16.0; // m/s upward fluid velocity

  // Create high-precision 3D Arrow Geometry (Cone head pointing UP + Cylinder stem)
  const arrowGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const coneGeo = new THREE.ConeGeometry(0.85, 2.2, 16);
    coneGeo.translate(0, 1.1, 0); // Cone sits on top

    const stemGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.0, 16);
    stemGeo.translate(0, -1.0, 0); // Cylinder below cone

    // Merge geometries
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

  // Glowing Dark Blue Oil Flow Material
  const arrowMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#001F66'), // Deep rich dark blue
      emissive: new THREE.Color('#0038FF'), // Radiant glowing dark/royal blue
      emissiveIntensity: 3.2,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
  }, []);

  // Energy Rings Material for upward acoustic flow pulse
  const ringMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#002B99'),
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
  }, []);

  // References to each individual arrow mesh
  const arrowRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    arrowRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const baseOffset = (i / ARROW_COUNT) * TOTAL_HEIGHT;
        const currentY = ((baseOffset + time * SPEED) % TOTAL_HEIGHT) + BOTTOM_Y;
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
      {/* 22 Animated Glowing Dark Blue 3D Arrows moving UP */}
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
