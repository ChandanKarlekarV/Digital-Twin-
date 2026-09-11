import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { createHolographicMaterial } from '../../shaders/HolographicMaterial';
import { OilFlowArrows } from './OilFlowArrows';
import { SubseaPipelineFlowNetwork } from './SubseaPipelineFlowNetwork';

interface CustomObjRigProps {
  objUrl: string;
}

export const CustomObjRig: React.FC<CustomObjRigProps> = ({ objUrl }) => {
  const [objGroup, setObjGroup] = useState<THREE.Group | null>(null);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);
  const scannerMode = useRigStore((s) => s.scannerMode);

  // Scaled coordinate constants matching user yellow marking line
  const MODEL_SCALE = 45.0;
  const WATER_LINE_OBJ_Y = -0.22; // Column midpoint water line
  const SEABED_WORLD_Y = (-0.585 - WATER_LINE_OBJ_Y) * MODEL_SCALE; // -16.425m (matches user yellow line)
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
    // The outer cylinder, outer walls, and bedrock remain 100% static!
    if (innerDrillGroupRef.current) {
      innerDrillGroupRef.current.rotation.y += delta * 4.2;
    }
  });

  useEffect(() => {
    const loader = new OBJLoader();

    loader.load(
      objUrl,
      (loadedObj) => {
        // Calculate bounding box and center
        const box = new THREE.Box3().setFromObject(loadedObj);
        const center = new THREE.Vector3();
        box.getCenter(center);

        loadedObj.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);

        // Position: X and Z centered, Y shifted so water line sits at world Y = 0.0
        loadedObj.position.x = -center.x * MODEL_SCALE;
        loadedObj.position.y = -WATER_LINE_OBJ_Y * MODEL_SCALE;
        loadedObj.position.z = -center.z * MODEL_SCALE;

        // Rotate by -90 deg so the carved rectangular box and drill face the FRONT (+Z)
        loadedObj.rotation.y = -Math.PI / 2;

        // Holographic & Standard Component Color Palettes
        // 1. Holographic Cyber Palettes (High-tech vibrant glowing tones)
        const hPillars = new THREE.Color('#FF0055');    // Luminous Cyber Crimson (Pillars)
        const hFootings = new THREE.Color('#FF9100');   // Glowing Amber/Bronze (Footings)
        const hCranes = new THREE.Color('#FF6D00');     // Laser Orange (Cranes)
        const hPipes = new THREE.Color('#00E5FF');      // Electric Cyan (Pipes/Manifolds)
        const hDerrick = new THREE.Color('#00F5D4');    // Quantum Aqua (Derrick)
        const hHelipadRing = new THREE.Color('#FACC15'); // Radiant Solar Yellow Ring
        const hHelipadDeck = new THREE.Color('#0F172A'); // Deep Carbon Deck
        const hDeck = new THREE.Color('#00B4D8');       // Cyber Blueprint Blue (Deck)

        // 2. Standard Opaque Coated Palettes
        const cRed = new THREE.Color('#ED1B24');        // 1. Pillars (4 Stability Columns)
        const cBrown = new THREE.Color('#795548');      // 2. Foundation below pillars & Drill Derrick
        const cOrange = new THREE.Color('#FF6B00');     // 3. Cranes & Booms
        const cPipeGrey = new THREE.Color('#94A3B8');   // 4. Pipes, Braces & Jumpers
        const cHelipadRing = new THREE.Color('#FACC15'); // 5. Helipad Landing Ring
        const cHelipadDeck = new THREE.Color('#1E293B'); // 6. Helipad Pad Deck
        const cDeck = new THREE.Color('#334155');       // 7. Main Production Deck
        const cCasingGrey = new THREE.Color('#78909C');  // Static Outer Casing Cylinder

        // Initialize reusable Holographic materials
        const holoRigMat = createHolographicMaterial({
          baseColor: '#00D4FF',
          glowColor: '#00FFFF',
          opacity: 0.88,
          scanlineFreq: 1.2,
          glowIntensity: 2.2,
          useVertexColor: true,
        });
        holoRigMatRef.current = holoRigMat;

        // Static Outer Cylinder Casing (Semi-transparent so spinning inner drill is clearly visible)
        const holoOuterCasingMat = createHolographicMaterial({
          baseColor: '#003366',
          glowColor: '#00A3FF',
          opacity: 0.55,
          scanlineFreq: 0.6,
          glowIntensity: 1.4,
          wireframe: false,
        });
        holoOuterCasingMatRef.current = holoOuterCasingMat;

        // Inner Spinning Rotary Drill String Material
        const holoInnerDrillMat = createHolographicMaterial({
          baseColor: '#00FFFF',
          glowColor: '#0066FF',
          opacity: 0.95,
          scanlineFreq: 2.5,
          glowIntensity: 3.2,
        });
        holoInnerDrillMatRef.current = holoInnerDrillMat;

        const holoManifoldMat = createHolographicMaterial({
          baseColor: '#00FFAA',
          glowColor: '#00E5FF',
          opacity: 0.90,
          scanlineFreq: 1.5,
          glowIntensity: 2.0,
        });
        holoManifoldMatRef.current = holoManifoldMat;

        // Traverse and apply per-mesh specialized styling
        loadedObj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const name = mesh.name || '';

            if (name === 'pCube2') {
              // Hide raw block in favor of our continuous enclosed bedrock terrain
              mesh.visible = false;
            } else if (name === 'model_Mesh') {
              // STATIC Outer Borehole Casing Cylinder (Kept 100% static and stationary!)
              if (scannerMode === 'hologram') {
                mesh.material = holoOuterCasingMat;
              } else {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: cCasingGrey,
                  roughness: 0.45,
                  metalness: 0.6,
                  transparent: true,
                  opacity: 0.65,
                  side: THREE.DoubleSide,
                });
              }
            } else if (name === 'model1_Mesh') {
              // Subsea Manifold, Wellhead Jumpers, Valves & Mudmats (Static)
              if (scannerMode === 'hologram') {
                mesh.material = holoManifoldMat;
              } else {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: cPipeGrey,
                  roughness: 0.35,
                  metalness: 0.7,
                  side: THREE.DoubleSide,
                });
              }
            } else if (name === 'modelfinal_Mesh') {
              // Topside rig: Apply exact per-triangle classified component colors
              const geo = mesh.geometry;
              const pos = geo.attributes.position;
              const count = pos.count;
              const colors = new Float32Array(count * 3);
              const isHolo = scannerMode === 'hologram';

              for (let i = 0; i < count; i += 3) {
                const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
                const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
                const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);

                const cx = (x0 + x1 + x2) / 3;
                const cy = (y0 + y1 + y2) / 3;
                const cz = (z0 + z1 + z2) / 3;
                const distXZ = Math.sqrt(cx * cx + cz * cz);

                let chosen = isHolo ? hDeck : cDeck;

                if (cy < -0.03) {
                  // Below deck:
                  if (cy < -0.46) {
                    // Foundation footings / mudmats below pillars -> Brown / Amber Hologram
                    if (distXZ < 0.08) {
                      chosen = isHolo ? hPipes : cPipeGrey; // central riser conduit
                    } else {
                      chosen = isHolo ? hFootings : cBrown; // Foundation below pillars
                    }
                  } else {
                    // Between -0.46 and -0.03:
                    if (distXZ < 0.06) {
                      chosen = isHolo ? hPipes : cPipeGrey; // Central vertical riser conduit
                    } else if (cy > -0.35 && cy < -0.15 && (Math.abs(cx) < 0.05 || Math.abs(cz) < 0.05)) {
                      chosen = isHolo ? hPipes : cPipeGrey; // Horizontal structural pipe cross-braces
                    } else {
                      chosen = isHolo ? hPillars : cRed; // Red/Crimson buoyant stability columns
                    }
                  }
                } else {
                  // Above deck (cy >= -0.03):
                  const distHelipad = Math.sqrt((cx - 0.12) * (cx - 0.12) + (cz + 0.50) * (cz + 0.50));
                  if (cy > 0.30 && distHelipad < 0.25) {
                    if (cy > 0.36 && distHelipad < 0.20) {
                      chosen = isHolo ? hHelipadRing : cHelipadRing; // Helipad Landing Ring
                    } else {
                      chosen = isHolo ? hHelipadDeck : cHelipadDeck; // Helipad Deck Base
                    }
                  } else if (cy > 0.12 && distXZ < 0.14) {
                    chosen = isHolo ? hDerrick : cBrown; // Rotary drill floor & derrick lattice tower
                  } else if (cy > 0.45 && distXZ < 0.18) {
                    chosen = isHolo ? hDerrick : cBrown; // High crown block of derrick
                  } else if (cy > 0.20 && (Math.abs(cx) > 0.12 || Math.abs(cz) > 0.13)) {
                    chosen = isHolo ? hCranes : cOrange; // Heavy-lift deck pedestal cranes & booms
                  } else if (Math.abs(cy - 0.08) < 0.04 && distXZ < 0.22) {
                    chosen = isHolo ? hPipes : cPipeGrey; // Deck pipe manifolds
                  } else {
                    chosen = isHolo ? hDeck : cDeck; // Main production deck
                  }
                }

                for (let j = 0; j < 3; j++) {
                  const idx = (i + j) * 3;
                  colors[idx] = chosen.r;
                  colors[idx + 1] = chosen.g;
                  colors[idx + 2] = chosen.b;
                }
              }

              geo.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
              geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

              if (isHolo) {
                mesh.material = holoRigMat;
              } else {
                mesh.material = new THREE.MeshStandardMaterial({
                  vertexColors: true,
                  roughness: 0.42,
                  metalness: 0.4,
                  side: THREE.DoubleSide,
                });
              }
            }
          }
        });

        setObjGroup(loadedObj);
      },
      undefined,
      (err) => {
        console.warn('Failed to load .obj from url:', objUrl, err);
      }
    );
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
    const slotW = 16.0; // Central inspection chamber width
    const frontWingW = (LAND_WIDTH - slotW) / 2; // 47.0m
    const halfDepth = LAND_DEPTH / 2; // 55.0m

    // 1. Level Sand Seabed Plane with Natural Dunes, Humps and Bumps (110m x 110m)
    const segments = 96;
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

    // 2. Fully Covered Solid Bedrock Blocks:
    const backBlock = new THREE.BoxGeometry(LAND_WIDTH, wallHeight, halfDepth);
    const leftFrontBlock = new THREE.BoxGeometry(frontWingW, wallHeight, halfDepth);
    const rightFrontBlock = new THREE.BoxGeometry(frontWingW, wallHeight, halfDepth);
    const bottomBlock = new THREE.BoxGeometry(LAND_WIDTH, 4.0, LAND_DEPTH);

    // 3. Inner Rotating Drill Rod Geometry (fits inside the static outer cylinder)
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

  // Direct 3D mesh raycast click handler with Jarvis voice feedback
  const handleObjectClick = (e: any) => {
    e.stopPropagation();

    const clickedMesh = e.object as THREE.Mesh;
    const meshName = clickedMesh?.name || '';
    const clickPoint = e.point as THREE.Vector3;

    if (meshName === 'model1_Mesh') {
      // Subsea Manifold & Jumpers
      setSelectedAssetId('MANIFOLD-D6-MAIN');
      varunaVoice.speakDiagnostic('MANIFOLD-D6-MAIN');
      return;
    }

    if (meshName === 'model_Mesh' || clickedMesh?.userData?.isDrill) {
      // Subterranean Borehole Drill String
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

  const wallHeight = Math.abs(BEDROCK_BOTTOM_WORLD_Y - SEABED_WORLD_Y);
  const wallCenterY = (BEDROCK_BOTTOM_WORLD_Y - SEABED_WORLD_Y) / 2;
  const slotW = 16.0;
  const frontWingW = (LAND_WIDTH - slotW) / 2; // 47.0m
  const halfDepth = LAND_DEPTH / 2; // 55.0m
  const wingCenterX = slotW / 2 + frontWingW / 2; // 31.5m

  // Hologram Bedrock material
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
    <group>
      {/* 1. Main 3D Rig (With STATIC Outer Cylinder Casing and Topside Structure) */}
      <primitive object={objGroup} onClick={handleObjectClick} />

      {/* 2. ONLY THE INNER DRILL ROTARY SHAFT & BIT SPINS (Outer Cylinder is STATIC!) */}
      <group
        ref={innerDrillGroupRef}
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAssetId('DRILL-SYSTEM');
          varunaVoice.speakDiagnostic('DRILL-SYSTEM');
        }}
      >
        {/* Inner Spinning Drill Rod (Spans from Seabed down to -98m) */}
        <mesh
          geometry={innerDrillRodGeo}
          position={[0, SEABED_WORLD_Y + wallCenterY, 0]}
          userData={{ isDrill: true }}
        >
          <meshStandardMaterial
            color="#E0E6ED"
            emissive={isHologram ? '#00FFFF' : '#00D4FF'}
            emissiveIntensity={isHologram ? 1.6 : 0.4}
            metalness={0.92}
            roughness={0.18}
          />
        </mesh>

        {/* Inner Rotating Spiral Helical Drilling Cutters (Attached to Inner Rod) */}
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
                  color="#00FFFF"
                  emissive="#0088FF"
                  emissiveIntensity={1.4}
                  metalness={0.85}
                  roughness={0.2}
                />
              </mesh>
            ))}
          </group>
        ))}

        {/* Rotating Downhole PDC Cutting Drill Bit at Bottom (-98m) */}
        <mesh position={[0, -98, 0]} userData={{ isDrill: true }}>
          <coneGeometry args={[1.3, 3.2, 12]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive={isHologram ? '#00FFFF' : '#FFAA00'}
            emissiveIntensity={isHologram ? 1.8 : 0.5}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* 3. STATIC Outer Casing Guide Rings (Firmly Anchored to Bedrock Wall) */}
      <group position={[0, 0, 0]}>
        {[-20, -40, -60, -80].map((depth) => (
          <group key={`static-ring-${depth}`} position={[0, depth, 0]}>
            {/* Outer Static Collar Flange */}
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

      {/* 4. Subsea Pipeline Network: 9 Pipes & Ground Flowlines with Animated Thick Glowing Dark Blue Arrows */}
      <SubseaPipelineFlowNetwork />

      {/* 5. Animated Upward-Flowing Glowing Dark Blue Oil Arrows in Central Borehole */}
      <OilFlowArrows />

      {/* 5. 100% STATIC Solid Enclosed Bedrock Foundation (Left, Right, Back, Front Wings) */}
      <group position={[0, SEABED_WORLD_Y, 0]}>
        {/* Top Level Sand Seabed Surface with Dunes and Humps */}
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

        {/* STATIC Solid Back Bedrock Half (110m W x 55m D, covers entire rear) */}
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

        {/* STATIC Solid Front-Left Bedrock Wing (47m W x 55m D, covers left side completely!) */}
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

        {/* STATIC Solid Front-Right Bedrock Wing (47m W x 55m D, covers right side completely!) */}
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

        {/* STATIC Solid Bottom Bedrock Base Slab (110m x 110m x 4m) */}
        <mesh
          geometry={bottomSlabGeo}
          position={[0, -wallHeight - 2.0, 0]}
          material={holoBedrockMat}
          receiveShadow
        />

        {/* STATIC Holographic Wireframe Edges on the Bedrock Sides */}
        {isHologram && (
          <group position={[0, wallCenterY, 0]}>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(LAND_WIDTH, wallHeight, LAND_DEPTH)]} />
              <lineBasicMaterial color="#00FFFF" transparent opacity={0.7} linewidth={2} />
            </lineSegments>
            {/* Horizontal Geological Strata Scan Rings */}
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
