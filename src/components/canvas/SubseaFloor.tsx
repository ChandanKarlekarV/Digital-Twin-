import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import {
  createSteelPlateTexture,
  createHazardStripeTexture,
  createCarbonSteelTexture,
} from '../../utils/textureGenerator';

/**
 * Subsea Seabed Floor with Textured Manifold D6, Christmas Trees, and ROV
 */
export const SubseaFloor: React.FC = () => {
  const rovRef = useRef<THREE.Group>(null);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);
  const scannerMode = useRigStore((s) => s.scannerMode);

  const steelTexture = useMemo(() => createSteelPlateTexture(), []);
  const hazardTexture = useMemo(() => createHazardStripeTexture(), []);
  const carbonSteelTexture = useMemo(() => createCarbonSteelTexture(), []);

  // Generate realistic bathymetric seabed mesh
  const terrainGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(500, 500, 64, 64);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const zNoise =
        Math.sin(x * 0.03) * Math.cos(y * 0.03) * 3.0 +
        Math.sin(x * 0.08 + y * 0.05) * 1.5;
      pos.setZ(i, zNoise);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (rovRef.current) {
      const t = clock.getElapsedTime();
      rovRef.current.position.y = -112 + Math.sin(t * 1.2) * 0.4;
      rovRef.current.position.x = 8 + Math.cos(t * 0.5) * 2.0;
      rovRef.current.rotation.y = Math.sin(t * 0.3) * 0.2 + 0.6;
    }
  });

  const isThermal = scannerMode === 'thermal';
  const isAcoustic = scannerMode === 'acoustic';

  return (
    <group position={[0, -120, 0]}>
      {/* 1. BATHYMETRIC SEABED TERRAIN */}
      <mesh
        geometry={terrainGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color={isThermal ? '#1A0033' : isAcoustic ? '#001A33' : '#0B1520'}
          roughness={0.9}
          metalness={0.1}
          wireframe={isAcoustic}
        />
      </mesh>

      {/* 2. SUBSEA PRODUCTION MANIFOLD HUB D6-M1 */}
      <group
        position={[0, 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('MANIFOLD-D6-MAIN');
          varunaVoice.speakDiagnostic('MANIFOLD-D6-MAIN');
        }}
      >
        {/* Structural Mudmat Foundation */}
        <mesh position={[0, -1.5, 0]} receiveShadow>
          <boxGeometry args={[14, 0.8, 10]} />
          <meshStandardMaterial color="#1E2A38" roughness={0.7} metalness={0.6} map={steelTexture} />
        </mesh>

        {/* Manifold Protective Structural Cage Frame */}
        <mesh position={[0, 2, 0]} castShadow>
          <boxGeometry args={[12, 4.5, 8]} />
          <meshStandardMaterial
            color={isThermal ? '#FF4400' : isAcoustic ? '#0066CC' : '#004B87'}
            roughness={0.3}
            metalness={0.8}
            map={isThermal || isAcoustic ? null : steelTexture}
            wireframe={isAcoustic}
          />
        </mesh>

        {/* Dual 12-inch Header Production Pipes */}
        <mesh position={[0, 1.5, -2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.7, 0.7, 11, 16]} />
          <meshStandardMaterial color="#ED1B24" roughness={0.2} metalness={0.9} map={carbonSteelTexture} />
        </mesh>
        <mesh position={[0, 1.5, 2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.7, 0.7, 11, 16]} />
          <meshStandardMaterial color="#ED1B24" roughness={0.2} metalness={0.9} map={carbonSteelTexture} />
        </mesh>

        {/* 4 Multi-Port Branch Valve Blocks */}
        {[-4, -1.5, 1.5, 4].map((xPos, idx) => (
          <group key={`valve-branch-${idx}`} position={[xPos, 3.2, 0]}>
            <mesh>
              <boxGeometry args={[1.2, 1.6, 1.2]} />
              <meshStandardMaterial color="#00F0FF" roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.9, 12]} />
              <meshStandardMaterial color="#FFAA00" />
            </mesh>
          </group>
        ))}

        {/* Subsea Control Module (SCM Pod) */}
        <mesh position={[4.5, 3.5, 2.5]}>
          <cylinderGeometry args={[0.8, 0.8, 2.2, 16]} />
          <meshStandardMaterial
            color="#FFD700"
            roughness={0.2}
            metalness={0.9}
            emissive="#FFD700"
            emissiveIntensity={0.2}
            map={hazardTexture}
          />
        </mesh>
      </group>

      {/* 3. SUBSEA CHRISTMAS TREE #1 (XT-01) */}
      <group
        position={[-22, 2, -12]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('XT-WELLHEAD-01');
          varunaVoice.speakDiagnostic('XT-WELLHEAD-01');
        }}
      >
        <mesh position={[0, -1.2, 0]}>
          <cylinderGeometry args={[3.2, 3.8, 1.2, 8]} />
          <meshStandardMaterial color="#1E2A38" metalness={0.7} map={steelTexture} />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[3.5, 4.2, 3.5]} />
          <meshStandardMaterial
            color={isThermal ? '#FF5500' : isAcoustic ? '#0077EE' : '#002B49'}
            metalness={0.85}
            map={steelTexture}
          />
        </mesh>
        <mesh position={[0, 4.2, 0]}>
          <cylinderGeometry args={[1.2, 1.5, 1.8, 16]} />
          <meshStandardMaterial color="#ED1B24" metalness={0.8} />
        </mesh>
        <mesh position={[2.2, 2.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 2.5, 12]} />
          <meshStandardMaterial color="#00F0FF" map={carbonSteelTexture} />
        </mesh>
      </group>

      {/* 4. SUBSEA CHRISTMAS TREE #2 (XT-02) */}
      <group
        position={[24, 2, 14]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('XT-WELLHEAD-02');
          varunaVoice.speakDiagnostic('XT-WELLHEAD-02');
        }}
      >
        <mesh position={[0, -1.2, 0]}>
          <cylinderGeometry args={[3.2, 3.8, 1.2, 8]} />
          <meshStandardMaterial color="#1E2A38" metalness={0.7} map={steelTexture} />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[3.5, 4.2, 3.5]} />
          <meshStandardMaterial
            color={isThermal ? '#FF5500' : isAcoustic ? '#0077EE' : '#002B49'}
            metalness={0.85}
            map={steelTexture}
          />
        </mesh>
        <mesh position={[0, 4.2, 0]}>
          <cylinderGeometry args={[1.2, 1.5, 1.8, 16]} />
          <meshStandardMaterial color="#ED1B24" metalness={0.8} />
        </mesh>
        <mesh position={[-2.2, 2.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 2.5, 12]} />
          <meshStandardMaterial color="#00F0FF" map={carbonSteelTexture} />
        </mesh>
      </group>

      {/* 5. SUBSEA RIGID FLOW JUMPERS */}
      <mesh
        position={[-11, 1.5, -6]}
        rotation={[0, 0.5, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('RISER-ALPHA');
          varunaVoice.speakDiagnostic('RISER-ALPHA');
        }}
      >
        <cylinderGeometry args={[0.35, 0.35, 23, 16]} />
        <meshStandardMaterial color="#00F0FF" roughness={0.2} metalness={0.9} map={carbonSteelTexture} />
      </mesh>
      <mesh
        position={[12, 1.5, 7]}
        rotation={[0, -0.55, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('RISER-BRAVO');
          varunaVoice.speakDiagnostic('RISER-BRAVO');
        }}
      >
        <cylinderGeometry args={[0.35, 0.35, 25, 16]} />
        <meshStandardMaterial color="#00F0FF" roughness={0.2} metalness={0.9} map={carbonSteelTexture} />
      </mesh>

      {/* 6. INSPECTION ROV */}
      <group ref={rovRef} position={[8, 8, 8]}>
        <mesh castShadow>
          <boxGeometry args={[3.2, 2.2, 2.4]} />
          <meshStandardMaterial color="#FFCC00" roughness={0.3} metalness={0.7} map={hazardTexture} />
        </mesh>
        <mesh position={[-1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.8, 12]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <mesh position={[1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.8, 12]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <mesh position={[1.4, -0.6, 1.2]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.3, 0.3, 1.6]} />
          <meshStandardMaterial color="#888888" metalness={0.9} />
        </mesh>
        <spotLight
          position={[0, 0, 1.2]}
          target-position={[0, -118, 0]}
          color="#00F0FF"
          intensity={8}
          distance={45}
          angle={0.7}
          penumbra={0.4}
        />
        <pointLight position={[0, 0, 1]} color="#FFFFFF" intensity={3} distance={20} />
      </group>
    </group>
  );
};
