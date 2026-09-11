import React, { Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { OilRigModel } from './OilRigModel';
import { OceanSurface } from './OceanSurface';
import { InteractiveHighlightRings } from './InteractiveHighlightRings';
import { GammaCrossSection } from './Scanners/GammaCrossSection';
import { OceanCurrentVisualizer } from './OceanCurrentVisualizer';
import { useRigStore } from '../../store/useRigStore';

/**
 * Dynamic Subsea Volumetric Fog and Multi-Spectral Lighting
 */
const DynamicFogAndLighting: React.FC = () => {
  const { scene, camera } = useThree();
  const scannerMode = useRigStore((s) => s.scannerMode);

  useFrame(() => {
    const isUnderwater = camera.position.y < 0;

    if (scannerMode === 'hologram') {
      // Holographic cybernetic dark space with cyan volumetric depth
      scene.fog = new THREE.FogExp2('#010814', 0.007);
      scene.background = new THREE.Color('#010814');
    } else if (scannerMode === 'thermal') {
      // Thermal DTS infrared false-color ambient
      scene.fog = new THREE.FogExp2('#150020', 0.015);
      scene.background = new THREE.Color('#0A0012');
    } else if (scannerMode === 'acoustic') {
      // Acoustic DAS dark wireframe ambient
      scene.fog = new THREE.FogExp2('#00152B', 0.012);
      scene.background = new THREE.Color('#000A14');
    } else if (isUnderwater) {
      scene.fog = new THREE.FogExp2('#001322', 0.012);
      scene.background = new THREE.Color('#000E1A');
    } else {
      scene.fog = new THREE.FogExp2('#001726', 0.005);
      scene.background = new THREE.Color('#001726');
    }
  });

  return (
    <>
      <directionalLight
        position={[60, 100, 50]}
        intensity={scannerMode === 'hologram' ? 3.0 : scannerMode === 'thermal' ? 0.8 : 2.5}
        color={scannerMode === 'hologram' ? '#00FFFF' : scannerMode === 'thermal' ? '#FF6600' : '#F4F8FF'}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight
        position={[-60, 40, -50]}
        intensity={scannerMode === 'hologram' ? 1.8 : 1.0}
        color={scannerMode === 'hologram' ? '#0088FF' : '#88AAFF'}
      />
      <hemisphereLight
        args={[
          scannerMode === 'hologram' ? '#00D4FF' : scannerMode === 'thermal' ? '#FF3300' : '#005599',
          scannerMode === 'hologram' ? '#020C1B' : scannerMode === 'thermal' ? '#220033' : '#001A2E',
          scannerMode === 'hologram' ? 1.8 : 1.4,
        ]}
      />
      {/* Subsea & Drill Borehole Chamber Illumination */}
      <pointLight position={[0, -8, 0]} color="#00FFFF" intensity={scannerMode === 'hologram' ? 3.5 : 2.0} distance={75} />
      <pointLight position={[0, -25, 10]} color="#00E5FF" intensity={scannerMode === 'hologram' ? 4.0 : 2.5} distance={90} />
      <pointLight position={[0, -60, 15]} color="#00B4D8" intensity={scannerMode === 'hologram' ? 4.5 : 2.5} distance={100} />
      <pointLight position={[0, -85, 15]} color="#0077B6" intensity={3.5} distance={90} />
      <pointLight position={[25, -15, 25]} color="#00F0FF" intensity={1.8} distance={60} />
      <pointLight position={[-25, -15, -25]} color="#00F0FF" intensity={1.8} distance={60} />
    </>
  );
};

export const Scene: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [42, 26, 52], fov: 48, near: 0.5, far: 800 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      shadows
      className="w-full h-full"
    >
      <Suspense fallback={null}>
        <DynamicFogAndLighting />
        <CameraRig />
        <OilRigModel />
        <OceanSurface />
        <OceanCurrentVisualizer />
        <InteractiveHighlightRings />
        <GammaCrossSection />
      </Suspense>
    </Canvas>
  );
};
