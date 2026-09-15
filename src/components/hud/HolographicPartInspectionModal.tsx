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
 * 3D Model Section Cropper
 * Uses the user's REAL rig model (untitled.obj) cropped/focused directly on each subsystem:
 * - Helipad, Cranes 1 & 2, Upper Rig Derrick, Drill, Motor, Subsea Manifold & Wells
 */
const HoloRigCroppedSection: React.FC<HoloRigSectionProps> = ({ type, autoRotate, orbitControlsRef }) => {
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);
  const customObjUrl = useRigStore((s) => s.customObjUrl || '/models/untitled.obj');
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  const MODEL_SCALE = 45.0;
  const WATER_LINE_OBJ_Y = -0.22;

  // Compute focal target and initial camera offset for each section
  const sectionConfig = useMemo(() => {
    switch (type) {
      case 'helipad':
        return {
          focalOffset: new THREE.Vector3(5.4, 25.5, -22.5),
          camPos: new THREE.Vector3(12, 32, -12),
          targetBounds: [14, 8, 14] as [number, number, number],
          camDistance: 16,
          label: 'CAP 437 HELIDECK SECTION',
          wireColor: '#FACC15',
        };
      case 'crane1':
        return {
          focalOffset: new THREE.Vector3(-14, 18, 0),
          camPos: new THREE.Vector3(-28, 26, 12),
          targetBounds: [12, 18, 12] as [number, number, number],
          camDistance: 18,
          label: 'PORT CRANE 1 PEDESTAL SECTION',
          wireColor: '#FF6D00',
        };
      case 'crane2':
        return {
          focalOffset: new THREE.Vector3(14, 18, 0),
          camPos: new THREE.Vector3(28, 26, 12),
          targetBounds: [12, 18, 12] as [number, number, number],
          camDistance: 18,
          label: 'STARBOARD CRANE 2 SECTION',
          wireColor: '#FF9100',
        };
      case 'upper_rig':
        return {
          focalOffset: new THREE.Vector3(0, 22, 0),
          camPos: new THREE.Vector3(0, 30, 24),
          targetBounds: [18, 24, 18] as [number, number, number],
          camDistance: 24,
          label: 'TOPSIDE DERRICK MAST SECTION',
          wireColor: '#00F5D4',
        };
      case 'motor':
        return {
          focalOffset: new THREE.Vector3(0, 16, 0),
          camPos: new THREE.Vector3(6, 20, 10),
          targetBounds: [10, 10, 10] as [number, number, number],
          camDistance: 12,
          label: '1,200 HP TOP DRIVE MOTOR SECTION',
          wireColor: '#38BDF8',
        };
      case 'drill':
        return {
          focalOffset: new THREE.Vector3(0, -6, 0),
          camPos: new THREE.Vector3(10, 2, 16),
          targetBounds: [12, 35, 12] as [number, number, number],
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
          focalOffset: new THREE.Vector3(0, -16.4, 0),
          camPos: new THREE.Vector3(12, -8, 16),
          targetBounds: [20, 12, 20] as [number, number, number],
          camDistance: 20,
          label: 'SUBSEA WELLHEAD & MANIFOLD SECTION',
          wireColor: '#A855F7',
        };
      default: // pipe1 to pipe9
        return {
          focalOffset: new THREE.Vector3(0, -10, 0),
          camPos: new THREE.Vector3(12, -2, 18),
          targetBounds: [14, 28, 14] as [number, number, number],
          camDistance: 20,
          label: `SUBSEA PIPE ${type.replace('pipe', '')} CATENARY SECTION`,
          wireColor: '#00E5FF',
        };
    }
  }, [type]);

  // Load and style the actual model
  useEffect(() => {
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

      // Apply signature holographic wireframe + glowing shader materials
      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const name = mesh.name || '';

          if (name === 'pCube2') {
            mesh.visible = false;
          } else if (name === 'model_Mesh') {
            mesh.material = new THREE.MeshStandardMaterial({
              color: '#005588',
              emissive: '#00E5FF',
              emissiveIntensity: 0.8,
              wireframe: true,
              transparent: true,
              opacity: 0.65,
              side: THREE.DoubleSide,
            });
          } else if (name === 'model1_Mesh') {
            mesh.material = new THREE.MeshStandardMaterial({
              color: '#00FFAA',
              emissive: '#00E5FF',
              emissiveIntensity: 1.2,
              wireframe: true,
              transparent: true,
              opacity: 0.85,
              side: THREE.DoubleSide,
            });
          } else {
            // modelfinal_Mesh: Topside deck, cranes, helipad, derrick
            mesh.material = new THREE.MeshStandardMaterial({
              color: '#003366',
              emissive: '#00FFFF',
              emissiveIntensity: 0.9,
              wireframe: true,
              transparent: true,
              opacity: 0.75,
              side: THREE.DoubleSide,
            });
          }
        }
      });

      setModelGroup(cloned);
    });
  }, [customObjUrl]);

  // Set camera view centered on this section
  useEffect(() => {
    camera.position.set(
      sectionConfig.camPos.x - sectionConfig.focalOffset.x,
      sectionConfig.camPos.y - sectionConfig.focalOffset.y,
      sectionConfig.camPos.z - sectionConfig.focalOffset.z
    );
    camera.lookAt(0, 0, 0);
    if (orbitControlsRef.current) {
      orbitControlsRef.current.target.set(0, 0, 0);
      orbitControlsRef.current.update();
    }
  }, [sectionConfig, camera, orbitControlsRef]);

  // Gentle laser scanning beam animation
  const laserRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (laserRef.current) {
      const halfH = sectionConfig.targetBounds[1] / 2;
      laserRef.current.position.y = Math.sin(t * 2.5) * halfH;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Centered Model Section: Shifted so focalOffset is precisely at origin [0, 0, 0] */}
      {modelGroup && (
        <group
          position={[
            -sectionConfig.focalOffset.x,
            -sectionConfig.focalOffset.y,
            -sectionConfig.focalOffset.z,
          ]}
        >
          <primitive object={modelGroup} />
        </group>
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
            opacity={0.65}
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
            opacity={0.15}
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

    // 2. DRILL
    if (type === 'drill') {
      return {
        title: 'ROTARY DRILL STRING & PDC DIAMOND BIT ASSEMBLY',
        tag: 'DRILL-SYSTEM-D6',
        category: 'ROTARY DRILLING CORE',
        spec: '8-1/2" Matrix Body PDC Bit • 5-7/8" S-135 Drill Pipe',
        depth: '-2,040m Target Reservoir Depth',
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

    // 3. MOTOR
    if (type === 'motor') {
      return {
        title: '1,200 HP TOP DRIVE INDUCTION MOTOR & MUD PUMP VFD',
        tag: 'MOTOR-VFD-1200HP',
        category: 'POWER & ROTARY DRIVE',
        spec: '4,160V 3-Phase AC Induction • Siemens MasterDrive VFD',
        depth: 'Topside Rig Mezzanine Deck (+12m)',
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

    // 4. HELIPAD
    if (type === 'helipad') {
      return {
        title: 'CAP 437 OFFSHORE HELIDECK & AVIATION PLATFORM',
        tag: 'HELIDECK-D6-ALPHA',
        category: 'OFFSHORE AVIATION',
        spec: 'D-Value: 22.2m • Max Landing Weight: 12.8 MT',
        depth: 'Topside Cantilever Deck (+38m ASL)',
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

    // 5. CRANE 1
    if (type === 'crane1') {
      return {
        title: 'HEAVY-LIFT ELECTRO-HYDRAULIC PEDESTAL CRANE 1 (PORT)',
        tag: 'CRANE-PORT-65T',
        category: 'OFFSHORE MATERIAL HANDLING',
        spec: '65 MT SWL at 18m Radius • 42m Lattice Boom',
        depth: 'Topside Main Deck (+18m ASL)',
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

    // 6. CRANE 2
    if (type === 'crane2') {
      return {
        title: 'AUXILIARY SUPPLY DECK CRANE 2 (STARBOARD)',
        tag: 'CRANE-STBD-30T',
        category: 'OFFSHORE MATERIAL HANDLING',
        spec: '30 MT SWL at 12m Radius • 28m Box Girder Boom',
        depth: 'Topside Starboard Mezzanine (+16m ASL)',
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

    // 7. UPPER RIG
    if (type === 'upper_rig') {
      return {
        title: 'TOPSIDE DERRICK MAST, PRODUCTION PROCESS & LIVING QUARTERS',
        tag: 'TOPSIDE-STRUCTURE',
        category: 'SURFACE PRODUCTION FACILITY',
        spec: 'Semi-Submersible Hub • 18,400 MT Total Operating Load',
        depth: 'Surface to +65m Derrick Apex',
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

    // 8. WELLS 1-7
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
    { id: 'drill', label: 'Drill' },
    { id: 'motor', label: 'Motor' },
    { id: 'helipad', label: 'Helipad' },
    { id: 'crane1', label: 'Crane 1' },
    { id: 'crane2', label: 'Crane 2' },
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
