import React, { useState, useRef, useEffect } from 'react';
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
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { KaTeXBlock } from '../common/KaTeXBlock';

// 3D Mini Holographic Mesh Previews inside the modal
const Holo3DPreview: React.FC<{ type: HolographicComponentType }> = ({ type }) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.85;
      meshRef.current.rotation.x = Math.sin(performance.now() * 0.001) * 0.15;
    }
  });

  return (
    <group ref={meshRef}>
      {/* Dynamic geometry based on component type */}
      {type.startsWith('pipe') && (
        <group>
          {/* Outer wireframe pipe cylinder */}
          <mesh>
            <cylinderGeometry args={[1.4, 1.4, 6.5, 32, 8, true]} />
            <meshBasicMaterial color="#00E5FF" wireframe transparent opacity={0.6} />
          </mesh>
          {/* Inner glowing fluid core */}
          <mesh>
            <cylinderGeometry args={[1.0, 1.0, 6.4, 24, 1]} />
            <meshStandardMaterial
              color="#FFA500"
              emissive="#FF6600"
              emissiveIntensity={1.8}
              transparent
              opacity={0.8}
            />
          </mesh>
          {/* Flange Rings */}
          <mesh position={[0, 3.2, 0]}>
            <torusGeometry args={[1.6, 0.15, 16, 32]} />
            <meshBasicMaterial color="#00FFFF" />
          </mesh>
          <mesh position={[0, -3.2, 0]}>
            <torusGeometry args={[1.6, 0.15, 16, 32]} />
            <meshBasicMaterial color="#00FFFF" />
          </mesh>
        </group>
      )}

      {type === 'drill' && (
        <group>
          {/* Drill string shaft */}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 4.0, 24]} />
            <meshBasicMaterial color="#00FFFF" wireframe />
          </mesh>
          {/* PDC Diamond Drill Bit Cone */}
          <mesh position={[0, -1.5, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[1.5, 2.5, 8, 4]} />
            <meshBasicMaterial color="#FF6D00" wireframe transparent opacity={0.85} />
          </mesh>
          {/* Rotary stabilization blades */}
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[2.2, 0.4, 0.4]} />
            <meshBasicMaterial color="#00FF88" />
          </mesh>
        </group>
      )}

      {type === 'motor' && (
        <group>
          {/* Motor Body Cylinder */}
          <mesh>
            <cylinderGeometry args={[1.6, 1.6, 4.2, 32]} />
            <meshBasicMaterial color="#38BDF8" wireframe transparent opacity={0.7} />
          </mesh>
          {/* Cooling Fins */}
          <mesh>
            <boxGeometry args={[3.6, 3.6, 0.2]} />
            <meshBasicMaterial color="#00E5FF" wireframe />
          </mesh>
          {/* Drive Shaft */}
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 1.5, 16]} />
            <meshBasicMaterial color="#FFB703" />
          </mesh>
        </group>
      )}

      {type === 'helipad' && (
        <group rotation={[Math.PI / 6, 0, 0]}>
          {/* Octagonal Helideck Landing Surface */}
          <mesh>
            <cylinderGeometry args={[3.2, 3.2, 0.3, 8]} />
            <meshBasicMaterial color="#FACC15" wireframe transparent opacity={0.7} />
          </mesh>
          {/* Outer Perimeter Safety Ring */}
          <mesh>
            <torusGeometry args={[3.6, 0.1, 16, 32]} />
            <meshBasicMaterial color="#00FF88" />
          </mesh>
          {/* Helipad 'H' Marker */}
          <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.6, 1.8, 32]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      )}

      {type === 'crane1' || type === 'crane2' ? (
        <group rotation={[0, 0, -Math.PI / 8]}>
          {/* Pedestal Base */}
          <mesh position={[0, -1.5, 0]}>
            <cylinderGeometry args={[1.2, 1.4, 1.8, 16]} />
            <meshBasicMaterial color="#FF6D00" wireframe />
          </mesh>
          {/* Crane Boom Lattice */}
          <mesh position={[1.8, 1.2, 0]} rotation={[0, 0, -Math.PI / 3]}>
            <boxGeometry args={[0.6, 5.5, 0.6]} />
            <meshBasicMaterial color="#FF9100" wireframe />
          </mesh>
          {/* Hoist Line */}
          <mesh position={[3.2, -0.5, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 3.0, 8]} />
            <meshBasicMaterial color="#00FFFF" />
          </mesh>
        </group>
      ) : null}

      {type === 'upper_rig' && (
        <group>
          {/* Lattice Derrick Mast Pyramidal Tower */}
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.8, 2.4, 5.0, 4, 6]} />
            <meshBasicMaterial color="#00F5D4" wireframe transparent opacity={0.75} />
          </mesh>
          {/* Topside Deck Platform */}
          <mesh position={[0, -1.8, 0]}>
            <boxGeometry args={[5.2, 0.6, 5.2]} />
            <meshBasicMaterial color="#00B4D8" wireframe />
          </mesh>
          {/* Quarters Block */}
          <mesh position={[1.6, -1.0, 1.6]}>
            <boxGeometry args={[1.8, 1.2, 1.8]} />
            <meshBasicMaterial color="#38BDF8" wireframe />
          </mesh>
        </group>
      )}

      {(type.startsWith('well') || type === 'wells1_7') && (
        <group>
          {/* Subsea Christmas Tree Guide Base */}
          <mesh position={[0, -1.8, 0]}>
            <boxGeometry args={[3.2, 0.6, 3.2]} />
            <meshBasicMaterial color="#A855F7" wireframe />
          </mesh>
          {/* Valve Block Spool */}
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[1.0, 1.2, 2.2, 16]} />
            <meshBasicMaterial color="#C084FC" wireframe transparent opacity={0.7} />
          </mesh>
          {/* Hydraulic Master Valve Actuators */}
          <mesh position={[1.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.4, 0.4, 1.2, 12]} />
            <meshBasicMaterial color="#00FFFF" />
          </mesh>
          <mesh position={[-1.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.4, 0.4, 1.2, 12]} />
            <meshBasicMaterial color="#00FFFF" />
          </mesh>
          {/* Riser Re-entry Mandrel */}
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 1.4, 16]} />
            <meshBasicMaterial color="#00FF88" />
          </mesh>
        </group>
      )}
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

  if (!activeHoloModal) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-reliance-dark/90 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] glass-panel-alert border-2 border-reliance-cyan/60 bg-reliance-deepnavy/98 rounded-3xl shadow-cyan-glow flex flex-col overflow-hidden text-white font-sans">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-reliance-cyan/30 bg-reliance-blue/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/40 animate-pulse">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-reliance-cyan bg-reliance-cyan/20 px-2 py-0.5 rounded border border-reliance-cyan/40">
                  JARVIS HOLOGRAPHIC DIAGNOSTICS
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE TELEMETRY SYNC
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5 font-mono">
                {data.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto">
          {/* Left 7 Cols: 3D Holographic Interactive Rotating Canvas */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="relative flex-1 min-h-[280px] rounded-2xl bg-black/70 border border-reliance-cyan/40 p-4 flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Holographic Grid Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ffff0d_1px,transparent_1px),linear-gradient(to_bottom,#00ffff0d_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* 3D Canvas Rendering */}
              <div className="absolute inset-0">
                <Canvas camera={{ position: [0, 0, 7.5], fov: 45 }}>
                  <ambientLight intensity={1.2} />
                  <pointLight position={[10, 10, 10]} intensity={2.5} color="#00ffff" />
                  <pointLight position={[-10, -10, -10]} intensity={1.5} color="#ff6600" />
                  <Holo3DPreview type={activeHoloModal} />
                </Canvas>
              </div>

              {/* Top HUD Badges */}
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono">
                <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/40 px-2.5 py-1 rounded-lg backdrop-blur-md">
                  <span className="text-reliance-cyan font-bold">TAG: </span>
                  <span className="text-white">{data.tag}</span>
                </div>
                <div className="bg-reliance-deepnavy/90 border border-reliance-cyan/40 px-2.5 py-1 rounded-lg backdrop-blur-md text-emerald-400 font-bold">
                  <span>DEPTH: {data.depth}</span>
                </div>
              </div>

              {/* Bottom HUD Badges */}
              <div className="relative z-10 flex items-center justify-between text-[9px] font-mono text-reliance-cyan/80 bg-reliance-deepnavy/80 p-2 rounded-xl border border-reliance-cyan/20">
                <span>SPEC: {data.spec}</span>
                <span className="text-emerald-400 font-bold">● 60 FPS HOLOGRAPHIC MATRIX</span>
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

          {/* Right 5 Cols: Live Engineering Telemetry & Controls */}
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
        </div>

        {/* Bottom Horizontal Quick-Navigation Strip */}
        <div className="p-3 border-t border-reliance-cyan/30 bg-reliance-deepnavy/95 shrink-0 overflow-x-auto flex items-center gap-1.5 font-mono text-xs">
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
