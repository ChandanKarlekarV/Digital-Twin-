import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore, ASSET_CATALOG } from '../../store/useRigStore';

/**
 * 3D Holographic Selection Rings (Clean, without floating name text boxes)
 */
export const InteractiveHighlightRings: React.FC = () => {
  const ringRef = useRef<THREE.Mesh>(null);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.getElapsedTime();
      const scale = 1.0 + Math.sin(t * 3.5) * 0.08;
      ringRef.current.scale.set(scale, scale, scale);
      ringRef.current.rotation.z = t * 0.5;
    }
  });

  const selectedAsset = selectedAssetId ? ASSET_CATALOG[selectedAssetId] : null;
  if (!selectedAsset) return null;

  return (
    <group position={selectedAsset.position}>
      {/* Primary Cyan Target Halos */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, selectedAsset.category === 'topside' ? 1.0 : 0.5, 0]}
      >
        <ringGeometry args={[6.5, 7.0, 48]} />
        <meshBasicMaterial
          color="#00F0FF"
          side={THREE.DoubleSide}
          transparent
          opacity={0.75}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, selectedAsset.category === 'topside' ? 0.9 : 0.4, 0]}
      >
        <ringGeometry args={[8.0, 8.2, 48]} />
        <meshBasicMaterial
          color="#00F0FF"
          side={THREE.DoubleSide}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
};
