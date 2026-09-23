import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Scan,
  ShieldCheck,
  Zap,
  Gauge,
  Thermometer,
  Droplets,
  Radio,
  Volume2,
  Maximize2,
  Layers,
  Activity,
  ChevronRight,
  Disc,
  Anchor,
  Compass,
  Cpu,
  Flame,
} from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { KaTeXBlock } from '../common/KaTeXBlock';

// Cached OBJ geometry to prevent reloading
let cachedObjTemplate: THREE.Group | null = null;
let isLoadingObj = false;
const objLoadListeners: Array<(obj: THREE.Group) => void> = [];

const loadModelOnce = (url: string, onLoaded: (obj: THREE.Group) => void) => {
  if (cachedObjTemplate) {
    onLoaded(cachedObjTemplate.clone());
    return;
  }
  objLoadListeners.push(onLoaded);
  if (isLoadingObj) return;
  isLoadingObj = true;

  const loader = new OBJLoader();
  loader.load(
    url,
    (loadedObj) => {
      cachedObjTemplate = loadedObj;
      isLoadingObj = false;
      objLoadListeners.forEach((cb) => cb(loadedObj.clone()));
      objLoadListeners.length = 0;
    },
    undefined,
    (err) => {
      console.warn('Failed to load modal .obj model:', err);
      isLoadingObj = false;
    }
  );
};

interface HoloRigSectionProps {
  type: HolographicComponentType;
  autoRotate: boolean;
  orbitControlsRef: React.RefObject<any>;
}

/**
 * 3D Model Section Cropper & Selective Component Highlighting
 * - Long Rotatable Cylindrical Subsea Pipes with Multiphase Fluid Core
 * - Vibrant White Glowing Helipad with green perimeter lights
 * - Radiant Orange Crane 1 & Crane 2
 * - Emerald Cyan Upper Derrick Mast & Top Drive
 * - Full 360° OrbitControls & Smooth Drag Zoom
 */
