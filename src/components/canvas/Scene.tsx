import React, { Suspense, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { OilRigModel } from './OilRigModel';
import { OceanSurface } from './OceanSurface';
import { InteractiveHighlightRings } from './InteractiveHighlightRings';
import { OceanCurrentVisualizer } from './OceanCurrentVisualizer';
import { PipeSliceView } from './PipeSliceView';
import { HolographicTargetPointer } from './HolographicTargetPointer';
import { HOLO } from '../../shaders/HoloPalette';

/**
 * Hologram projection space: one dark background, depth fog in the same tone, and a soft
 * cyan fill light for the few lit materials. Everything else is unlit additive glow, so
 * no shadows or extra lights are needed.
 */
const HologramAtmosphere: React.FC = () => {
  const { scene } = useThree();
  useMemo(() => {
    scene.background = new THREE.Color(HOLO.background);
    scene.fog = new THREE.FogExp2(HOLO.background, 0.0032);
  }, [scene]);

  // A single key light casts the rig's shadow down onto the seabed for depth;
  // a cool fill from the opposite side keeps the shadowed faces readable.
  return (
    <>
      <ambientLight color={HOLO.primary} intensity={0.25} />
      <hemisphereLight args={['#9FEFFF', '#02101A', 0.5]} />
      <directionalLight
        position={[70, 140, 45]}
        color="#E6FBFF"
        intensity={2.6}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-near={10}
        shadow-camera-far={400}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <directionalLight position={[-60, 30, -70]} color={HOLO.primary} intensity={0.6} />
    </>
  );
};

export const Scene: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [42, 26, 52], fov: 48, near: 0.5, far: 3000 }}
      dpr={[1, 2]}
      shadows="soft"
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      className="w-full h-full"
    >
      <Suspense fallback={null}>
        <HologramAtmosphere />
        <CameraRig />
        <OilRigModel />
        <OceanSurface />
        <OceanCurrentVisualizer />
        <InteractiveHighlightRings />
        <PipeSliceView />
        <HolographicTargetPointer />
      </Suspense>
    </Canvas>
  );
};
