import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

/**
 * 3D Ocean Current & Tidal Flow Visualizer
 * Renders:
 * - Dynamic moving 3D water current streamline arrows showing exact flow direction
 * - Real-time speed-adjusted particle drift across the sea surface and subsea column
 * - Floating 3D holographic Metocean Current Compass Beacon
 */
export const OceanCurrentVisualizer: React.FC = () => {
  const currentSpeedKnots = useRigStore((s) => s.currentSpeedKnots);
  const currentDirectionDeg = useRigStore((s) => s.currentDirectionDeg);
  const currentFlowPower = useRigStore((s) => s.currentFlowPower);
  const scannerMode = useRigStore((s) => s.scannerMode);

  const VECTOR_COUNT = 36;
  const BOUNDS_XZ = 95.0; // 95m x 95m coverage area

  // Compute direction vector in XZ plane
  const dirRad = (currentDirectionDeg * Math.PI) / 180;
  const dirX = Math.sin(dirRad);
  const dirZ = Math.cos(dirRad);

  // 3D Arrow / Streamline Geometry (Sleek marine hydrodynamic chevron)
  const chevronGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const cone = new THREE.ConeGeometry(0.55, 1.6, 12);
    cone.translate(0, 0.8, 0);

    const stem = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 12);
    stem.translate(0, -0.6, 0);

    const conePos = cone.attributes.position.array;
    const stemPos = stem.attributes.position.array;
    const coneNorm = cone.attributes.normal.array;
    const stemNorm = stem.attributes.normal.array;

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

  // Material with dynamic glow based on current power
  const streamlineMaterial = useMemo(() => {
    const isExtreme = currentFlowPower === 'extreme';
    const isFast = currentFlowPower === 'fast';
    const isHolo = scannerMode === 'hologram';

    const baseColor = isExtreme ? '#FF3300' : isFast ? '#00E5FF' : isHolo ? '#00B4D8' : '#0077B6';
    const glowColor = isExtreme ? '#FF5500' : isFast ? '#00FFFF' : isHolo ? '#00FFFF' : '#00A8FF';
    const intensity = isExtreme ? 4.0 : isFast ? 2.8 : 1.8;

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor),
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: intensity,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });
  }, [currentFlowPower, scannerMode]);

  // Initial random positions for vector arrows
  const initialPositions = useMemo(() => {
    const arr: { x: number; y: number; z: number; speedMul: number }[] = [];
    for (let i = 0; i < VECTOR_COUNT; i++) {
      arr.push({
        x: (Math.random() - 0.5) * BOUNDS_XZ,
        y: -Math.random() * 14.0 - 0.5, // Between 0.5m and 14.5m underwater
        z: (Math.random() - 0.5) * BOUNDS_XZ,
        speedMul: 0.85 + Math.random() * 0.35,
      });
    }
    return arr;
  }, [VECTOR_COUNT]);

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const compassArrowRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const speed = currentSpeedKnots * 2.6;
    const upVector = new THREE.Vector3(0, 1, 0);
    const flowDir = new THREE.Vector3(dirX, 0, dirZ).normalize();

    // 1. Animate all current vector streamline arrows
    meshRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const init = initialPositions[i];
        const distTraveled = t * speed * init.speedMul;

        // Wrap around bounds centered at origin
        let curX = ((init.x + distTraveled * dirX + BOUNDS_XZ / 2) % BOUNDS_XZ) - BOUNDS_XZ / 2;
        let curZ = ((init.z + distTraveled * dirZ + BOUNDS_XZ / 2) % BOUNDS_XZ) - BOUNDS_XZ / 2;

        mesh.position.set(curX, init.y + Math.sin(t * 2.0 + i) * 0.3, curZ);
        mesh.quaternion.setFromUnitVectors(upVector, flowDir);

        // Pulse scale
        const pulse = Math.sin(t * (currentSpeedKnots * 1.5) + i) * 0.15 + 1.0;
        mesh.scale.set(pulse, pulse * 1.2, pulse);
      }
    });

    // 2. Animate Metocean Floating Compass Beacon
    if (compassArrowRef.current) {
      compassArrowRef.current.rotation.y = -dirRad;
      compassArrowRef.current.position.y = Math.sin(t * 1.8) * 0.4;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Dynamic 3D Water Current Streamline Arrows */}
      {initialPositions.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => (meshRefs.current[i] = el)}
          geometry={chevronGeo}
          material={streamlineMaterial}
        />
      ))}

      {/* Floating 3D Metocean Current & Tide Direction Compass Beacon */}
      <group position={[38, 0, 38]}>
        {/* Floating Ring Buoy */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.2, 0.4, 16, 32]} />
          <meshStandardMaterial
            color="#FF9900"
            emissive="#FF5500"
            emissiveIntensity={0.8}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Rotating Compass Direction Indicator Arrow */}
        <group ref={compassArrowRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.6, 1.8]}>
            <coneGeometry args={[0.9, 2.5, 16]} />
            <meshStandardMaterial
              color="#00FFFF"
              emissive="#00E5FF"
              emissiveIntensity={2.5}
              metalness={0.9}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.6, -0.6]}>
            <cylinderGeometry args={[0.3, 0.3, 2.4, 16]} />
            <meshStandardMaterial
              color="#0088FF"
              emissive="#0055FF"
              emissiveIntensity={1.5}
            />
          </mesh>
        </group>

        {/* Outer Degree Dial */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.8, 4.4, 32]} />
          <meshBasicMaterial color="#00FFFF" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};
