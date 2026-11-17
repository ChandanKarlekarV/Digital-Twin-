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
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { KaTeXBlock } from '../common/KaTeXBlock';
import { rigModelCache, RigPart, COMPONENT_TO_PART, DEFAULT_RIG_URL } from '../../services/RigModelCache';
import { createHolographicMaterial } from '../../shaders/HolographicMaterial';
import { HOLO, holoMaterial } from '../../shaders/HoloPalette';

interface HoloRigSectionProps {
  type: HolographicComponentType;
  autoRotate: boolean;
  orbitControlsRef: React.RefObject<any>;
}

const MODEL_SCALE = 45.0;

/**
 * Dedicated part view: only the selected sub-assembly of the real model is shown, centred
 * and auto-framed, as a cyan hologram inside a scan cage sized to the part. Pipes (which are
 * not part of the model mesh) are shown as a cut-away pipe spool.
 */
const HoloRigCroppedSection: React.FC<HoloRigSectionProps> = ({ type, autoRotate, orbitControlsRef }) => {
  const customObjUrl = useRigStore((s) => s.customObjUrl || DEFAULT_RIG_URL);
  const [part, setPart] = useState<RigPart | null>(null);
  const pipeFluidMeshRef = useRef<THREE.Mesh>(null);
  const laserRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const isPipe = type.startsWith('pipe');
  const partId = COMPONENT_TO_PART[type];

  useEffect(() => {
    if (isPipe || !partId) return;
    let cancelled = false;
    rigModelCache.preload(customObjUrl).then(() => {
      if (!cancelled) setPart(rigModelCache.getPart(customObjUrl, partId));
    });
    return () => {
      cancelled = true;
    };
  }, [customObjUrl, partId, isPipe]);

  const material = useMemo(
    () => createHolographicMaterial({ baseColor: '#000000', glowColor: HOLO.primary, opacity: 0.6, scanlineFreq: 1.4, glowIntensity: 1.4 }),
    []
  );
  // Solid lit body + rim glow + crisp edges: stays sharp when zoomed in
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0B2A3A',
        emissive: '#03141D',
        roughness: 0.55,
        metalness: 0.35,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    []
  );
  const edgeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: HOLO.primary, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );
  const wireMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: HOLO.primary, wireframe: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
    []
  );

  // World-space size of the part (model is rotated -90° about Y, so X/Z swap)
  const frame = useMemo(() => {
    if (isPipe) return { size: new THREE.Vector3(5, 16.5, 5), center: new THREE.Vector3() };
    const box = part?.geometry.boundingBox;
    if (!box) return null;
    const s = box.getSize(new THREE.Vector3()).multiplyScalar(MODEL_SCALE);
    return { size: new THREE.Vector3(s.z, s.y, s.x), center: box.getCenter(new THREE.Vector3()) };
  }, [part, isPipe]);

  // Auto-fit the camera to the part
  useEffect(() => {
    if (!frame) return;
    const radius = frame.size.length() / 2;
    const dist = radius * 2.1 + 2;
    camera.position.set(dist * 0.62, dist * 0.42, dist * 0.66);
    camera.lookAt(0, 0, 0);
    if (orbitControlsRef.current) {
      orbitControlsRef.current.target.set(0, 0, 0);
      orbitControlsRef.current.maxDistance = dist * 3;
      orbitControlsRef.current.update();
      orbitControlsRef.current.saveState?.();
    }
  }, [frame, camera, orbitControlsRef]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    if (laserRef.current && frame) laserRef.current.position.y = Math.sin(t * 1.6) * (frame.size.y / 2);
    if (pipeFluidMeshRef.current) pipeFluidMeshRef.current.rotation.y = t * 1.5;
  });

  return (
    <group>
      {isPipe ? (
        <group>
          {/* Pipe wall cage */}
          <mesh material={holoMaterial({ color: HOLO.primary, opacity: 0.4, wireframe: true })}>
            <cylinderGeometry args={[2.0, 2.0, 16.0, 36, 18, true]} />
          </mesh>
          {/* Multiphase core */}
          <mesh ref={pipeFluidMeshRef} material={holoMaterial({ color: HOLO.mid, opacity: 0.45 })}>
            <cylinderGeometry args={[1.5, 1.5, 15.8, 28, 1]} />
          </mesh>
          {/* Flanges */}
          {[-6.5, -3.2, 0, 3.2, 6.5].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={holoMaterial({ color: HOLO.hot, opacity: 0.8 })}>
              <torusGeometry args={[2.3, 0.18, 12, 48]} />
            </mesh>
          ))}
          {/* Fibre-optic strain line */}
          <mesh position={[2.05, 0, 0]} material={holoMaterial({ color: HOLO.hot, opacity: 0.95 })}>
            <cylinderGeometry args={[0.06, 0.06, 16.0, 8]} />
          </mesh>
        </group>
      ) : (
        part &&
        frame && (
          <group scale={MODEL_SCALE} rotation={[0, -Math.PI / 2, 0]}>
            <group position={[-frame.center.x, -frame.center.y, -frame.center.z]}>
              <mesh geometry={part.geometry} material={bodyMaterial} />
              <mesh geometry={part.geometry} material={material} />
              {part.edges ? (
                <lineSegments geometry={part.edges} material={edgeMaterial} />
              ) : (
                <mesh geometry={part.geometry} material={wireMaterial} />
              )}
            </group>
          </group>
        )
      )}

      {/* Scan cage sized to the part + sweeping scan plane */}
      {frame && (
        <group>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(frame.size.x * 1.08, frame.size.y * 1.08, frame.size.z * 1.08)]} />
            <lineBasicMaterial color={HOLO.primary} transparent opacity={0.6} />
          </lineSegments>
          <mesh ref={laserRef} rotation={[-Math.PI / 2, 0, 0]} material={holoMaterial({ color: HOLO.primary, opacity: 0.12 })}>
            <planeGeometry args={[frame.size.x * 1.06, frame.size.z * 1.06]} />
          </mesh>
        </group>
      )}

      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        enableRotate
        enableZoom
        enablePan
        autoRotate={autoRotate}
        autoRotateSpeed={1.8}
        minDistance={1.0}
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
      <div className="relative w-full max-w-6xl h-[92vh] glass-panel border border-reliance-cyan/50 bg-reliance-deepnavy/98 rounded-3xl shadow-cyan-glow flex flex-col overflow-hidden text-white font-sans">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-reliance-cyan/30 bg-reliance-blue/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/40 animate-pulse">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-reliance-cyan bg-reliance-cyan/20 px-2 py-0.5 rounded border border-reliance-cyan/40">
                  VARUNA HOLOGRAPHIC 3D DIAGNOSTICS
                </span>
                <span className="text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
                  DEDICATED PART VIEW • 360° ORBIT
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
                <Canvas camera={{ position: [0, 0, 18], fov: 45, near: 0.1, far: 2000 }} dpr={[1, 2]}>
                  <ambientLight intensity={0.35} color={HOLO.primary} />
                  <hemisphereLight args={['#9FEFFF', '#02101A', 0.6]} />
                  <directionalLight position={[30, 60, 20]} intensity={2.2} color="#E6FBFF" />
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
                <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/40 px-2.5 py-1 rounded-lg backdrop-blur-md text-cyan-200 font-bold pointer-events-auto">
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
                  <span className={`w-1.5 h-1.5 rounded-full ${autoRotate ? 'bg-cyan-300 animate-ping' : 'bg-white/30'}`} />
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
                <span className="text-cyan-300 font-bold flex items-center gap-1">
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
                        <Icon className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-cyan-100">
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