const HoloRigCroppedSection: React.FC<HoloRigSectionProps> = ({ type, autoRotate, orbitControlsRef }) => {
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);
  const customObjUrl = useRigStore((s) => s.customObjUrl || '/models/untitled.obj');
  const groupRef = useRef<THREE.Group>(null);
  const pipeFluidMeshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const MODEL_SCALE = 45.0;
  const WATER_LINE_OBJ_Y = -0.22;

  const isPipe = type.startsWith('pipe');

  // Compute focal target and initial camera offset for each section
  const sectionConfig = useMemo(() => {
    switch (type) {
      case 'helipad':
        return {
          focalOffset: new THREE.Vector3(-22.03, 32.37, -3.23),
          camPos: new THREE.Vector3(-8.0, 42.0, 13.0),
          targetBounds: [24.0, 14.0, 22.0] as [number, number, number],
          camDistance: 20,
          label: 'CAP 437 HELIDECK SECTION',
          wireColor: '#00FF66',
        };
      case 'crane1':
        return {
          focalOffset: new THREE.Vector3(-3.90, 33.14, 8.54),
          camPos: new THREE.Vector3(-20.0, 43.0, 25.0),
          targetBounds: [28.0, 24.0, 20.0] as [number, number, number],
          camDistance: 22,
          label: 'PORT CRANE 1 (LATTICE BOOM) SECTION',
          wireColor: '#FF9900',
        };
      case 'crane2':
        return {
          focalOffset: new THREE.Vector3(-9.94, 28.40, -9.70),
          camPos: new THREE.Vector3(4.0, 38.0, -24.0),
          targetBounds: [24.0, 20.0, 18.0] as [number, number, number],
          camDistance: 20,
          label: 'STARBOARD CRANE 2 (PEDESTAL) SECTION',
          wireColor: '#FF007F',
        };
      case 'command_dock':
        return {
          focalOffset: new THREE.Vector3(0.0, 16.0, 0.0),
          camPos: new THREE.Vector3(0.0, 26.0, 22.0),
          targetBounds: [28.0, 14.0, 28.0] as [number, number, number],
          camDistance: 22,
          label: 'TACTICAL COMMAND DOCK & COCKPIT BRIDGE',
          wireColor: '#00E5FF',
        };
      case 'accommodation':
        return {
          focalOffset: new THREE.Vector3(15.09, 18.90, -5.68),
          camPos: new THREE.Vector3(29.0, 27.0, 8.0),
          targetBounds: [22.0, 14.0, 18.0] as [number, number, number],
          camDistance: 18,
          label: 'ACCOMMODATION MODULE (LIVING QUARTERS)',
          wireColor: '#9933FF',
        };
      case 'industrial_pipes':
        return {
          focalOffset: new THREE.Vector3(0.0, 18.0, 0.0),
          camPos: new THREE.Vector3(14.0, 25.0, 14.0),
          targetBounds: [16.0, 14.0, 16.0] as [number, number, number],
          camDistance: 18,
          label: 'INDUSTRIAL PROCESS PIPE FITTING & MANIFOLD',
          wireColor: '#00FFFF',
        };
      case 'jackup_legs':
        return {
          focalOffset: new THREE.Vector3(-0.18, -4.0, -0.15),
          camPos: new THREE.Vector3(28.0, 12.0, 28.0),
          targetBounds: [36.0, 28.0, 36.0] as [number, number, number],
          camDistance: 32,
          label: 'BUOYANT JACK-UP LEGS & FOUNDATION COLUMNS',
          wireColor: '#00B4D8',
        };
      case 'drill_string':
        return {
          focalOffset: new THREE.Vector3(-1.52, -18.0, 0.11),
          camPos: new THREE.Vector3(10.5, -12.0, 16.0),
          targetBounds: [14.0, 36.0, 14.0] as [number, number, number],
          camDistance: 24,
          label: 'SUBSEA DRILL STRING CONDUIT',
          wireColor: '#00D2FF',
        };
      case 'drill_bit':
        return {
          focalOffset: new THREE.Vector3(-1.52, -16.4, 0.11),
          camPos: new THREE.Vector3(4.5, -12.4, 8.0),
          targetBounds: [10.0, 10.0, 10.0] as [number, number, number],
          camDistance: 12,
          label: '8-1/2" PDC DIAMOND DRILL BIT HEAD',
          wireColor: '#FF3300',
        };
      case 'main_deck':
        return {
          focalOffset: new THREE.Vector3(-3.45, 14.85, 2.94),
          camPos: new THREE.Vector3(-3.45, 30.85, 26.94),
          targetBounds: [32.0, 12.0, 32.0] as [number, number, number],
          camDistance: 26,
          label: 'PLATFORM MAIN DECK STRUCTURE',
          wireColor: '#1976D2',
        };
      case 'upper_rig':
        return {
          focalOffset: new THREE.Vector3(0.68, 36.44, 0.47),
          camPos: new THREE.Vector3(14.68, 44.44, 16.47),
          targetBounds: [16.0, 24.0, 16.0] as [number, number, number],
          camDistance: 22,
          label: 'TOPSIDE DERRICK MAST SECTION',
          wireColor: '#00F5D4',
        };
      case 'motor':
        return {
          focalOffset: new THREE.Vector3(0.68, 26.0, 0.47),
          camPos: new THREE.Vector3(8.68, 30.0, 10.47),
          targetBounds: [12.0, 14.0, 12.0] as [number, number, number],
          camDistance: 14,
          label: '1,200 HP TOP DRIVE MOTOR SECTION',
          wireColor: '#38BDF8',
        };
      case 'drill':
        return {
          focalOffset: new THREE.Vector3(-1.52, -12.0, 0.11),
          camPos: new THREE.Vector3(10.5, -4.0, 16.0),
          targetBounds: [14.0, 32.0, 14.0] as [number, number, number],
          camDistance: 22,
          label: 'ROTARY DRILL STRING & CASING SECTION',
          wireColor: '#00FFFF',
        };
      case 'well1':
      case 'well2':
      case 'well3':
      case 'well4':
      case 'well5':
      case 'well6':
      case 'well7':
      case 'wells1_7':
        return {
          focalOffset: new THREE.Vector3(-0.85, -13.41, 4.57),
          camPos: new THREE.Vector3(13.15, -5.41, 20.57),
          targetBounds: [26.0, 14.0, 26.0] as [number, number, number],
          camDistance: 22,
          label: 'SUBSEA WELLHEAD & MANIFOLD SECTION',
          wireColor: '#A855F7',
        };
      default: // pipe1 to pipe9
        return {
          focalOffset: new THREE.Vector3(0, 0, 0),
          camPos: new THREE.Vector3(0, 0, 14),
          targetBounds: [8, 18, 8] as [number, number, number],
          camDistance: 14,
          label: `SUBSEA PRODUCTION PIPE ${type.replace('pipe', '')} CYLINDER`,
          wireColor: '#00E5FF',
        };
    }
  }, [type]);

  // Load and apply exact selective highlight shaders to model meshes
  useEffect(() => {
    if (isPipe) return;

    loadModelOnce(customObjUrl, (loadedObj) => {
      const cloned = loadedObj.clone(true);
      const box = new THREE.Box3().setFromObject(cloned);
      const center = new THREE.Vector3();
      box.getCenter(center);

      cloned.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
      cloned.position.x = -center.x * MODEL_SCALE;
      cloned.position.y = -WATER_LINE_OBJ_Y * MODEL_SCALE;
      cloned.position.z = -center.z * MODEL_SCALE;
      cloned.rotation.y = -Math.PI / 2;

      // Selectively highlight target component while dimming the background rig
      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const name = mesh.name || '';

          if (name === 'pCube2') {
            mesh.visible = false;
          } else if (name === 'model_Mesh') {
            // Drill casing / drill bit / drill string
            const isTarget = type === 'drill' || type === 'drill_string' || type === 'drill_bit';
            const wireColor = type === 'drill_bit' ? '#FF3300' : type === 'drill_string' ? '#00D2FF' : '#00E5FF';
            mesh.material = new THREE.MeshStandardMaterial({
              color: isTarget ? wireColor : '#001A33',
              emissive: isTarget ? wireColor : '#001122',
              emissiveIntensity: isTarget ? 3.2 : 0.1,
              wireframe: true,
              transparent: true,
              opacity: isTarget ? 0.95 : 0.1,
              side: THREE.DoubleSide,
            });
          } else if (name === 'model1_Mesh') {
            // Subsea manifold & wellheads
            const isTarget = type.startsWith('well') || type === 'wells1_7';
            mesh.material = new THREE.MeshStandardMaterial({
              color: isTarget ? '#C084FC' : '#001A33',
              emissive: isTarget ? '#A855F7' : '#001122',
              emissiveIntensity: isTarget ? 3.2 : 0.1,
              wireframe: true,
              transparent: true,
              opacity: isTarget ? 0.95 : 0.1,
              side: THREE.DoubleSide,
            });
          } else if (name === 'modelfinal_Mesh') {
            // Topside rig: Selectively color triangles according to target part
            const geo = mesh.geometry.clone();
            const pos = geo.attributes.position;
            const count = pos.count;
            const colors = new Float32Array(count * 3);

            const cDimmed = new THREE.Color('#031526');
            const cHelipadGreen = new THREE.Color('#00FF66');      // HELIPAD: Electric Green
            const cCrane1Amber = new THREE.Color('#FF9900');       // CRANE 1: Amber Orange
            const cCrane2Pink = new THREE.Color('#FF007F');        // CRANE 2: Fuchsia Pink
            const cAccommodationViolet = new THREE.Color('#9933FF'); // ACCOMMODATION: Violet
            const cIndustrialPipesCyan = new THREE.Color('#00FFFF'); // INDUSTRIAL PIPES: Bright Cyan
            const cJackupLegsTeal = new THREE.Color('#00B4D8');    // JACK-UP LEGS: Teal
            const cMainDeckBlue = new THREE.Color('#1976D2');      // MAIN DECK: Core Blue
            const cDerrickCyan = new THREE.Color('#00FFFF');       // PROCESS / DERRICK: Bright Cyan
            const cMotorSky = new THREE.Color('#38BDF8');

            for (let i = 0; i < count; i += 3) {
              const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
              const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
              const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);

              const cx = (x0 + x1 + x2) / 3;
              const cy = (y0 + y1 + y2) / 3;
              const cz = (z0 + z1 + z2) / 3;
              const distXZ = Math.sqrt(cx * cx + cz * cz);
              const distHelipad = Math.sqrt((cx - 0.12) * (cx - 0.12) + (cz + 0.50) * (cz + 0.50));

              let chosen = cDimmed;

              if (type === 'helipad' && cy > 0.28 && distHelipad < 0.28) {
                chosen = cHelipadGreen;
              } else if (type === 'crane1' && cy > 0.18 && (cx < -0.09 || (cz < -0.10 && cx < 0.05))) {
                chosen = cCrane1Amber;
              } else if (type === 'crane2' && cy > 0.18 && cx > 0.09 && cz < 0.15) {
                chosen = cCrane2Pink;
              } else if (type === 'accommodation' && cy > 0.08 && cy < 0.32 && cz > 0.12 && cx > -0.05 && distHelipad >= 0.28) {
                chosen = cAccommodationViolet;
              } else if (type === 'industrial_pipes' && cy > 0.06 && cy < 0.30 && Math.abs(cx) <= 0.14 && Math.abs(cz) <= 0.14) {
                chosen = cIndustrialPipesCyan;
              } else if (type === 'jackup_legs' && cy < 0.05) {
                chosen = cJackupLegsTeal;
              } else if (type === 'main_deck' && cy >= 0.05 && cy <= 0.16) {
                chosen = cMainDeckBlue;
              } else if (type === 'upper_rig' && cy > 0.32 && distXZ < 0.16) {
                chosen = cDerrickCyan;
              } else if (type === 'motor' && cy > 0.18 && cy < 0.36 && distXZ < 0.12) {
                chosen = cMotorSky;
              } else if (type === 'command_dock' && cy >= 0.08 && cy <= 0.26) {
                chosen = cDerrickCyan;
              }

              for (let j = 0; j < 3; j++) {
                const idx = (i + j) * 3;
                colors[idx] = chosen.r;
                colors[idx + 1] = chosen.g;
                colors[idx + 2] = chosen.b;
              }
            }

            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            mesh.geometry = geo;

            mesh.material = new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.25,
              metalness: 0.6,
              wireframe: true,
              transparent: true,
              opacity: 0.88,
              side: THREE.DoubleSide,
            });
          }
        }
      });

      setModelGroup(cloned);
    });
  }, [customObjUrl, type, isPipe]);

  // Set camera view centered on this section
  useEffect(() => {
    if (isPipe) {
      camera.position.set(0, 0, 14);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(
        sectionConfig.camPos.x - sectionConfig.focalOffset.x,
        sectionConfig.camPos.y - sectionConfig.focalOffset.y,
        sectionConfig.camPos.z - sectionConfig.focalOffset.z
      );
      camera.lookAt(0, 0, 0);
    }

    if (orbitControlsRef.current) {
      orbitControlsRef.current.target.set(0, 0, 0);
      orbitControlsRef.current.update();
    }
  }, [sectionConfig, camera, orbitControlsRef, isPipe]);

  // Gentle laser scanning beam animation & continuous fluid flow
  const laserRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (laserRef.current) {
      const halfH = sectionConfig.targetBounds[1] / 2;
      laserRef.current.position.y = Math.sin(t * 2.5) * halfH;
    }
    if (pipeFluidMeshRef.current) {
      pipeFluidMeshRef.current.rotation.y = t * 1.5;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. LONG ROTATABLE CYLINDRICAL PIPE RENDERER (For Pipes 1-9) */}
      {isPipe ? (
        <group position={[0, 0, 0]}>
          {/* Outer Glowing High-Tech Cylindrical Wireframe Cage */}
          <mesh>
            <cylinderGeometry args={[2.0, 2.0, 16.0, 36, 18, true]} />
            <meshBasicMaterial color="#00E5FF" wireframe transparent opacity={0.65} />
          </mesh>

          {/* Inner Translucent High-Pressure Oil & Gas Multiphase Core */}
          <mesh ref={pipeFluidMeshRef}>
            <cylinderGeometry args={[1.5, 1.5, 15.8, 28, 1]} />
            <meshStandardMaterial
              color="#FFA500"
              emissive="#FF7700"
              emissiveIntensity={2.8}
              transparent
              opacity={0.85}
              roughness={0.15}
              metalness={0.85}
            />
          </mesh>

          {/* Heavy Structural Connection Flange Rings Along the Cylinder */}
          {[-6.5, -3.2, 0, 3.2, 6.5].map((yPos) => (
            <group key={yPos} position={[0, yPos, 0]}>
              <mesh>
                <torusGeometry args={[2.3, 0.22, 16, 36]} />
                <meshStandardMaterial
                  color="#00FFFF"
                  emissive="#00FFFF"
                  emissiveIntensity={1.8}
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
              {/* Radial Bolt Couplers */}
              {[0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3].map((angle, idx) => (
                <mesh key={idx} position={[Math.cos(angle) * 2.3, 0, Math.sin(angle) * 2.3]}>
                  <sphereGeometry args={[0.2, 8, 8]} />
                  <meshBasicMaterial color="#00FFFF" />
                </mesh>
              ))}
            </group>
          ))}

          {/* Optical Fiber Sensor Strain Line */}
          <mesh position={[2.05, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 16.0, 8]} />
            <meshStandardMaterial color="#FF0055" emissive="#FF0033" emissiveIntensity={4.0} />
          </mesh>
        </group>
      ) : (
        /* 2. REAL MODEL SECTION WITH PRECISION SELECTIVE HIGHLIGHTING */
        modelGroup && (
          <group
            position={[
              -sectionConfig.focalOffset.x,
              -sectionConfig.focalOffset.y,
              -sectionConfig.focalOffset.z,
            ]}
          >
            <primitive object={modelGroup} />
          </group>
        )
      )}

      {/* Holographic 3D Section Crop Bounding Cage */}
      <group position={[0, 0, 0]}>
        <lineSegments>
          <edgesGeometry
            args={[
              new THREE.BoxGeometry(
                sectionConfig.targetBounds[0],
                sectionConfig.targetBounds[1],
                sectionConfig.targetBounds[2]
              ),
            ]}
          />
          <lineBasicMaterial
            color={sectionConfig.wireColor}
            transparent
            opacity={0.7}
            linewidth={2}
          />
        </lineSegments>

        {/* Animated Laser Scanning Plane */}
        <mesh ref={laserRef} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry
            args={[
              sectionConfig.targetBounds[0] * 0.98,
              sectionConfig.targetBounds[2] * 0.98,
            ]}
          />
          <meshBasicMaterial
            color={sectionConfig.wireColor}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Outer Corner Reticle Markers */}
        <mesh position={[0, sectionConfig.targetBounds[1] / 2 + 0.4, 0]}>
          <ringGeometry args={[1.2, 1.4, 32]} />
          <meshBasicMaterial color={sectionConfig.wireColor} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Orbit Controls with Full 360 Rotation, Zoom, and Pan */}
      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enableRotate={true}
        enableZoom={true}
        enablePan={true}
        autoRotate={autoRotate}
        autoRotateSpeed={1.8}
        minDistance={2.0}
        maxDistance={45.0}
        dampingFactor={0.08}
      />
    </group>
  );
};

