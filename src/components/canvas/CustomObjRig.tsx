import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { createHolographicMaterial } from '../../shaders/HolographicMaterial';
import { OilFlowArrows } from './OilFlowArrows';
import { SubseaPipelineFlowNetwork } from './SubseaPipelineFlowNetwork';
import { rigModelCache, CachedRigData } from '../../services/RigModelCache';

interface CustomObjRigProps {
  objUrl: string;
}

export const CustomObjRig: React.FC<CustomObjRigProps> = ({ objUrl }) => {
  const [objGroup, setObjGroup] = useState<THREE.Group | null>(null);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);
  const scannerMode = useRigStore((s) => s.scannerMode);
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);

  // Scaled coordinate constants matching user yellow marking line
  const MODEL_SCALE = 45.0;
  const WATER_LINE_OBJ_Y = -0.22; // Column midpoint water line
  const SEABED_WORLD_Y = (-0.585 - WATER_LINE_OBJ_Y) * MODEL_SCALE; // -16.425m
  const BEDROCK_BOTTOM_WORLD_Y = (-2.4719 - WATER_LINE_OBJ_Y) * MODEL_SCALE; // -101.3m
  const LAND_WIDTH = 110.0;
  const LAND_DEPTH = 110.0;

  // Shader material references for real-time uTime animation
  const holoRigMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const holoOuterCasingMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const holoInnerDrillMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const holoManifoldMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const holoBedrockMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const holoSeabedMatRef = useRef<THREE.ShaderMaterial | null>(null);

  // Reference for ONLY the INNER spinning drill mechanism (Outer cylinder is 100% static!)
  const innerDrillGroupRef = useRef<THREE.Group | null>(null);
  const wholeRigGroupRef = useRef<THREE.Group | null>(null);

  // Animate shader uniforms and spin ONLY the INNER drill string on every frame
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // 1. Update shader time uniforms
    if (holoRigMatRef.current) holoRigMatRef.current.uniforms.uTime.value = t;
    if (holoOuterCasingMatRef.current) holoOuterCasingMatRef.current.uniforms.uTime.value = t;
    if (holoInnerDrillMatRef.current) holoInnerDrillMatRef.current.uniforms.uTime.value = t;
    if (holoManifoldMatRef.current) holoManifoldMatRef.current.uniforms.uTime.value = t;
    if (holoBedrockMatRef.current) holoBedrockMatRef.current.uniforms.uTime.value = t;
    if (holoSeabedMatRef.current) holoSeabedMatRef.current.uniforms.uTime.value = t;

    // 2. Continuous rotary spin applied ONLY to the INNER drill string & bit (~40 RPM)
    const isDrillIssue = emergencyScenario === 'drill_damage' || emergencyScenario === 'stuck_drill';
    const isSquall = emergencyScenario === 'weather_squall';

    if (innerDrillGroupRef.current) {
      if (isDrillIssue && incidentPhase >= 3) {
        // Complete stall + violent high-frequency vibration jitter
        const jitterX = (Math.sin(t * 65.0) + (Math.random() - 0.5)) * 0.12;
        const jitterZ = (Math.cos(t * 55.0) + (Math.random() - 0.5)) * 0.12;
        innerDrillGroupRef.current.position.x = jitterX;
        innerDrillGroupRef.current.position.z = jitterZ;
      } else if (isDrillIssue && incidentPhase >= 1) {
        // Stick-slip rotational jerking
        const wobble = Math.sin(t * 30.0) * (0.04 * incidentPhase);
        innerDrillGroupRef.current.position.x = wobble;
        innerDrillGroupRef.current.position.z = -wobble;
        innerDrillGroupRef.current.rotation.y += delta * (4.2 - incidentPhase * 1.1);
      } else {
        innerDrillGroupRef.current.position.x = 0;
        innerDrillGroupRef.current.position.z = 0;
        innerDrillGroupRef.current.rotation.y += delta * 4.2;
      }
    }

    // 3. Platform pitch/roll heave during severe weather squalls
    if (wholeRigGroupRef.current) {
      if (isSquall) {
        const heaveAngle = Math.sin(t * 1.5) * (0.015 * incidentPhase);
        const pitchAngle = Math.cos(t * 1.2) * (0.012 * incidentPhase);
        wholeRigGroupRef.current.rotation.z = heaveAngle;
        wholeRigGroupRef.current.rotation.x = pitchAngle;
        wholeRigGroupRef.current.position.y = Math.sin(t * 2.0) * (0.25 * incidentPhase);
      } else {
        wholeRigGroupRef.current.rotation.z = 0;
        wholeRigGroupRef.current.rotation.x = 0;
        wholeRigGroupRef.current.position.y = 0;
      }
    }
  });

  useEffect(() => {
    // Initialize reusable Holographic materials
    const holoRigMat = createHolographicMaterial({
      baseColor: '#1976D2',
      glowColor: '#00FFFF',
      opacity: 0.90,
      scanlineFreq: 1.2,
      glowIntensity: 2.2,
      useVertexColor: true,
    });
    holoRigMatRef.current = holoRigMat;

    const holoOuterCasingMat = createHolographicMaterial({
      baseColor: '#003366',
      glowColor: '#00D2FF',
      opacity: 0.65,
      scanlineFreq: 0.6,
      glowIntensity: 1.8,
      wireframe: false,
    });
    holoOuterCasingMatRef.current = holoOuterCasingMat;

    const holoInnerDrillMat = createHolographicMaterial({
      baseColor: '#00D2FF',
      glowColor: '#00F0FF',
      opacity: 0.95,
      scanlineFreq: 2.5,
      glowIntensity: 3.2,
    });
    holoInnerDrillMatRef.current = holoInnerDrillMat;

    const holoManifoldMat = createHolographicMaterial({
      baseColor: '#00FFFF',
      glowColor: '#00E5FF',
      opacity: 0.92,
      scanlineFreq: 1.5,
      glowIntensity: 2.4,
    });
    holoManifoldMatRef.current = holoManifoldMat;

    const applyRigData = (data: CachedRigData) => {
      const group = new THREE.Group();
      group.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
      group.position.x = -data.center.x * MODEL_SCALE;
      group.position.y = -WATER_LINE_OBJ_Y * MODEL_SCALE;
      group.position.z = -data.center.z * MODEL_SCALE;
      group.rotation.y = -Math.PI / 2;

      // 1. Outer Drill Casing Mesh
      if (data.drillGeo) {
        const mat = scannerMode === 'hologram'
          ? holoOuterCasingMat
          : new THREE.MeshStandardMaterial({
              color: '#00D2FF',
              roughness: 0.35,
              metalness: 0.7,
              transparent: true,
              opacity: 0.75,
              side: THREE.DoubleSide,
            });
        const mesh = new THREE.Mesh(data.drillGeo, mat);
        mesh.name = 'model_Mesh';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }

      // 2. Subsea Manifold Mesh
      if (data.manifoldGeo) {
        const mat = scannerMode === 'hologram'
          ? holoManifoldMat
          : new THREE.MeshStandardMaterial({
              color: '#00FFFF',
              roughness: 0.35,
              metalness: 0.7,
              side: THREE.DoubleSide,
            });
        const mesh = new THREE.Mesh(data.manifoldGeo, mat);
        mesh.name = 'model1_Mesh';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }

      // 3. Topside Rig Mesh with instant precomputed vertex colors
      if (data.topsideGeo) {
        const geo = data.topsideGeo.clone();
        const colors = data.colorBuffers.get('full_colored');
        if (colors) {
          geo.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
          geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        const mat = scannerMode === 'hologram'
          ? holoRigMat
          : new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.35,
              metalness: 0.6,
              side: THREE.DoubleSide,
            });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'modelfinal_Mesh';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }

      setObjGroup(group);
    };

    const cached = rigModelCache.getCachedData(objUrl);
    if (cached) {
      applyRigData(cached);
    } else {
      rigModelCache.preload(objUrl).then(applyRigData).catch(console.warn);
    }
  }, [objUrl, scannerMode]);

  // 100% Enclosed 4-Sided Solid Bedrock with Focused Central Drill Window
  const {
    sandSeabedGeo,
    backBedrockGeo,
    leftFrontBedrockGeo,
    rightFrontBedrockGeo,
    bottomSlabGeo,
    innerDrillRodGeo,
  } = useMemo(() => {
    const wallHeight = Math.abs(BEDROCK_BOTTOM_WORLD_Y - SEABED_WORLD_Y); // 84.875m
    const slotW = 16.0;
    const frontWingW = (LAND_WIDTH - slotW) / 2;
    const halfDepth = LAND_DEPTH / 2;

    const segments = 48;
    const sandGeo = new THREE.PlaneGeometry(LAND_WIDTH, LAND_DEPTH, segments, segments);
    const pos = sandGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const cDuneCrest = new THREE.Color('#E2C499');
    const cDuneBase = new THREE.Color('#C9A06B');
    const cDuneTrough = new THREE.Color('#AE8654');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const dist = Math.sqrt(x * x + y * y);

      let z = 0;
      z += Math.sin(x * 0.08 + 0.5) * Math.cos(y * 0.07 + 0.3) * 1.5;
      z += Math.sin(x * 0.18 + y * 0.12) * 0.75;
      z += Math.cos(x * 0.32 - y * 0.25) * 0.35;
      z += Math.sin(x * 0.65 + y * 0.55) * 0.15;

      if (dist < 34) {
        const factor = Math.max(0, (dist - 14) / 20);
        z *= factor;
      }

      pos.setZ(i, z);

      const heightNorm = Math.min(1.0, Math.max(0.0, (z + 2.2) / 4.4));
      const color = new THREE.Color();
      if (heightNorm > 0.52) {
        color.lerpColors(cDuneBase, cDuneCrest, (heightNorm - 0.52) / 0.48);
      } else {
        color.lerpColors(cDuneTrough, cDuneBase, heightNorm / 0.52);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    sandGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    sandGeo.computeVertexNormals();

    const backBlock = new THREE.BoxGeometry(LAND_WIDTH, wallHeight, halfDepth);
    const leftFrontBlock = new THREE.BoxGeometry(frontWingW, wallHeight, halfDepth);
    const rightFrontBlock = new THREE.BoxGeometry(frontWingW, wallHeight, halfDepth);
    const bottomBlock = new THREE.BoxGeometry(LAND_WIDTH, 4.0, LAND_DEPTH);
    const drillRod = new THREE.CylinderGeometry(0.55, 0.55, wallHeight + 4.0, 16);

    return {
      sandSeabedGeo: sandGeo,
      backBedrockGeo: backBlock,
      leftFrontBedrockGeo: leftFrontBlock,
      rightFrontBedrockGeo: rightFrontBlock,
      bottomSlabGeo: bottomBlock,
      innerDrillRodGeo: drillRod,
    };
  }, [LAND_WIDTH, LAND_DEPTH, SEABED_WORLD_Y, BEDROCK_BOTTOM_WORLD_Y]);

  if (!objGroup) return null;

  const handleObjectClick = (e: any) => {
    e.stopPropagation();
    const clickedMesh = e.object as THREE.Mesh;
    const meshName = clickedMesh?.name || '';
    const clickPoint = e.point as THREE.Vector3;

    if (meshName === 'model1_Mesh') {
      setSelectedAssetId('MANIFOLD-D6-MAIN');
      varunaVoice.speakDiagnostic('MANIFOLD-D6-MAIN');
      return;
    }

    if (meshName === 'model_Mesh' || clickedMesh?.userData?.isDrill) {
      setSelectedAssetId('DRILL-SYSTEM');
      varunaVoice.speakDiagnostic('DRILL-SYSTEM');
      return;
    }

    if (meshName === 'modelfinal_Mesh') {
      const localPoint = clickedMesh.worldToLocal(clickPoint.clone());
      const distXZ = Math.sqrt(localPoint.x * localPoint.x + localPoint.z * localPoint.z);

      if (localPoint.y < -0.03) {
        if (distXZ < 0.06 && localPoint.y > -0.55) {
          setSelectedAssetId('RISER-ALPHA');
          varunaVoice.speakDiagnostic('RISER-ALPHA');
        } else {
          setSelectedAssetId('PILLAR-FOUNDATION');
          varunaVoice.speakDiagnostic('PILLAR-FOUNDATION');
        }
      } else if (localPoint.y > 0.12 && distXZ < 0.15) {
        setSelectedAssetId('DRILL-SYSTEM');
        varunaVoice.speakDiagnostic('DRILL-SYSTEM');
      } else if (localPoint.y > 0.45 && distXZ < 0.18) {
        setSelectedAssetId('DRILL-SYSTEM');
        varunaVoice.speakDiagnostic('DRILL-SYSTEM');
      } else if (localPoint.y > 0.20 && (Math.abs(localPoint.x) > 0.12 || Math.abs(localPoint.z) > 0.13)) {
        setSelectedAssetId('CRANE-SYSTEM');
        varunaVoice.speakDiagnostic('CRANE-SYSTEM');
      } else if (Math.abs(localPoint.y - 0.08) < 0.04 && distXZ < 0.22) {
        setSelectedAssetId('RISER-ALPHA');
        varunaVoice.speakDiagnostic('RISER-ALPHA');
      } else {
        setSelectedAssetId('TOPSIDE-DRILL-RIG');
        varunaVoice.speakDiagnostic('TOPSIDE-DRILL-RIG');
      }
    }
  };

  const isAcoustic = scannerMode === 'acoustic';
  const isThermal = scannerMode === 'thermal';
  const isHologram = scannerMode === 'hologram';

  const isDrillIssue = emergencyScenario === 'drill_damage' || emergencyScenario === 'stuck_drill';

  const wallHeight = Math.abs(BEDROCK_BOTTOM_WORLD_Y - SEABED_WORLD_Y);
  const wallCenterY = (BEDROCK_BOTTOM_WORLD_Y - SEABED_WORLD_Y) / 2;
  const slotW = 16.0;
  const frontWingW = (LAND_WIDTH - slotW) / 2;
  const halfDepth = LAND_DEPTH / 2;
  const wingCenterX = slotW / 2 + frontWingW / 2;

  const holoBedrockMat = isHologram
    ? new THREE.MeshStandardMaterial({
        color: '#002244',
        roughness: 0.6,
        metalness: 0.4,
        emissive: new THREE.Color('#005599'),
        emissiveIntensity: 0.25,
        wireframe: false,
      })
    : new THREE.MeshStandardMaterial({
        color: isThermal ? '#220800' : isAcoustic ? '#000D1A' : '#5D4037',
        roughness: 0.88,
        metalness: 0.08,
      });

  return (
    <group ref={wholeRigGroupRef}>
      {/* 1. Main 3D Rig */}
      {objGroup && <primitive object={objGroup} onClick={handleObjectClick} />}

      {/* 2. ONLY THE INNER DRILL ROTARY SHAFT & BIT SPINS */}
      <group
        ref={innerDrillGroupRef}
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('DRILL-SYSTEM');
          varunaVoice.speakDiagnostic('DRILL-SYSTEM');
        }}
      >
        {/* Inner Spinning Drill Rod (Aqua Blue) */}
        <mesh
          geometry={innerDrillRodGeo}
          position={[0, SEABED_WORLD_Y + wallCenterY, 0]}
          userData={{ isDrill: true }}
        >
          <meshStandardMaterial
            color={isDrillIssue ? '#FF2200' : '#00D2FF'}
            emissive={isDrillIssue ? '#FF0000' : '#00F0FF'}
            emissiveIntensity={isDrillIssue ? 3.5 : 2.2}
            metalness={0.92}
            roughness={0.18}
          />
        </mesh>

        {/* Inner Rotating Spiral Helical Drilling Cutters */}
        {[-25, -45, -65, -85].map((yPos) => (
          <group key={yPos} position={[0, yPos, 0]}>
            {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => (
              <mesh
                key={idx}
                rotation={[0, angle, 0]}
                position={[Math.cos(angle) * 0.85, 0, Math.sin(angle) * 0.85]}
              >
                <boxGeometry args={[0.25, 2.2, 0.25]} />
                <meshStandardMaterial
                  color={isDrillIssue ? '#FF5500' : '#00FFFF'}
                  emissive={isDrillIssue ? '#FF2200' : '#00D2FF'}
                  emissiveIntensity={isDrillIssue ? 3.0 : 2.0}
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* Rotating Downhole PDC Cutting Drill Bit at Bottom (-98m) (DRILL BIT: Fiery Red-Orange) */}
        <mesh position={[0, -98, 0]} userData={{ isDrill: true }}>
          <coneGeometry args={[1.4, 3.5, 16]} />
          <meshStandardMaterial
            color="#FF3300"
            emissive="#FF4500"
            emissiveIntensity={3.8}
            metalness={0.92}
            roughness={0.15}
          />
        </mesh>
      </group>

      {/* 3. STATIC Outer Casing Guide Rings */}
      <group position={[0, 0, 0]}>
        {[-20, -40, -60, -80].map((depth) => (
          <group key={`static-ring-${depth}`} position={[0, depth, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.5, 2.0, 32]} />
              <meshStandardMaterial
                color="#005588"
                emissive="#003366"
                emissiveIntensity={0.6}
                metalness={0.8}
                roughness={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4. Subsea Pipeline Network: 9 Pipes & Ground Flowlines */}
      <SubseaPipelineFlowNetwork />

      {/* 5. Animated Upward-Flowing Oil Arrows in Central Borehole */}
      <OilFlowArrows />

      {/* 6. 100% STATIC Solid Enclosed Bedrock Foundation */}
      <group position={[0, SEABED_WORLD_Y, 0]}>
        {/* Top Level Sand Seabed Surface with Dunes */}
        <mesh
          geometry={sandSeabedGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.05, 0]}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAssetId('SUBSEA-BEDROCK');
            varunaVoice.speakDiagnostic('SUBSEA-BEDROCK');
          }}
        >
          <meshStandardMaterial
            vertexColors={!isThermal && !isAcoustic && !isHologram}
            color={isHologram ? '#00E5FF' : isThermal ? '#331100' : isAcoustic ? '#001A33' : '#D4A373'}
            roughness={0.88}
            metalness={0.06}
            wireframe={isAcoustic || isHologram}
            emissive={isHologram ? '#003366' : '#000000'}
            emissiveIntensity={isHologram ? 0.7 : 0}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* STATIC Solid Back Bedrock Half */}
        <mesh
          geometry={backBedrockGeo}
          position={[0, wallCenterY, -halfDepth / 2]}
          material={holoBedrockMat}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAssetId('SUBSEA-BEDROCK');
            varunaVoice.speakDiagnostic('SUBSEA-BEDROCK');
          }}
        />

        {/* STATIC Solid Front-Left Bedrock Wing */}
        <mesh
          geometry={leftFrontBedrockGeo}
          position={[-wingCenterX, wallCenterY, halfDepth / 2]}
          material={holoBedrockMat}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAssetId('SUBSEA-BEDROCK');
            varunaVoice.speakDiagnostic('SUBSEA-BEDROCK');
          }}
        />

        {/* STATIC Solid Front-Right Bedrock Wing */}
        <mesh
          geometry={rightFrontBedrockGeo}
          position={[wingCenterX, wallCenterY, halfDepth / 2]}
          material={holoBedrockMat}
          receiveShadow
          onClick={(e) => {
            e.stopPropagation();
            setSelectedAssetId('SUBSEA-BEDROCK');
            varunaVoice.speakDiagnostic('SUBSEA-BEDROCK');
          }}
        />

        {/* STATIC Solid Bottom Bedrock Base Slab */}
        <mesh
          geometry={bottomSlabGeo}
          position={[0, -wallHeight - 2.0, 0]}
          material={holoBedrockMat}
          receiveShadow
        />

        {/* STATIC Holographic Wireframe Edges on Bedrock */}
        {isHologram && (
          <group position={[0, wallCenterY, 0]}>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(LAND_WIDTH, wallHeight, LAND_DEPTH)]} />
              <lineBasicMaterial color="#00FFFF" transparent opacity={0.7} linewidth={2} />
            </lineSegments>
            {[-15, -35, -55, -75].map((yDepth) => (
              <lineSegments key={yDepth} position={[0, yDepth + wallHeight / 2, 0]}>
                <edgesGeometry args={[new THREE.BoxGeometry(LAND_WIDTH + 0.2, 0.1, LAND_DEPTH + 0.2)]} />
                <lineBasicMaterial color="#0099FF" transparent opacity={0.5} />
              </lineSegments>
            ))}
          </group>
        )}
      </group>
    </group>
  );
};
