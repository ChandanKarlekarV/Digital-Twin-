import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { createCarbonSteelTexture, createHazardStripeTexture } from '../../utils/textureGenerator';

/**
 * High-Pressure Steel Catenary Risers (SCR-Alpha & SCR-Bravo)
 * with Carbon Steel Textures and Direct Mesh Click Voice Diagnostics.
 */
export const RisersAndPipelines: React.FC = () => {
  const flowPulseRefA = useRef<THREE.Mesh>(null);
  const flowPulseRefB = useRef<THREE.Mesh>(null);
  const rupturePlumeRef = useRef<THREE.Group>(null);
  const methanolParticlesRef = useRef<THREE.Points>(null);

  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);
  const scannerMode = useRigStore((s) => s.scannerMode);
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);

  const carbonSteelTexture = useMemo(() => createCarbonSteelTexture(), []);
  const hazardTexture = useMemo(() => createHazardStripeTexture(), []);

  // 1. Riser Alpha Catenary Curve
  const { curveA, geoA, buoyancyPointsA } = useMemo(() => {
    const points = [
      new THREE.Vector3(-8, -10, -5),
      new THREE.Vector3(-14, -35, -7),
      new THREE.Vector3(-18, -65, -8),
      new THREE.Vector3(-14, -95, -6),
      new THREE.Vector3(-5, -116, -3),
      new THREE.Vector3(0, -116.5, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 64, 0.65, 16, false);
    const bPoints = [
      curve.getPointAt(0.12),
      curve.getPointAt(0.18),
      curve.getPointAt(0.24),
    ];
    return { curveA: curve, geoA: geo, buoyancyPointsA: bPoints };
  }, []);

  // 2. Riser Bravo Catenary Curve
  const { curveB, geoB, buoyancyPointsB } = useMemo(() => {
    const points = [
      new THREE.Vector3(8, -10, 5),
      new THREE.Vector3(15, -35, 8),
      new THREE.Vector3(19, -65, 9),
      new THREE.Vector3(15, -95, 7),
      new THREE.Vector3(5, -116, 3),
      new THREE.Vector3(0, -116.5, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 64, 0.65, 16, false);
    const bPoints = [
      curve.getPointAt(0.12),
      curve.getPointAt(0.18),
      curve.getPointAt(0.24),
    ];
    return { curveB: curve, geoB: geo, buoyancyPointsB: bPoints };
  }, []);

  // Methanol injection particle geometry
  const methanolGeometry = useMemo(() => {
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const progress = (t * 0.4) % 1.0;

    if (flowPulseRefA.current) {
      const pt = curveA.getPointAt(1.0 - progress);
      flowPulseRefA.current.position.copy(pt);
    }
    if (flowPulseRefB.current) {
      const pt = curveB.getPointAt(1.0 - ((progress + 0.5) % 1.0));
      flowPulseRefB.current.position.copy(pt);
    }
    if (rupturePlumeRef.current && emergencyScenario === 'rupture') {
      rupturePlumeRef.current.rotation.y = t * 1.5;
      const s = 1.0 + Math.sin(t * 8) * 0.3;
      rupturePlumeRef.current.scale.set(s, s, s);
    }
    if (methanolParticlesRef.current && emergencyScenario === 'hydrate_plug') {
      methanolParticlesRef.current.rotation.y = t * 2.0;
    }
  });

  const isThermal = scannerMode === 'thermal';
  const isAcoustic = scannerMode === 'acoustic';
  const isRupture = emergencyScenario === 'rupture';

  return (
    <group>
      {/* ================= RISER ALPHA ================= */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('RISER-ALPHA');
          varunaVoice.speakDiagnostic('RISER-ALPHA');
        }}
      >
        <mesh geometry={geoA} castShadow receiveShadow>
          <meshStandardMaterial
            color={isRupture ? '#ED1B24' : isThermal ? '#FF5500' : isAcoustic ? '#00E5FF' : '#002B49'}
            metalness={0.8}
            roughness={0.3}
            map={isThermal || isAcoustic ? null : carbonSteelTexture}
            wireframe={isAcoustic}
            emissive={isRupture ? '#ED1B24' : selectedAssetId === 'RISER-ALPHA' ? '#00F0FF' : isThermal ? '#FF3300' : '#000000'}
            emissiveIntensity={isRupture ? 0.8 : selectedAssetId === 'RISER-ALPHA' ? 0.6 : isThermal ? 0.3 : 0}
          />
        </mesh>

        {buoyancyPointsA.map((pt, idx) => (
          <mesh key={`buoy-a-${idx}`} position={pt}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.6} map={hazardTexture} />
          </mesh>
        ))}

        <mesh ref={flowPulseRefA}>
          <sphereGeometry args={[0.9, 16, 16]} />
          <meshBasicMaterial color={isRupture ? '#ED1B24' : '#00F0FF'} transparent opacity={0.8} />
        </mesh>

        {/* Rupture Plume at Y = -50m */}
        {isRupture && (
          <group ref={rupturePlumeRef} position={[-16, -50, -7]}>
            <mesh>
              <sphereGeometry args={[3.5, 16, 16]} />
              <meshBasicMaterial color="#ED1B24" transparent opacity={0.5} wireframe />
            </mesh>
            <mesh>
              <sphereGeometry args={[2.0, 16, 16]} />
              <meshBasicMaterial color="#FFAA00" transparent opacity={0.7} />
            </mesh>
            <pointLight color="#ED1B24" intensity={8} distance={30} />
          </group>
        )}
      </group>

      {/* ================= RISER BRAVO ================= */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('RISER-BRAVO');
          varunaVoice.speakDiagnostic('RISER-BRAVO');
        }}
      >
        <mesh geometry={geoB} castShadow receiveShadow>
          <meshStandardMaterial
            color={isThermal ? '#FF5500' : isAcoustic ? '#00E5FF' : '#002B49'}
            metalness={0.8}
            roughness={0.3}
            map={isThermal || isAcoustic ? null : carbonSteelTexture}
            wireframe={isAcoustic}
            emissive={selectedAssetId === 'RISER-BRAVO' ? '#00F0FF' : isThermal ? '#FF3300' : '#000000'}
            emissiveIntensity={selectedAssetId === 'RISER-BRAVO' ? 0.6 : isThermal ? 0.3 : 0}
          />
        </mesh>

        {buoyancyPointsB.map((pt, idx) => (
          <mesh key={`buoy-b-${idx}`} position={pt}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.6} map={hazardTexture} />
          </mesh>
        ))}

        <mesh ref={flowPulseRefB}>
          <sphereGeometry args={[0.9, 16, 16]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* Methanol Injection Cloud */}
      {emergencyScenario === 'hydrate_plug' && (
        <group position={[24, -116, 14]}>
          <points ref={methanolParticlesRef} geometry={methanolGeometry}>
            <pointsMaterial color="#00F0FF" size={0.35} transparent opacity={0.85} />
          </points>
          <pointLight color="#00F0FF" intensity={4} distance={20} />
        </group>
      )}
    </group>
  );
};
