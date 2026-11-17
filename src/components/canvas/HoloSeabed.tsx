import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { HOLO } from '../../shaders/HoloPalette';

interface HoloSeabedProps {
  /** World Y of the mudline */
  seabedY: number;
  /** Radius the sonar sweep reaches */
  radius: number;
}

const LAND_SIZE = 600;

/**
 * Seabed under the platform: a dark, lit sediment surface with gentle bathymetry that
 * receives the rig's shadows, a faint survey lattice for the hologram look, and sonar
 * range rings pulsing outward from the wellhead. The area under the jacket is levelled
 * so the legs and wellhead sit on the ground instead of floating.
 */
export const HoloSeabed: React.FC<HoloSeabedProps> = ({ seabedY, radius }) => {
  const sonarRef = useRef<THREE.Group>(null);

  const { groundGeo, latticeGeo, ringGeo } = useMemo(() => {
    const height = (x: number, z: number) => {
      let h =
        Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.017 + 0.2) * 3.2 +
        Math.sin(x * 0.06 + z * 0.045) * 1.1 +
        Math.cos(x * 0.13 - z * 0.11) * 0.35;
      // Levelled pad around the jacket and wellhead
      const d = Math.hypot(x, z);
      if (d < 70) h *= Math.max(0, (d - 40) / 30);
      return h;
    };
    const build = (segments: number) => {
      const g = new THREE.PlaneGeometry(LAND_SIZE, LAND_SIZE, segments, segments).rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
      g.computeVertexNormals();
      return g;
    };
    return {
      groundGeo: build(160),
      latticeGeo: new THREE.WireframeGeometry(build(60)),
      ringGeo: new THREE.RingGeometry(0.985, 1.0, 128).rotateX(-Math.PI / 2),
    };
  }, []);

  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0A2230', emissive: '#02101A', roughness: 0.95, metalness: 0.05 }),
    []
  );
  const latticeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: HOLO.mid, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );
  const sonarMats = useMemo(
    () =>
      [0, 1, 2].map(
        () =>
          new THREE.MeshBasicMaterial({
            color: HOLO.primary,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
      ),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    sonarRef.current?.children.forEach((ring, i) => {
      const phase = (t / 6 + i / 3) % 1;
      const r = 3 + phase * (radius - 3);
      ring.scale.set(r, 1, r);
      sonarMats[i].opacity = (1 - phase) * 0.4;
    });
  });

  return (
    <group position={[0, seabedY, 0]}>
      <mesh
        geometry={groundGeo}
        material={groundMat}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          useRigStore.getState().setSelectedAssetId('SUBSEA-BEDROCK');
          varunaVoice.speakDiagnostic('SUBSEA-BEDROCK');
        }}
      />
      <lineSegments geometry={latticeGeo} material={latticeMat} position={[0, 0.06, 0]} />
      <group ref={sonarRef} position={[0, 0.3, 0]}>
        {sonarMats.map((m, i) => (
          <mesh key={i} geometry={ringGeo} material={m} />
        ))}
      </group>
    </group>
  );
};