export const HolographicPartInspectionModal: React.FC = () => {
  const activeHoloModal = useRigStore((s) => s.activeHoloModal);
  const closeHoloModal = useRigStore((s) => s.closeHoloModal);
  const openHoloModal = useRigStore((s) => s.openHoloModal);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const activeHydraulicResult = useTelemetryStore((s) => s.activeHydraulicResult);
  const activeMultiphaseResult = useTelemetryStore((s) => s.activeMultiphaseResult);

  const [isScanning, setIsScanning] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isExpanded3D, setIsExpanded3D] = useState(false);
  const orbitControlsRef = useRef<any>(null);

  if (!activeHoloModal) return null;

  const handleZoomIn = () => {
    if (orbitControlsRef.current?.object) {
      orbitControlsRef.current.object.position.multiplyScalar(0.85);
      orbitControlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (orbitControlsRef.current?.object) {
      orbitControlsRef.current.object.position.multiplyScalar(1.18);
      orbitControlsRef.current.update();
    }
  };

  const handleResetView = () => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.reset();
    }
  };

  const handleScan = () => {
    setIsScanning(true);
    varunaVoice.playSonarPing(880, 0.15);
    varunaVoice.speakCustom(`Non-destructive ultrasonic telemetry scan completed for ${activeHoloModal.toUpperCase()}. All parameters verified.`);
    setTimeout(() => setIsScanning(false), 2200);
  };

  // Component metadata catalog
  const getComponentData = (type: HolographicComponentType) => {
    // 1. PIPES 1-9
    if (type.startsWith('pipe')) {
      const pNum = type.replace('pipe', '');
      const pipeNames: { [k: string]: { name: string; tag: string; spec: string; depth: string; flow: string } } = {
        '1': { name: 'Subsea Production Riser Alpha', tag: 'RISER-ALPHA', spec: '12" SCR API 5L X70 Catenary', depth: '-35m to -1,020m', flow: '31,469 BPD' },
        '2': { name: 'Subsea Production Riser Beta', tag: 'RISER-BETA', spec: '12" High-Pressure Condensate', depth: '-35m to -1,020m', flow: '28,120 BPD' },
        '3': { name: 'Subsea Production Riser Gamma', tag: 'RISER-GAMMA', spec: '10" Multiphase Riser', depth: '-35m to -1,020m', flow: '26,450 BPD' },
        '4': { name: 'Subsea Production Riser Delta', tag: 'RISER-DELTA', spec: '10" Heavy Hydrocarbon Return', depth: '-35m to -1,020m', flow: '22,890 BPD' },
        '5': { name: 'Seabed Infield Gathering Line West', tag: 'GROUND-PIPE-W', spec: '16" Subsea Trunkline Inconel', depth: '-1,020m Seabed', flow: '42,100 BPD' },
        '6': { name: 'Seabed Infield Gathering Line East', tag: 'GROUND-PIPE-E', spec: '16" Subsea Trunkline Inconel', depth: '-1,020m Seabed', flow: '41,800 BPD' },
        '7': { name: 'Deep Field Reservoir Feed North', tag: 'GROUND-PIPE-N', spec: '12" Subsea High-Temp Feed', depth: '-1,850m Subsea', flow: '36,200 BPD' },
        '8': { name: 'Deep Field Reservoir Feed South', tag: 'GROUND-PIPE-S', spec: '12" Subsea High-Temp Feed', depth: '-1,920m Subsea', flow: '34,900 BPD' },
        '9': { name: 'Dual-Header Gathering Manifold Loop', tag: 'MANIFOLD-HEADER', spec: '20" Transverse Flow Loop', depth: '-1,020m Hub', flow: '78,400 BPD' },
      };

      const meta = pipeNames[pNum] || pipeNames['1'];
      return {
        title: `PIPE ${pNum} • ${meta.name.toUpperCase()}`,
        tag: meta.tag,
        category: 'SUBSEA FLOWLINE & RISER',
        spec: meta.spec,
        depth: meta.depth,
        image: '/presentation/subsea_pipes_glowing_arrows_1789149758412.jpg',
        latex: '\\Delta P = f_D \\cdot \\frac{L}{D} \\cdot \\frac{\\rho v^2}{2} = 0.28\\text{ bar}',
        metrics: [
          { label: 'FLOW RATE', val: meta.flow, icon: Droplets, color: 'text-cyan-400' },
          { label: 'LINE PRESSURE', val: `${currentRecord?.p_line_bar.toFixed(1) || '182.4'} bar`, icon: Gauge, color: 'text-amber-400' },
          { label: 'FLUID TEMP', val: `${currentRecord?.t_line_c.toFixed(1) || '48.6'} °C`, icon: Thermometer, color: 'text-rose-400' },
          { label: 'WALL THICKNESS', val: '18.4 mm (Nominal)', icon: ShieldCheck, color: 'text-emerald-400' },
          { label: 'FLOW VELOCITY', val: `${activeHydraulicResult?.flowVelocityMS.toFixed(2) || '1.84'} m/s`, icon: Activity, color: 'text-blue-400' },
          { label: 'REYNOLDS NUMBER', val: `${activeHydraulicResult?.reynoldsNumber.toLocaleString() || '25,723'} (Turbulent)`, icon: Zap, color: 'text-purple-400' },
        ],
      };
    }

    // 2. DRILL STRING & CASING CONDUIT
    if (type === 'drill_string') {
      return {
        title: 'SUBSEA ROTARY DRILL STRING & RISER CASING CONDUIT',
        tag: 'DRILL-STRING-5-7/8',
        category: 'DOWNHOLE DRILLING CONDUIT',
        spec: '5-7/8" S-135 High-Strength Drill Pipe • NC50 Tool Joints',
        depth: '-35m to -2,040m Borehole Depth',
        image: '/presentation/drill_static_casing_spinning_core_1789149401625.jpg',
        latex: '\\sigma_{\\text{tensile}} = \\frac{W_{\\text{string}} + F_{\\text{overpull}}}{A_{\\text{pipe}}} = 210.4\\text{ MPa} \\quad [\\text{SF} = 4.62]',
        metrics: [
          { label: 'DRILLSTRING LENGTH', val: '2,040 m (Active)', icon: Compass, color: 'text-cyan-400' },
          { label: 'STRING WEIGHT (MUD)', val: '184 Metric Tons', icon: Anchor, color: 'text-amber-400' },
          { label: 'TOP-DRIVE RPM', val: '42 RPM (Nominal)', icon: Disc, color: 'text-emerald-400' },
          { label: 'ANNULAR VELOCITY', val: '1.42 m/s (Bingham)', icon: Activity, color: 'text-purple-400' },
          { label: 'STANDPIPE PRESSURE', val: '295 bar (4,278 psi)', icon: Gauge, color: 'text-blue-400' },
          { label: 'STICK-SLIP INDEX', val: '0.04 (Low Vibration)', icon: ShieldCheck, color: 'text-emerald-400' },
        ],
      };
    }

    // 3. DRILL BIT (PDC DIAMOND CUTTERS)
    if (type === 'drill_bit') {
      return {
        title: '8-1/2" MATRIX-BODY PDC DIAMOND CUTTER DRILL BIT',
        tag: 'PDC-BIT-8.5IN',
        category: 'FORMATION EXCAVATION',
        spec: '6-Blade Matrix Body • 16mm Premium Polycrystalline Diamond Cutters',
        depth: '-2,040m Subterranean Bedrock',
        image: '/presentation/drill_static_casing_spinning_core_1789149401625.jpg',
        latex: '\\text{MSE} = \\frac{\\text{WOB}}{A_b} + \\frac{120 \\pi \\cdot N \\cdot T}{A_b \\cdot \\text{ROP}} = 38.4\\text{ MPa}',
        metrics: [
          { label: 'BIT DIAMETER', val: '8.500" (215.9 mm)', icon: Disc, color: 'text-rose-400' },
          { label: 'CUTTER COUNT', val: '48 PDC Cutters', icon: Zap, color: 'text-amber-400' },
          { label: 'ROP (PENETRATION)', val: '14.5 m/hr (Bedrock)', icon: Activity, color: 'text-cyan-400' },
          { label: 'WEIGHT ON BIT', val: '18.2 MT (Nominal)', icon: Gauge, color: 'text-emerald-400' },
          { label: 'NOZZLE JET SPEED', val: '82 m/s (Mud Jet)', icon: Droplets, color: 'text-blue-400' },
          { label: 'DULL GRADING', val: '1-1-NO-A-X-I-NO-TD', icon: ShieldCheck, color: 'text-emerald-400' },
        ],
      };
    }

    // 4. DRILL GENERAL
    if (type === 'drill') {
      return {
        title: 'ROTARY DRILL STRING & PDC DIAMOND BIT ASSEMBLY',
        tag: 'DRILL-SYSTEM-D6',
        category: 'ROTARY DRILLING CORE',
        spec: '8-1/2" Matrix Body PDC Bit • 5-7/8" S-135 Drill Pipe',
        depth: '-2,040m Target Reservoir Depth',
        image: '/presentation/oil_flow_arrows_drill_1789149090190.jpg',
        latex: 'T = \\frac{\\tau \\cdot J}{r} = 28.4\\text{ kNm}, \\quad \\text{SF} = \\frac{\\sigma_{\\text{yield}}}{\\sigma_{\\text{eq}}} = 9.327',
        metrics: [
          { label: 'ROTARY SPEED', val: '42 RPM (Nominal)', icon: Disc, color: 'text-cyan-400' },
          { label: 'TORSIONAL TORQUE', val: '28.4 kNm', icon: Zap, color: 'text-amber-400' },
          { label: 'WEIGHT ON BIT (WOB)', val: '18.2 MT', icon: Gauge, color: 'text-emerald-400' },
          { label: 'RATE OF PENETRATION', val: '14.5 m/hr', icon: Activity, color: 'text-purple-400' },
          { label: 'TORSIONAL STRESS', val: '45.03 MPa (Safe)', icon: ShieldCheck, color: 'text-blue-400' },
          { label: 'DRILL BIT WEAR', val: '8.4% (Nominal)', icon: Thermometer, color: 'text-emerald-400' },
        ],
      };
    }

    // 5. MOTOR
    if (type === 'motor') {
      return {
        title: '1,200 HP TOP DRIVE INDUCTION MOTOR & MUD PUMP VFD',
        tag: 'MOTOR-VFD-1200HP',
        category: 'POWER & ROTARY DRIVE',
        spec: '4,160V 3-Phase AC Induction • Siemens MasterDrive VFD',
        depth: 'Topside Rig Mezzanine Deck (+12m)',
        image: '/presentation/oil_flow_arrows_drill_1789149090190.jpg',
        latex: 'P_{\\text{mech}} = \\sqrt{3} \\cdot V \\cdot I \\cdot \\cos\\phi \\cdot \\eta = 895.2\\text{ kW} \\quad (1,200\\text{ HP})',
        metrics: [
          { label: 'RATED POWER', val: '1,200 HP / 895 kW', icon: Zap, color: 'text-cyan-400' },
          { label: 'SUPPLY VOLTAGE', val: '4,160 V (3-Phase)', icon: Cpu, color: 'text-purple-400' },
          { label: 'STATOR CURRENT', val: '168.4 A', icon: Activity, color: 'text-amber-400' },
          { label: 'STATOR TEMP', val: '64.2 °C (Class H Ins)', icon: Thermometer, color: 'text-rose-400' },
          { label: 'PUMP DISCHARGE', val: '345.0 bar (5,000 psi)', icon: Gauge, color: 'text-emerald-400' },
          { label: 'VFD EFFICIENCY', val: '98.4%', icon: ShieldCheck, color: 'text-blue-400' },
        ],
      };
    }

    // 6. HELIPAD
    if (type === 'helipad') {
      return {
        title: 'CAP 437 OFFSHORE HELIDECK & AVIATION PLATFORM',
        tag: 'HELIDECK-D6-ALPHA',
        category: 'OFFSHORE AVIATION',
        spec: 'D-Value: 22.2m • Max Landing Weight: 12.8 MT',
        depth: 'Topside Cantilever Deck (+38m ASL)',
        image: '/presentation/helipad_deck_schematic.jpg',
        latex: '\\text{Heave Velocity} \\le 1.3\\text{ m/s}, \\quad \\text{Pitch/Roll} \\le \\pm 2.0^\\circ \\quad [\\text{CAP 437 Standard}]',
        metrics: [
          { label: 'MAX CAPACITY', val: '12.8 MT (Sikorsky S-92)', icon: Anchor, color: 'text-cyan-400' },
          { label: 'CLEARANCE STATUS', val: 'GREEN - CLEAR TO LAND', icon: ShieldCheck, color: 'text-emerald-400' },
          { label: 'DECK HEAVE RATE', val: '0.42 m/s (Calm)', icon: Activity, color: 'text-blue-400' },
          { label: 'WIND OVER DECK', val: '18.4 kt (065° ENE)', icon: Compass, color: 'text-amber-400' },
          { label: 'SURFACE FRICTION', val: 'μ = 0.68 (Non-Slip)', icon: Gauge, color: 'text-purple-400' },
          { label: 'PERIMETER LIGHTS', val: '100% OPERATIONAL', icon: Zap, color: 'text-emerald-400' },
        ],
      };
    }

    // 7. CRANE 1
    if (type === 'crane1') {
      return {
        title: 'HEAVY-LIFT ELECTRO-HYDRAULIC PEDESTAL CRANE 1 (PORT)',
        tag: 'CRANE-PORT-65T',
        category: 'OFFSHORE MATERIAL HANDLING',
        spec: '65 MT SWL at 18m Radius • 42m Lattice Boom',
        depth: 'Topside Main Deck (+18m ASL)',
        image: '/presentation/crane1_port_boom_schematic.jpg',
        latex: '\\text{Load Moment} = F_{\\text{load}} \\cdot R_{\\text{boom}} \\le M_{\\text{max}} = 1,170\\text{ ton}\\cdot\\text{m}',
        metrics: [
          { label: 'MAX CAPACITY (SWL)', val: '65.0 Metric Tons', icon: Anchor, color: 'text-cyan-400' },
          { label: 'BOOM RADIUS', val: '24.5 m (Max 42.0m)', icon: Compass, color: 'text-amber-400' },
          { label: 'HOIST TENSION', val: '420.5 kN', icon: Zap, color: 'text-rose-400' },
          { label: 'SLEW BEARING ANGLE', val: '142.5° Port', icon: Activity, color: 'text-purple-400' },
          { label: 'WIND CUTOFF LIMIT', val: '38.0 kt (Current: 18.4 kt)', icon: Gauge, color: 'text-emerald-400' },
          { label: 'SAFETY INTERLOCK', val: 'ARMED & CERTIFIED', icon: ShieldCheck, color: 'text-blue-400' },
        ],
      };
    }

    // 8. CRANE 2
    if (type === 'crane2') {
      return {
        title: 'AUXILIARY SUPPLY DECK CRANE 2 (STARBOARD)',
        tag: 'CRANE-STBD-30T',
        category: 'OFFSHORE MATERIAL HANDLING',
        spec: '30 MT SWL at 12m Radius • 28m Box Girder Boom',
        depth: 'Topside Starboard Mezzanine (+16m ASL)',
        image: '/presentation/crane2_starboard_pedestal_schematic.jpg',
        latex: '\\text{Dynamic Amplification Factor} = 1.0 + 0.4 \\cdot \\left(\\frac{H_s}{3.0}\\right) = 1.22',
        metrics: [
          { label: 'MAX CAPACITY (SWL)', val: '30.0 Metric Tons', icon: Anchor, color: 'text-cyan-400' },
          { label: 'BOOM RADIUS', val: '16.2 m (Max 28.0m)', icon: Compass, color: 'text-amber-400' },
          { label: 'WHIP HOIST TENSION', val: '110.2 kN', icon: Zap, color: 'text-amber-400' },
          { label: 'SLEW BEARING ANGLE', val: '220.0° Starboard', icon: Activity, color: 'text-purple-400' },
          { label: 'WIND CUTOFF LIMIT', val: '35.0 kt (Current: 18.4 kt)', icon: Gauge, color: 'text-emerald-400' },
          { label: 'STATUS', val: 'ACTIVE UTILITY LIFTS', icon: ShieldCheck, color: 'text-emerald-400' },
        ],
      };
    }

    // 9. COMMAND DOCK
    if (type === 'command_dock') {
      return {
        title: 'TACTICAL COMMAND DOCK & DIGITAL TWIN SCADA COCKPIT',
        tag: 'DOCK-BRIDGE-MAIN',
        category: 'COMMAND & CONTROL INTERFACE',
        spec: 'Real-Time Edge SCADA Gateway • Dual Redundant Fiber Optic Hub',
        depth: 'Topside Control Deck (+16m ASL)',
        image: '/presentation/command_dock_tactical_bridge.jpg',
        latex: '\\tau_{\\text{latency}} = \\Delta t_{\\text{sensor}} + \\Delta t_{\\text{mesh}} \\le 12.5\\text{ ms} \\quad [\\text{IEC 61850 Realtime}]',
        metrics: [
          { label: 'SCADA CYCLE TIME', val: '8.4 ms (Ultra Fast)', icon: Cpu, color: 'text-cyan-400' },
          { label: 'TELEMETRY BUS', val: 'Dual Modbus / OPC-UA', icon: Zap, color: 'text-emerald-400' },
          { label: 'UPLINK BANDWIDTH', val: '10 Gbps Redundant', icon: Activity, color: 'text-blue-400' },
          { label: 'AI CO-PILOT AGENT', val: 'VARUNA ACTIVE (0.12s)', icon: ShieldCheck, color: 'text-purple-400' },
          { label: 'ACTIVE SUBSYSTEMS', val: '24 / 24 Online', icon: Gauge, color: 'text-emerald-400' },
          { label: 'CYBERSECURITY', val: 'IEC 62443 SL-4 ARMED', icon: Anchor, color: 'text-amber-400' },
        ],
      };
    }

    // 10. ACCOMMODATION MODULE
    if (type === 'accommodation') {
      return {
        title: 'OFFSHORE ACCOMMODATION MODULE & LIVING QUARTERS',
        tag: 'ACCOMMODATION-D6',
        category: 'HABITATION & HVAC',
        spec: '120 POB Safe Haven • Blast-Resistant Class H-60 Division',
        depth: 'Topside Quarters Deck (+24m ASL)',
        image: '/presentation/rig_diorama_colored_1789147250513.jpg',
        latex: 'Q_{\\text{HVAC}} = \\dot{m} \\cdot C_p \\cdot \\Delta T + Q_{\\text{sensible}} = 450.8\\text{ kW}',
        metrics: [
          { label: 'POB CAPACITY', val: '120 Personnel On Board', icon: ShieldCheck, color: 'text-purple-400' },
          { label: 'OVERPRESSURE HVAC', val: '50 Pa Positive Margin', icon: Gauge, color: 'text-cyan-400' },
          { label: 'EMERGENCY SUPPORT', val: '96 hrs Self-Contained', icon: Zap, color: 'text-emerald-400' },
          { label: 'GAS INGRESS DAMPER', val: 'SIL-3 AUTO ISOLATION', icon: Activity, color: 'text-amber-400' },
          { label: 'FIRE RATING', val: 'Class H-60 Blast Proof', icon: ShieldCheck, color: 'text-rose-400' },
          { label: 'AMBIENT TEMP', val: '22.5 °C Comfort Index', icon: Thermometer, color: 'text-blue-400' },
        ],
      };
    }

    // 11. INDUSTRIAL PROCESS PIPES
    if (type === 'industrial_pipes') {
      return {
        title: 'INDUSTRIAL PROCESS PIPE FITTING & MANIFOLD FLANGES',
        tag: 'PROCESS-PIPING-D6',
        category: 'TOP-SIDE PROCESS PIPING',
        spec: 'Class 2500# RTJ Duplex Stainless Steel 22Cr',
        depth: 'Topside Mezzanine (+14m ASL)',
        image: '/presentation/subsea_pipes_glowing_arrows_1789149758412.jpg',
        latex: '\\sigma_{\\text{hoop}} = \\frac{P \\cdot D}{2 \\cdot t \\cdot E} = 142.6\\text{ MPa} \\le 0.72 \\cdot \\sigma_{\\text{yield}}',
        metrics: [
          { label: 'DESIGN PRESSURE', val: '414 bar (6,000 psi)', icon: Gauge, color: 'text-cyan-400' },
          { label: 'CORROSION CLAD', val: '3.0 mm Inconel 625', icon: ShieldCheck, color: 'text-emerald-400' },
          { label: 'FLANGE RATING', val: 'ANSI Class 2500 RTJ', icon: Zap, color: 'text-amber-400' },
          { label: 'GAS FLOW RATE', val: '8.5 MMSCMD Gas', icon: Droplets, color: 'text-purple-400' },
          { label: 'WELD NDT CHECK', val: '100% RADIOGRAPHIC PASS', icon: ShieldCheck, color: 'text-blue-400' },
          { label: 'VIBRATION RMS', val: '1.2 mm/s (ISO 10816)', icon: Activity, color: 'text-emerald-400' },
        ],
      };
    }

    // 12. JACK-UP LEGS & COLUMNS
    if (type === 'jackup_legs') {
      return {
        title: 'BUOYANT JACK-UP LEGS & SUBMERGED FOUNDATION COLUMNS',
        tag: 'STABILITY-COLUMNS-4X',
        category: 'HYDROSTATIC STABILITY',
        spec: '4x High-Tensile Steel Column Pontoons • 18,400 MT Net Buoyancy',
        depth: 'Surface to -35m Keel Draft',
        image: '/presentation/ocean_current_tides_flow_power_1789151043507.jpg',
        latex: '\\overline{GM} = KB + BM - KG = 3.42\\text{ m} > 1.0\\text{ m} \\quad [\\text{IMO Standard}]',
        metrics: [
          { label: 'METACENTRIC HEIGHT GM', val: '3.42 m (Positive)', icon: Anchor, color: 'text-cyan-400' },
          { label: 'OPERATING DRAFT', val: '-21.0 m (Ballasted)', icon: Compass, color: 'text-blue-400' },
          { label: 'MOORING TENSION', val: '4,250 kN Balanced', icon: Zap, color: 'text-amber-400' },
          { label: 'BALLAST TRIM', val: '68.4% Seawater Level', icon: Droplets, color: 'text-emerald-400' },
          { label: 'FATIGUE LIFE INDEX', val: '12.4% (25-Year Life)', icon: Activity, color: 'text-purple-400' },
          { label: 'CATHODIC ANODES', val: 'OPTIMAL POLARIZATION', icon: ShieldCheck, color: 'text-emerald-400' },
        ],
      };
    }

    // 13. MAIN DECK STRUCTURE
    if (type === 'main_deck') {
      return {
        title: 'PLATFORM MAIN DECK STRUCTURE & TOPSIDE PROCESS HUB',
        tag: 'MAIN-DECK-LEVEL1',
        category: 'PRIMARY LOAD BEARING DECK',
        spec: 'High-Yield Structural Steel S355ML • Integrated Coffer Dam',
        depth: 'Topside Main Deck (+12m ASL)',
        image: '/presentation/rig_diorama_colored_1789147250513.jpg',
        latex: '\\sigma_{\\text{bending}} = \\frac{M \\cdot y}{I} = 98.2\\text{ MPa} \\le \\sigma_{\\text{allowable}} = 230\\text{ MPa}',
        metrics: [
          { label: 'TOTAL DECK AREA', val: '4,800 m² Dual Level', icon: Anchor, color: 'text-blue-400' },
          { label: 'VARIABLE LOAD', val: '6,500 Metric Tons', icon: Gauge, color: 'text-amber-400' },
          { label: 'DECK DEFLECTION', val: '12 mm (Span: 45m)', icon: Activity, color: 'text-emerald-400' },
          { label: 'BLAST WALL RATING', val: '1.2 bar Overpressure', icon: ShieldCheck, color: 'text-rose-400' },
          { label: 'ESCAPE ROUTE LIGHT', val: '100% UPS Powered', icon: Zap, color: 'text-cyan-400' },
          { label: 'ENVIRONMENTAL DRAIN', val: 'ZERO SHEEN CLOSED LOOP', icon: Droplets, color: 'text-emerald-400' },
        ],
      };
    }

    // 14. UPPER RIG
    if (type === 'upper_rig') {
      return {
        title: 'TOPSIDE DERRICK MAST, PRODUCTION PROCESS & LIVING QUARTERS',
        tag: 'TOPSIDE-STRUCTURE',
        category: 'SURFACE PRODUCTION FACILITY',
        spec: 'Semi-Submersible Hub • 18,400 MT Total Operating Load',
        depth: 'Surface to +65m Derrick Apex',
        image: '/presentation/hologram_digital_twin_1789148609789.jpg',
        latex: '\\sum F_y = F_{\\text{buoyancy}} - \\left(W_{\\text{hull}} + W_{\\text{topside}} + T_{\\text{mooring}}\\right) = 0',
        metrics: [
          { label: 'TOTAL TOPSIDE LOAD', val: '18,400 Metric Tons', icon: Anchor, color: 'text-cyan-400' },
          { label: 'DERRICK HEIGHT', val: '+65.0 m ASL', icon: Compass, color: 'text-amber-400' },
          { label: 'PROCESS CAPACITY', val: '45,000 BPD Liquid', icon: Droplets, color: 'text-emerald-400' },
          { label: 'GAS COMPRESSION', val: '8.5 MMSCMD Gas', icon: Flame, color: 'text-purple-400' },
          { label: 'POB CAPACITY', val: '120 Personnel On Board', icon: ShieldCheck, color: 'text-blue-400' },
          { label: 'STRUCTURAL STRAIN', val: '0.042% (Max Allowable: 0.2%)', icon: Activity, color: 'text-emerald-400' },
        ],
      };
    }

    // 15. WELLS 1-7
    const wellNum = type.replace('well', '');
    const isSingleWell = !isNaN(Number(wellNum));
    const wellData: { [k: string]: { name: string; type: string; depth: string; press: string } } = {
      '1': { name: 'D6-MA1', type: 'High Pressure Gas Condensate', depth: '-1,820m', press: '240.5 bar' },
      '2': { name: 'D6-MA2', type: 'Sweet Crude Oil', depth: '-1,940m', press: '265.0 bar' },
      '3': { name: 'D6-R1', type: 'Ultra Deep Gas', depth: '-2,040m', press: '290.8 bar' },
      '4': { name: 'D6-R2', type: 'Associated Gas & Condensate', depth: '-2,010m', press: '275.4 bar' },
      '5': { name: 'D6-MJ1', type: 'Deep Miocene Turbidite Oil', depth: '-2,150m', press: '310.2 bar' },
      '6': { name: 'D6-MJ2', type: 'Infill Multiphase Producer', depth: '-2,120m', press: '305.1 bar' },
      '7': { name: 'D6-SW1', type: 'Subsea Water Injection Well', depth: '-1,780m', press: '210.0 bar' },
    };

    const curWell = wellData[wellNum] || wellData['1'];

    return {
      title: isSingleWell
        ? `SUBSEA PRODUCTION WELL ${wellNum} (${curWell.name}) CHRISTMAS TREE`
        : 'SUBSEA WELLS 1 THROUGH 7 CHRISTMAS TREE CLUSTER',
      tag: isSingleWell ? `XT-WELLHEAD-0${wellNum}` : 'WELLHEADS-CLUSTER-1-7',
      category: 'SUBSEA GEOLOGICAL INTERFACE',
      spec: '10,000 psi (690 bar) Dual-Bore Subsea Christmas Tree (API 17D)',
      depth: isSingleWell ? curWell.depth : '-1,780m to -2,150m Seabed',
      image: '/presentation/subsea_pipes_glowing_arrows_1789149758412.jpg',
      latex: 'P_{\\text{BHP}} = P_{\\text{WHP}} + \\int_0^H \\rho_{\\text{fluid}}(z) \\, g \\, dz - \\Delta P_{\\text{friction}} = 385.4\\text{ bar}',
      metrics: [
        { label: 'WELLHEAD PRESSURE', val: isSingleWell ? curWell.press : '265.4 bar (Avg)', icon: Gauge, color: 'text-amber-400' },
        { label: 'RESERVOIR ZONE', val: isSingleWell ? curWell.type : '7 Active Deepwater Wells', icon: Droplets, color: 'text-cyan-400' },
        { label: 'CHOKE POSITION', val: '64.5% Open (Electro-Hydraulic)', icon: Activity, color: 'text-emerald-400' },
        { label: 'DOWNHOLE SAFETY (SSSV)', val: 'FAIL-SAFE OPEN / OPERATIONAL', icon: ShieldCheck, color: 'text-emerald-400' },
        { label: 'ANNULUS PRESSURE', val: '14.2 bar (A-Annulus Nominal)', icon: Zap, color: 'text-purple-400' },
        { label: 'DOWNHOLE TEMP', val: '62.4 °C (Bottomhole)', icon: Thermometer, color: 'text-rose-400' },
      ],
    };
  };

  const data = getComponentData(activeHoloModal);

  // Quick navigation items list
  const navTabs: { id: HolographicComponentType; label: string }[] = [
    { id: 'pipe1', label: 'Pipe 1' },
    { id: 'pipe2', label: 'Pipe 2' },
    { id: 'pipe3', label: 'Pipe 3' },
    { id: 'pipe4', label: 'Pipe 4' },
    { id: 'pipe5', label: 'Pipe 5' },
    { id: 'pipe6', label: 'Pipe 6' },
    { id: 'pipe7', label: 'Pipe 7' },
    { id: 'pipe8', label: 'Pipe 8' },
    { id: 'pipe9', label: 'Pipe 9' },
    { id: 'helipad', label: 'Helipad' },
    { id: 'crane1', label: 'Crane 1' },
    { id: 'crane2', label: 'Crane 2' },
    { id: 'command_dock', label: 'Command Dock' },
    { id: 'accommodation', label: 'Accommodation' },
    { id: 'industrial_pipes', label: 'Industrial Pipes' },
    { id: 'jackup_legs', label: 'Jack-Up Legs' },
    { id: 'drill_string', label: 'Drill String' },
    { id: 'drill_bit', label: 'Drill Bit' },
    { id: 'main_deck', label: 'Main Deck' },
    { id: 'motor', label: 'Motor VFD' },
    { id: 'upper_rig', label: 'Upper Rig' },
    { id: 'wells1_7', label: 'Wells 1–7' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-reliance-dark/90 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] glass-panel-alert border-2 border-reliance-cyan/60 bg-reliance-deepnavy/98 rounded-3xl shadow-cyan-glow flex flex-col overflow-hidden text-white font-sans">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-reliance-cyan/30 bg-reliance-blue/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/40 animate-pulse">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-reliance-cyan bg-reliance-cyan/20 px-2 py-0.5 rounded border border-reliance-cyan/40">
                  JARVIS HOLOGRAPHIC 3D DIAGNOSTICS
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  REAL 3D MODEL SECTION • 360° ORBIT
                </span>
              </div>
              <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-white mt-0.5 font-mono">
                {data.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded3D(!isExpanded3D)}
              className="px-2.5 py-1.5 rounded-xl bg-reliance-navy/80 hover:bg-reliance-blue/60 text-reliance-cyan border border-reliance-cyan/40 text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Toggle Full 3D View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isExpanded3D ? 'SPLIT TELEMETRY' : 'EXPAND 3D'}</span>
            </button>
            <button
              onClick={closeHoloModal}
              className="p-2 rounded-xl bg-reliance-navy/80 hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer border border-white/15"
              title="Close Holographic Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className={`flex-1 grid gap-4 p-3.5 sm:p-4 overflow-y-auto ${isExpanded3D ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'}`}>
          {/* 3D Holographic Interactive Rotating Canvas (Large and Long) */}
          <div className={`flex flex-col space-y-3 ${isExpanded3D ? 'col-span-1 h-full min-h-[550px]' : 'lg:col-span-7'}`}>
            <div className="relative flex-1 min-h-[360px] sm:min-h-[460px] lg:min-h-[500px] rounded-2xl bg-black/85 border border-reliance-cyan/40 p-3 flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Holographic Grid Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ffff0d_1px,transparent_1px),linear-gradient(to_bottom,#00ffff0d_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* 3D Canvas Rendering */}
              <div className="absolute inset-0">
                <Canvas camera={{ position: [0, 0, 18], fov: 45 }}>
                  <ambientLight intensity={1.4} />
                  <pointLight position={[20, 25, 20]} intensity={3.0} color="#00ffff" />
                  <pointLight position={[-20, -20, -20]} intensity={2.0} color="#ff8800" />
                  <pointLight position={[0, 30, 0]} intensity={2.5} color="#ffffff" />
                  <HoloRigCroppedSection
                    type={activeHoloModal}
                    autoRotate={autoRotate}
                    orbitControlsRef={orbitControlsRef}
                  />
                </Canvas>
              </div>

              {/* Top HUD Badges */}
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono pointer-events-none">
                <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/40 px-2.5 py-1 rounded-lg backdrop-blur-md pointer-events-auto">
                  <span className="text-reliance-cyan font-bold">TAG: </span>
                  <span className="text-white">{data.tag}</span>
                </div>
                <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/40 px-2.5 py-1 rounded-lg backdrop-blur-md text-emerald-400 font-bold pointer-events-auto">
                  <span>DEPTH: {data.depth}</span>
                </div>
              </div>

              {/* Interactive 360 Orbit & Zoom Control Dock (Top-Right Floating) */}
              <div className="absolute top-12 right-3 z-20 flex flex-col gap-1.5 font-mono text-[10px]">
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-dock backdrop-blur-md ${
                    autoRotate
                      ? 'bg-reliance-cyan/30 border-reliance-cyan text-white shadow-cyan-glow font-bold'
                      : 'bg-black/70 border-white/20 text-white/70 hover:text-white hover:border-reliance-cyan'
                  }`}
                  title="Toggle 360° Auto-Rotation"
                >
                  <span>🔄 360° ROTATE</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${autoRotate ? 'bg-emerald-400 animate-ping' : 'bg-white/30'}`} />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleZoomIn}
                    className="flex-1 py-1 px-2 rounded-lg bg-black/75 hover:bg-reliance-blue/60 border border-reliance-cyan/40 text-white font-bold transition-all cursor-pointer text-center"
                    title="Zoom In (+)"
                  >
                    🔍 +
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="flex-1 py-1 px-2 rounded-lg bg-black/75 hover:bg-reliance-blue/60 border border-reliance-cyan/40 text-white font-bold transition-all cursor-pointer text-center"
                    title="Zoom Out (-)"
                  >
                    🔍 -
                  </button>
                  <button
                    onClick={handleResetView}
                    className="py-1 px-2 rounded-lg bg-black/75 hover:bg-reliance-blue/60 border border-reliance-cyan/40 text-reliance-cyan font-bold transition-all cursor-pointer"
                    title="Reset Center View"
                  >
                    🎯 RESET
                  </button>
                </div>
              </div>

              {/* Bottom HUD Badges & 360 Navigation Tip */}
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[9px] font-mono text-reliance-cyan/90 bg-reliance-deepnavy/85 p-2 rounded-xl border border-reliance-cyan/20 gap-1 backdrop-blur-md">
                <span>SPEC: {data.spec}</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>🖱️ DRAG TO ROTATE 360° • SCROLL TO ZOOM</span>
                  <span>• 60 FPS</span>
                </span>
              </div>
            </div>

            {/* LaTeX Mathematical Formula */}
            <div className="p-3 rounded-2xl bg-reliance-navy/50 border border-reliance-cyan/25 font-mono text-xs">
              <div className="text-[10px] font-bold text-reliance-cyan uppercase tracking-wider mb-1">
                PHYSICS & GOVERNING EQUATIONS
              </div>
              <KaTeXBlock math={data.latex} />
            </div>
          </div>

          {/* Right 5 Cols: Live Engineering Telemetry & Controls (Hidden when Expanded 3D is active) */}
          {!isExpanded3D && (
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              {/* High-Resolution Diagnostic Engineering Schematic Card */}
              {data.image && (
                <div className="relative group overflow-hidden rounded-2xl bg-black/80 border border-reliance-cyan/40 shadow-dock shrink-0">
                  <div className="relative h-32 sm:h-36 w-full overflow-hidden bg-reliance-deepnavy/90">
                    <img
                      src={data.image}
                      alt={data.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-all duration-500 opacity-95"
                      onError={(e) => {
                        // Fallback if image fails
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    {/* High-Tech Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-reliance-deepnavy via-transparent to-reliance-deepnavy/30 pointer-events-none" />

                    {/* Corner Reticle Accents */}
                    <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-reliance-cyan" />
                    <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 border-reliance-cyan" />
                    <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 border-reliance-cyan" />
                    <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-reliance-cyan" />

                    {/* Subsystem Schematic Floating Badge */}
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 font-mono text-[9px] bg-black/85 px-2 py-0.5 rounded border border-reliance-cyan/40 text-reliance-cyan backdrop-blur-md">
                      <Scan className="w-3 h-3 animate-pulse" />
                      <span>SCHEMATIC BLUEPRINT</span>
                    </div>

                    {/* Operational Health Badge */}
                    <div className="absolute top-2 right-2 z-10 font-mono text-[9px] bg-emerald-950/85 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/40 backdrop-blur-md font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>HEALTH: 100% NOMINAL</span>
                    </div>

                    {/* Bottom Schematic Title Bar */}
                    <div className="absolute bottom-1.5 left-2 right-2 z-10 flex items-center justify-between font-mono text-[10px] bg-reliance-deepnavy/90 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-md">
                      <span className="text-white font-extrabold truncate">{data.tag}</span>
                      <span className="text-reliance-cyan text-[9px] font-semibold truncate ml-1">{data.category}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 6 Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5 font-mono">
                {data.metrics.map((m, idx) => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-reliance-navy/60 border border-reliance-cyan/30 flex flex-col justify-between shadow-dock hover:border-reliance-cyan transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] text-reliance-textMuted mb-1">
                        <span className="truncate">{m.label}</span>
                        <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                      </div>
                      <div className={`text-sm sm:text-base font-extrabold ${m.color}`}>
                        {m.val}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 font-mono text-xs">
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="w-full py-2.5 px-4 rounded-xl bg-reliance-blue hover:bg-reliance-blue/80 border border-reliance-cyan text-white font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-cyan-glow"
                >
                  <Scan className={`w-4 h-4 text-reliance-cyan ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'TRANSDUCER SWEEP ACTIVE...' : 'ULTRASONIC NDT SCAN'}</span>
                </button>

                <button
                  onClick={() => {
                    varunaVoice.speakCustom(`Playing active acoustic vibration harmonic for ${data.tag}.`);
                    varunaVoice.playSonarPing(440, 0.25);
                  }}
                  className="w-full py-2 px-4 rounded-xl bg-reliance-navy/60 hover:bg-reliance-navy border border-white/15 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>AUDIO HARMONIC FREQUENCY</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Horizontal Quick-Navigation Strip */}
        <div className="p-2.5 sm:p-3 border-t border-reliance-cyan/30 bg-reliance-deepnavy/95 shrink-0 overflow-x-auto flex items-center gap-1.5 font-mono text-xs scrollbar-none">
          <span className="text-[10px] text-reliance-textMuted font-bold uppercase tracking-widest mr-2 shrink-0">
            QUICK BOX:
          </span>
          {navTabs.map((tab) => {
            const isCur = activeHoloModal === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  openHoloModal(tab.id);
                  setCameraViewMode(tab.id as any);
                }}
                className={`px-2.5 py-1 rounded-lg shrink-0 text-[10px] font-extrabold border transition-all cursor-pointer ${
                  isCur
                    ? 'bg-reliance-cyan text-reliance-deepnavy border-white shadow-cyan-glow'
                    : 'bg-reliance-navy/60 text-white/80 border-white/10 hover:border-reliance-cyan/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
