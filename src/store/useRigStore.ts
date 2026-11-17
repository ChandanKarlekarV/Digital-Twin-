import { create } from 'zustand';
import {
  parseVoiceCommand,
  normalizeTranscript,
  stripWakeWord,
  WAKE_WORD_REGEX,
  VOICE_HELP_TEXT,
} from '../voice/VoiceCommandParser';

export type CameraViewMode =
  | 'topside'
  | 'subsea'
  | 'manifold'
  | 'riser'
  | 'free'
  | 'pipe1'
  | 'pipe2'
  | 'pipe3'
  | 'pipe4'
  | 'pipe5'
  | 'pipe6'
  | 'pipe7'
  | 'pipe8'
  | 'pipe9'
  | 'pipe1_slice'
  | 'drill'
  | 'drill_string'
  | 'drill_bit'
  | 'motor'
  | 'helipad'
  | 'crane1'
  | 'crane2'
  | 'accommodation'
  | 'industrial_pipes'
  | 'jackup_legs'
  | 'main_deck'
  | 'upper_rig'
  | 'well1'
  | 'well2'
  | 'well3'
  | 'well4'
  | 'well5'
  | 'well6'
  | 'well7'
  | 'wells1_7'
  | 'command_dock'
  | 'split'
  | 'part_detail';

export type HolographicComponentType =
  | 'pipe1'
  | 'pipe2'
  | 'pipe3'
  | 'pipe4'
  | 'pipe5'
  | 'pipe6'
  | 'pipe7'
  | 'pipe8'
  | 'pipe9'
  | 'drill'
  | 'drill_string'
  | 'drill_bit'
  | 'motor'
  | 'helipad'
  | 'crane1'
  | 'crane2'
  | 'accommodation'
  | 'industrial_pipes'
  | 'jackup_legs'
  | 'main_deck'
  | 'upper_rig'
  | 'well1'
  | 'well2'
  | 'well3'
  | 'well4'
  | 'well5'
  | 'well6'
  | 'well7'
  | 'wells1_7'
  | 'command_dock';
export type ScannerMode = 'realistic' | 'normal' | 'thermal' | 'acoustic' | 'gamma' | 'hologram';
export type MetoceanCondition = 'calm' | 'monsoon' | 'cyclonic';

export type RecognizedGesture =
  | 'PALM'
  | 'PINCH'
  | 'SPLIT'
  | 'MERGE'
  | 'MOVE'
  | 'ZOOM_IN'
  | 'ZOOM_OUT'
  | 'INDEX_1'
  | 'INDEX_2'
  | 'INDEX_3'
  | 'INDEX_4'
  | 'INDEX_5'
  | 'SLICE'
  | 'POINT'
  | 'SWIPE_LEFT'
  | 'SWIPE_RIGHT'
  | 'FIST'
  | null;

export interface GestureSpatialState {
  deltaX: number;
  deltaY: number;
  zoomDelta: number;
  distance: number;
  handsCount: number;
  primaryHand: {
    x: number;
    y: number;
    fingerCount: number;
    isPinching?: boolean;
    pinchDist?: number;
    role?: 'ZOOM' | 'ORBIT' | 'IDLE';
  } | null;
  secondaryHand: {
    x: number;
    y: number;
    fingerCount: number;
    isPinching?: boolean;
    pinchDist?: number;
    role?: 'ZOOM' | 'ORBIT' | 'IDLE';
  } | null;
  activeMode:
    | 'JARVIS_DECOUPLED_DUAL'
    | 'DUAL_MOVE_ZOOM'
    | 'ORBIT'
    | 'ZOOM'
    | 'SPLIT'
    | 'MERGE'
    | 'INDEX_SELECT'
    | 'IDLE';
}
export type EmergencyScenario =
  | 'none'
  | 'rupture'
  | 'stuck_drill'
  | 'hydrate_plug'
  | 'pipe_blockage'
  | 'drill_damage'
  | 'oil_overload'
  | 'weather_squall';

export type IncidentPhase = 1 | 2 | 3 | 4;

export interface IncidentMetadata {
  id: EmergencyScenario;
  title: string;
  shortLabel: string;
  category: 'flowline' | 'drilling' | 'topside' | 'metocean' | 'wellhead';
  targetAssetId: string;
  primaryRisk: string;
  phases: {
    [key in IncidentPhase]: {
      label: string;
      description: string;
      actionRecommended: string;
      tacticalVoiceAlert: string;
    };
  };
}

export const INCIDENT_SCENARIOS_CATALOG: Record<EmergencyScenario, IncidentMetadata> = {
  none: {
    id: 'none',
    title: 'Nominal Subsea Operations',
    shortLabel: 'ALL NOMINAL',
    category: 'flowline',
    targetAssetId: 'MANIFOLD-D6-MAIN',
    primaryRisk: 'Zero Active Failures',
    phases: {
      1: {
        label: 'Baseline Monitoring',
        description: 'All 7 deepwater assets within safe operating envelope.',
        actionRecommended: 'Maintain autonomous 10 Hz telemetry polling.',
        tacticalVoiceAlert: 'All subsea telemetry nominal. Operating envelope verified.',
      },
      2: { label: 'Baseline', description: 'Nominal', actionRecommended: 'None', tacticalVoiceAlert: 'Nominal.' },
      3: { label: 'Baseline', description: 'Nominal', actionRecommended: 'None', tacticalVoiceAlert: 'Nominal.' },
      4: { label: 'Baseline', description: 'Nominal', actionRecommended: 'None', tacticalVoiceAlert: 'Nominal.' },
    },
  },
  pipe_blockage: {
    id: 'pipe_blockage',
    title: 'Severe Oil Flow Congestion & Paraffin Wax / Hydrate Blockage',
    shortLabel: 'PIPE CONGESTION',
    category: 'flowline',
    targetAssetId: 'MANIFOLD-D6-MAIN',
    primaryRisk: 'Rapid ΔP backpressure spike, flow starvation, upstream pipe overpressure rupture',
    phases: {
      1: {
        label: 'Phase 1: Incipient Wax/Hydrate Deposition',
        description: 'Viscous boundary layer thickening detected. ΔP differential begins creeping (+8 bar). Flow velocity decreases by 12%.',
        actionRecommended: 'Initiate continuous DTS thermal scanning and prepare chemical injection skid.',
        tacticalVoiceAlert: 'Warning. Subsea pipeline flow constriction detected at Gathering Header. Viscous drag increasing.',
      },
      2: {
        label: 'Phase 2: Flow Choking & Slugging Acceleration',
        description: 'Effective hydraulic diameter reduced by 55%. Differential ΔP surges to +28 bar. Multiphase slugging observed.',
        actionRecommended: 'Throttle topside choke to 40%. Prime subsea MEG (methanol) injection pumps.',
        tacticalVoiceAlert: 'Caution. Severe flow choking in subsea pipeline. Manifold differential pressure exceeding operating threshold.',
      },
      3: {
        label: 'Phase 3: Critical Flowline Occlusion (ESD Trip)',
        description: 'Near-total solid blockage. Differential ΔP reaches critical +62 bar. Downstream flow drops below cutoff.',
        actionRecommended: 'Emergency automated SSIV closure. Maximum rate MEG dosing injected into blocked section.',
        tacticalVoiceAlert: 'Emergency Shutdown. Total pipe blockage detected. Downstream starvation. Initiating automated MEG injection.',
      },
      4: {
        label: 'Phase 4: Chemical Remediation & Controlled Depressurization',
        description: 'Hydrate dissociation in progress. Differential pressure returning to safe margin (+6 bar).',
        actionRecommended: 'Gradually reopen SSIV actuator. Resume standard gathering protocol.',
        tacticalVoiceAlert: 'Remediation successful. Hydrate plug dissociated. Line pressure stabilizing toward nominal.',
      },
    },
  },
  drill_damage: {
    id: 'drill_damage',
    title: 'Drillstring Damage, Diamond Cutter Shearing & Downhole Jam',
    shortLabel: 'DRILL DAMAGE',
    category: 'drilling',
    targetAssetId: 'DRILL-SYSTEM',
    primaryRisk: 'Downhole drill bit shearing, drill pipe twist-off, severe borehole casing wall damage',
    phases: {
      1: {
        label: 'Phase 1: High-Frequency Torsional Oscillation',
        description: 'Stick-slip torsional vibrations detected. Downhole torque oscillates ±14 kNm. Bit tooth wear index elevated.',
        actionRecommended: 'Reduce top-drive rotary speed from 120 RPM to 80 RPM. Monitor WOB (Weight on Bit).',
        tacticalVoiceAlert: 'Warning. Stick-slip downhole torsional oscillation detected on rotary drillstring.',
      },
      2: {
        label: 'Phase 2: Drill Bit Cutter Degradation & Over-Torque',
        description: 'PDC diamond cutters sheared. Torque spikes to 46 kNm (>38 kNm limit). Standpipe pressure surges.',
        actionRecommended: 'Disengage top-drive auto-feed. Prepare emergency jar firing.',
        tacticalVoiceAlert: 'Caution. Downhole torque overload at 46 kilonewton-meters. Drill bit degradation critical.',
      },
      3: {
        label: 'Phase 3: Catastrophic Drill Jam & Motor Stall (ESD Trip)',
        description: 'Rotary drill core 100% stalled in bedrock borehole. Torsional shear stress at 94% yield strength.',
        actionRecommended: 'Automated top-drive power cutout executed. Hydraulic slips engaged to prevent pipe loss.',
        tacticalVoiceAlert: 'Emergency. Drill string mechanical jam. Top-drive auto-cutout executed to prevent pipe twist-off.',
      },
      4: {
        label: 'Phase 4: Torque Relief & Controlled Bit Extraction',
        description: 'Back-off torque applied. Drill string cleared from borehole obstruction.',
        actionRecommended: 'Inspect drill assembly via acoustic DAS. Replace damaged cutter head before spudding.',
        tacticalVoiceAlert: 'Drill string freed. Torque released. Rig floor secured for cutter head inspection.',
      },
    },
  },
  oil_overload: {
    id: 'oil_overload',
    title: 'Topside Separator Flooding & Multiphase Oil Overload Surge',
    shortLabel: 'OIL OVERLOAD',
    category: 'topside',
    targetAssetId: 'TOPSIDE-DRILL-RIG',
    primaryRisk: 'Separator vessel liquid level saturation (>95%), gas carry-under, flare header overpressure',
    phases: {
      1: {
        label: 'Phase 1: Reservoir Multiphase Surge Inflow',
        description: 'Production flow rate increases abruptly from 34,200 to 48,500 BPD. Separator vessel liquid level at 76%.',
        actionRecommended: 'Ramp secondary separation train. Monitor Coriolis MPFM density calibration.',
        tacticalVoiceAlert: 'Advisory. Multiphase reservoir surge detected. Gathering rate rising to 48,500 barrels per day.',
      },
      2: {
        label: 'Phase 2: Liquid Level Saturation & High Water-Cut Spike',
        description: 'Net production surges to 58,000 BPD. Water-cut spikes to 18.5%. First-stage separator vessel liquid level at 88%.',
        actionRecommended: 'Step down wellhead choke positions by 25%. Divert surplus crude to buffer tanks.',
        tacticalVoiceAlert: 'Warning. First stage separator liquid level approaching high-high limit. Water cut elevated.',
      },
      3: {
        label: 'Phase 3: High-High Level Trip & Safety Relief Lift (ESD Trip)',
        description: 'Separator vessel level exceeds 95%. Liquid carry-over into gas compressors detected. Pressure relief valve lifts.',
        actionRecommended: 'Automated platform ESD trip. Wellhead wing valves throttled to prevent environmental flare overfill.',
        tacticalVoiceAlert: 'Emergency Trip. Topside separator vessel flooding. Automated wellhead choke reduction engaged.',
      },
      4: {
        label: 'Phase 4: Vessel Degassing & Controlled Flow Normalization',
        description: 'Buffer storage absorption complete. Liquid levels normalized to 58%. Production stabilized at 36,000 BPD.',
        actionRecommended: 'Reset separator level alarms. Balance multi-train throughput.',
        tacticalVoiceAlert: 'Separator liquid levels restored to nominal. Topside process units stabilized.',
      },
    },
  },
  weather_squall: {
    id: 'weather_squall',
    title: 'Sudden Cyclonic Weather Squall & Extreme Metocean Tidal Shift',
    shortLabel: 'WEATHER SQUALL',
    category: 'metocean',
    targetAssetId: 'TOPSIDE-DRILL-RIG',
    primaryRisk: 'Significant wave height surge (8.8m), extreme hull hydrodynamic drag, mooring line tension breach',
    phases: {
      1: {
        label: 'Phase 1: Barometric Drop & Wind Bearing Rotation',
        description: 'Barometric pressure drops 18 hPa. Wind shifts rapidly from NE to SW with gusts reaching 42 kt.',
        actionRecommended: 'Engage platform dynamic positioning thrusters. Alert topside crane operators.',
        tacticalVoiceAlert: 'Metocean advisory. Sudden cyclonic squall inbound. Wind bearing shifting Southwest at 42 knots.',
      },
      2: {
        label: 'Phase 2: Significant Wave Height Surge & Tidal Current Drag',
        description: 'Wave height rises to 5.8m. Subsea current surges to 4.8 kt. Platform pitch/roll reaches ±3.5 degrees.',
        actionRecommended: 'Suspend crane lifts. Lower helipad windsocks and secure subsea deployment winches.',
        tacticalVoiceAlert: 'Caution. Metocean conditions deteriorating to Monsoon status. Wave heights climbing past 5.8 meters.',
      },
      3: {
        label: 'Phase 3: Cyclonic Sea State & Mooring Overload (ESD Trip)',
        description: 'Extreme wave heights peak at 8.8m. Current speed reaches 8.2 kt. Mooring line #3 tension reaches 82% MBL.',
        actionRecommended: 'Execute deepwater disconnect readiness. Ballast hull to storm draft (-21m).',
        tacticalVoiceAlert: 'Severe Weather Alert. Cyclonic conditions active. Wave heights 8.8 meters. Rig ballasted to storm draft.',
      },
      4: {
        label: 'Phase 4: Squall Dissipation & Subsea Hydrodynamic Stabilization',
        description: 'Wind speed easing to 18 kt. Significant wave height subsiding to 2.1m. Mooring tensions balanced.',
        actionRecommended: 'Perform subsea riser flex-joint visual inspection. Resume full production.',
        tacticalVoiceAlert: 'Weather squall has passed. Metocean currents returning to moderate baseline. Platform secure.',
      },
    },
  },
  rupture: {
    id: 'rupture',
    title: 'Subsea Production Riser Catastrophic Rupture & Leak',
    shortLabel: 'PIPE RUPTURE',
    category: 'flowline',
    targetAssetId: 'RISER-ALPHA',
    primaryRisk: 'Massive line decompression (-68 bar), seawater ingress, environmental hydrocarbon discharge',
    phases: {
      1: {
        label: 'Phase 1: Wall Thinning & Micro-Fissure Burst',
        description: 'Acoustic DAS burst spike at 84 dB. Localized pressure dip of -12 bar detected.',
        actionRecommended: 'Verify optical fiber DAS anomaly location on Riser Alpha.',
        tacticalVoiceAlert: 'Warning. Micro-fissure acoustic signature detected along subsea riser hang-off.',
      },
      2: {
        label: 'Phase 2: Rapid Decompression & Seawater Intrusion',
        description: 'Pressure drops -42 bar. Water-cut spikes to 48% due to deepwater hydrostatic ingress.',
        actionRecommended: 'Prepare Subsea Isolation Valve (SSIV) actuation.',
        tacticalVoiceAlert: 'Caution. Rapid decompression on Riser Alpha. Seawater ingress detected.',
      },
      3: {
        label: 'Phase 3: Catastrophic Riser Shear (ESD Trip)',
        description: 'Full pipe wall breach. Line pressure crashes to 18 bar. Acoustic emission exceeds 104 dB.',
        actionRecommended: 'Immediate ESD-1 subsea isolation. Close wellhead subsea wing valves.',
        tacticalVoiceAlert: 'Emergency. Catastrophic subsea riser rupture. Automated subsea isolation valve tripped.',
      },
      4: {
        label: 'Phase 4: Complete Wellhead Isolation & Pressure Containment',
        description: 'SSIV closed. Leak isolated to containment sector. Surface sheen containment deployed.',
        actionRecommended: 'Dispatch ROV (Remotely Operated Vehicle) for subsea clamp installation.',
        tacticalVoiceAlert: 'Riser isolated. Subsea containment established. Zero active blowout flow.',
      },
    },
  },
  hydrate_plug: {
    id: 'hydrate_plug',
    title: 'Cryogenic Seabed Hydrate Ice Crystallization',
    shortLabel: 'HYDRATE PLUG',
    category: 'wellhead',
    targetAssetId: 'XT-WELLHEAD-02',
    primaryRisk: 'Cryogenic temperature (<3.5°C) combined with high pressure forming solid methane hydrate ice',
    phases: {
      1: {
        label: 'Phase 1: Thermal Boundary Layer Subcooling',
        description: 'Wellhead seabed fluid temperature drops to 4.8°C. Hydrate subcooling envelope reached.',
        actionRecommended: 'Activate subsea heating trace elements on wellhead tree.',
        tacticalVoiceAlert: 'Advisory. Seabed flowline entering hydrate formation thermodynamic envelope.',
      },
      2: {
        label: 'Phase 2: Hydrate Crystal Slurry Nucleation',
        description: 'Crystalline hydrate slurries forming. Fluid temperature drops to 3.2°C. Pressure differential rises +18 bar.',
        actionRecommended: 'Initiate continuous chemical methanol (MEG) dosing at 15 L/min.',
        tacticalVoiceAlert: 'Caution. Solid hydrate crystals nucleating in wellhead choke valve.',
      },
      3: {
        label: 'Phase 3: Solid Hydrate Blockage Lockout (ESD Trip)',
        description: 'Solid methane hydrate ice plug completely occluding flowline. Temperature 2.6°C. ΔP at +44 bar.',
        actionRecommended: 'Isolate upstream tree. Ramp high-pressure thermodynamic MEG chemical melt.',
        tacticalVoiceAlert: 'Emergency Trip. Solid hydrate ice plug confirmed. Chemical dissolution sequence active.',
      },
      4: {
        label: 'Phase 4: Hydrate Melting & Flow Path Restoration',
        description: 'Hydrate ice melted via MEG injection. Fluid temperature restored to 14.5°C. Full bore flow restored.',
        actionRecommended: 'Normalize continuous thermodynamic chemical injection rate.',
        tacticalVoiceAlert: 'Hydrate plug completely dissolved. Full wellhead flow bore restored.',
      },
    },
  },
  stuck_drill: {
    id: 'stuck_drill',
    title: 'Mechanical Drill Pipe Keyseat Jam & Over-Torque',
    shortLabel: 'STUCK DRILL',
    category: 'drilling',
    targetAssetId: 'DRILL-SYSTEM',
    primaryRisk: 'Differential sticking in subterranean formation, rotational lockup, drillstring twist-off',
    phases: {
      1: {
        label: 'Phase 1: Drag Force Creep & RPM Fluctuation',
        description: 'Rotary torque rising (+8 kNm). Overpull force of 40 MT registered on derrick load cells.',
        actionRecommended: 'Circulate drilling mud at maximum flow rate to clear borehole cuttings.',
        tacticalVoiceAlert: 'Advisory. Borehole drag force increasing on drill assembly.',
      },
      2: {
        label: 'Phase 2: Rotational Drag Overload',
        description: 'Torque reaches 42 kNm. Standpipe pressure increases +32 bar due to mud annulus restriction.',
        actionRecommended: 'Reciprocate drillstring while applying left-hand torque back-off.',
        tacticalVoiceAlert: 'Warning. High borehole mechanical resistance. Torque exceeding nominal threshold.',
      },
      3: {
        label: 'Phase 3: Mechanical Keyseat Jam (ESD Trip)',
        description: 'Complete mechanical lock. RPM drops to zero. Top drive motor exceeds overload trip current.',
        actionRecommended: 'Trip top-drive breaker. Engage hydraulic jarring tool with 120 MT upward impact.',
        tacticalVoiceAlert: 'Emergency. Drill string mechanically locked. Automated motor cutout active.',
      },
      4: {
        label: 'Phase 4: Jar Impact Release & Borehole Clearance',
        description: 'Downhole jarring successful. Drill pipe freed. Rotation restored at 60 RPM.',
        actionRecommended: 'Perform wiper trip to ream tight borehole section.',
        tacticalVoiceAlert: 'Drill string successfully freed from borehole keyseat. Rotational drive restored.',
      },
    },
  },
};

export interface RigAssetInfo {
  id: string;
  name: string;
  category: 'topside' | 'riser' | 'seabed';
  depthMeters: number;
  position: [number, number, number];
  description: string;
}

export const ASSET_CATALOG: Record<string, RigAssetInfo> = {
  'TOPSIDE-DRILL-RIG': {
    id: 'TOPSIDE-DRILL-RIG',
    name: 'Reliance KG-D6 Semi-Submersible Platform',
    category: 'topside',
    depthMeters: 0,
    position: [0, 8, 0],
    description: 'Deepwater Semi-Submersible Production Hub with Integrated Process Modules & Mezzanine Decks',
  },
  'DRILL-SYSTEM': {
    id: 'DRILL-SYSTEM',
    name: 'Rotary Drilling Derrick & Mast',
    category: 'topside',
    depthMeters: 0,
    position: [0, 22, 0],
    description: 'High-torque rotary drill floor, dynamic top-drive system, and deepwater blowout preventer control conduit',
  },
  'CRANE-SYSTEM': {
    id: 'CRANE-SYSTEM',
    name: 'Heavy-Lift Pedestal Deck Cranes',
    category: 'topside',
    depthMeters: 0,
    position: [-12, 18, 0],
    description: 'Pedestal-mounted electro-hydraulic lattice cranes rated for 150 MT subsea deployment and topside supply handling',
  },
  'PILLAR-FOUNDATION': {
    id: 'PILLAR-FOUNDATION',
    name: 'Buoyant Stability Columns & Submerged Pontoons',
    category: 'topside',
    depthMeters: -5,
    position: [0, -5, 0],
    description: 'Four high-strength submerged stability columns providing dynamic hydro-static buoyancy and mooring tension',
  },
  'RISER-ALPHA': {
    id: 'RISER-ALPHA',
    name: 'Subsea Production Risers & Flow Conduits',
    category: 'riser',
    depthMeters: -8,
    position: [0, -6, 0],
    description: 'High-pressure flexible multi-phase dynamic production risers linking subsea manifolds to topside separation units',
  },
  'MANIFOLD-D6-MAIN': {
    id: 'MANIFOLD-D6-MAIN',
    name: 'Subsea Production Manifold Hub D6-M1',
    category: 'seabed',
    depthMeters: -1020,
    position: [0, -10.5, 0],
    description: '4-Slot high-pressure dual-header subsea gathering manifold rated at 690 bar (10,000 psi) with electro-hydraulic choke valves',
  },
  'SUBSEA-BEDROCK': {
    id: 'SUBSEA-BEDROCK',
    name: 'Subterranean KG-D6 Geological Reservoir',
    category: 'seabed',
    depthMeters: -2040,
    position: [0, -35, 0],
    description: 'Deepwater Miocene turbidite sandstone formation and downhole borehole casing spanning down to 2,040 meters subsea depth',
  },
};

export type CurrentFlowPower = 'slow' | 'moderate' | 'fast' | 'extreme' | 'storm';
export type TidePhase = 'flood' | 'ebb' | 'slack' | 'spring_surge';

interface RigState {
  // Navigation & View
  cameraViewMode: CameraViewMode;
  setCameraViewMode: (mode: CameraViewMode) => void;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;

  // Custom .OBJ Model Loading
  customObjUrl: string | null;
  customObjFileName: string | null;
  setCustomObjUrl: (url: string | null, fileName?: string) => void;

  // Scanning Suites
  scannerMode: ScannerMode;
  setScannerMode: (mode: ScannerMode) => void;

  // Environment & Scenarios
  metoceanCondition: MetoceanCondition;
  setMetoceanCondition: (condition: MetoceanCondition) => void;
  emergencyScenario: EmergencyScenario;
  incidentPhase: IncidentPhase;
  isAutoSimulatingPhases: boolean;
  setEmergencyScenario: (scenario: EmergencyScenario, phase?: IncidentPhase) => void;
  setIncidentPhase: (phase: IncidentPhase) => void;
  nextIncidentPhase: () => void;
  prevIncidentPhase: () => void;
  toggleAutoSimulatePhases: () => void;

  // Water Current, Tides & Flow Dynamics
  currentFlowPower: CurrentFlowPower;
  currentSpeedKnots: number;
  currentDirectionDeg: number;
  currentDirectionLabel: string;
  tidePhase: TidePhase;
  tidePhaseIndex: number;
  isDynamicTideCycling: boolean;
  dynamicTideSecondsRemaining: number;
  setCurrentFlowPower: (power: CurrentFlowPower) => void;
  setCurrentSpeedKnots: (speed: number) => void;
  setCurrentDirectionDeg: (deg: number) => void;
  setDynamicTideCycling: (active: boolean) => void;
  setTidePhaseIndex: (index: number) => void;

  // Weather Side Panel
  isWeatherPanelOpen: boolean;
  setWeatherPanelOpen: (open: boolean) => void;
  toggleWeatherPanel: () => void;

  // ElevenLabs Voice Integration
  elevenLabsApiKey: string | null;
  elevenLabsVoiceId: string;
  isVoiceModalOpen: boolean;
  setElevenLabsApiKey: (key: string | null) => void;
  setElevenLabsVoiceId: (id: string) => void;
  setVoiceModalOpen: (open: boolean) => void;

  // HUD & Modals
  isCommandDockOpen: boolean;
  setCommandDockOpen: (open: boolean) => void;
  toggleCommandDock: () => void;

  isIncidentModalOpen: boolean;
  setIncidentModalOpen: (open: boolean) => void;
  toggleIncidentModal: () => void;

  isHardwareModalOpen: boolean;
  setHardwareModalOpen: (open: boolean) => void;
  toggleHardwareModal: () => void;

  isReportModalOpen: boolean;
  setReportModalOpen: (open: boolean) => void;
  toggleReportModal: () => void;

  isEodModalOpen: boolean;
  setEodModalOpen: (open: boolean) => void;
  toggleEodModal: () => void;

  isSihModalOpen: boolean;
  setSihModalOpen: (open: boolean) => void;
  toggleSihModal: () => void;

  isTelemetryDrawerOpen: boolean;
  setTelemetryDrawerOpen: (open: boolean) => void;
  toggleTelemetryDrawer: () => void;

  isPhysicsModalOpen: boolean;
  setPhysicsModalOpen: (open: boolean) => void;
  togglePhysicsModal: () => void;

  // Hardware Connection Mode
  hardwareMode: 'simulation' | 'websocket' | 'webserial' | 'blackbox_csv';
  setHardwareMode: (mode: 'simulation' | 'websocket' | 'webserial' | 'blackbox_csv') => void;

  // Dedicated Holographic Part Inspection Modals (Pipes 1-9, Drill, Motor, Helipad, Cranes, Upper Rig, Wells 1-7)
  activeHoloModal: HolographicComponentType | null;
  openHoloModal: (comp: HolographicComponentType) => void;
  closeHoloModal: () => void;


  // Vision Gesture Technology
  isGestureCameraActive: boolean;
  isSyntheticCameraActive: boolean;
  cameraPermissionState: 'idle' | 'requesting' | 'active' | 'denied' | 'error';
  cameraErrorMessage: string | null;
  gestureDetected: RecognizedGesture;
  gestureConfidence: number;
  gestureSpatial: GestureSpatialState;
  setGestureCameraActive: (active: boolean) => void;
  setSyntheticCameraActive: (active: boolean) => void;
  setCameraPermissionState: (status: 'idle' | 'requesting' | 'active' | 'denied' | 'error') => void;
  setCameraErrorMessage: (msg: string | null) => void;
  setGestureDetected: (
    gesture: RecognizedGesture,
    confidence?: number
  ) => void;
  pointerCursor: { x: number; y: number; active: boolean };
  setPointerCursor: (cursor: { x: number; y: number; active: boolean }) => void;
  setGestureSpatial: (spatial: Partial<GestureSpatialState>) => void;
  targetedPartId: HolographicComponentType | null;
  setTargetedPartId: (id: HolographicComponentType | null) => void;
  openNextSubsystemView: () => void;
  openSubsystemByIndex: (index: number) => void;

  // Jarvis Voice Commander & Varuna Wake-Word Architecture
  isVoiceCommanderActive: boolean;
  isVarunaAwake: boolean;
  varunaWakeExpiry: number;
  lastVoiceCommand: string | null;
  voiceTranscript: string | null;
  isListeningSpeech: boolean;
  setVoiceCommanderActive: (active: boolean) => void;
  setLastVoiceCommand: (cmd: string | null) => void;
  setVoiceTranscript: (transcript: string | null) => void;
  setIsListeningSpeech: (listening: boolean) => void;
  wakeVaruna: () => void;
  sleepVaruna: () => void;
  executeVoiceCommand: (command: string) => void;

  // Jarvis Exploded / Split View & Pipe Slicing
  isSplitViewActive: boolean;
  splitFactor: number;
  isPipeSliced: boolean;
  isPipeSliceModalOpen: boolean;
  selectedSplitPartId: string | null;
  setSplitViewActive: (active: boolean) => void;
  setSplitFactor: (factor: number) => void;
  setPipeSliced: (sliced: boolean) => void;
  setPipeSliceModalOpen: (open: boolean) => void;
  setSelectedSplitPartId: (id: string | null) => void;
  zoomToSplitPart: (partId: string) => void;

  // Audio / Speech State
  voiceStatus: {
    isSpeaking: boolean;
    lastMessage: string;
    timestamp: number;
  };
  setVoiceStatus: (status: { isSpeaking: boolean; lastMessage: string }) => void;
}

const getDirectionLabel = (deg: number): string => {
  const norm = ((deg % 360) + 360) % 360;
  if (norm >= 337.5 || norm < 22.5) return `N (${Math.round(norm).toString().padStart(3, '0')}°)`;
  if (norm < 67.5) return `NE (${Math.round(norm).toString().padStart(3, '0')}°)`;
  if (norm < 112.5) return `E (${Math.round(norm).toString().padStart(3, '0')}°)`;
  if (norm < 157.5) return `SE (${Math.round(norm).toString().padStart(3, '0')}°)`;
  if (norm < 202.5) return `S (${Math.round(norm).toString().padStart(3, '0')}°)`;
  if (norm < 247.5) return `SW (${Math.round(norm).toString().padStart(3, '0')}°)`;
  if (norm < 292.5) return `W (${Math.round(norm).toString().padStart(3, '0')}°)`;
  return `NW (${Math.round(norm).toString().padStart(3, '0')}°)`;
};

// Retrieve cached ElevenLabs Key if available
const cachedApiKey = typeof window !== 'undefined' ? localStorage.getItem('varuna_elevenlabs_key') : null;
const cachedVoiceId = typeof window !== 'undefined' ? localStorage.getItem('varuna_elevenlabs_voice_id') || 'pNInz6obpgDQGcFmaJgB' : 'pNInz6obpgDQGcFmaJgB';

export const useRigStore = create<RigState>((set, get) => ({
  cameraViewMode: 'topside',
  setCameraViewMode: (mode) => set({ cameraViewMode: mode }),
  selectedAssetId: 'RISER-ALPHA',
  setSelectedAssetId: (id) => set({ selectedAssetId: id, isTelemetryDrawerOpen: !!id }),

  customObjUrl: '/models/rig.bin',
  customObjFileName: 'KG-D6 rig (built-in)',
  setCustomObjUrl: (url, fileName) =>
    set({
      customObjUrl: url,
      customObjFileName: fileName || (url ? 'Custom Rig Model (.obj)' : null),
    }),

  // The twin is hologram-only; other modes are kept in the type for older callers but render as hologram
  scannerMode: 'hologram',
  setScannerMode: () => set({ scannerMode: 'hologram' }),

  metoceanCondition: 'calm',
  setMetoceanCondition: (condition) => set({ metoceanCondition: condition }),
  emergencyScenario: 'none',
  incidentPhase: 1,
  isAutoSimulatingPhases: false,

  setEmergencyScenario: (scenario, phase = 1) => {
    // If setting a weather squall, update metocean state directly
    if (scenario === 'weather_squall') {
      set({
        emergencyScenario: scenario,
        incidentPhase: phase,
        metoceanCondition: 'cyclonic',
        currentFlowPower: 'extreme',
        currentSpeedKnots: 8.2,
      });
    } else {
      set({
        emergencyScenario: scenario,
        incidentPhase: phase,
      });
    }
  },

  setIncidentPhase: (phase) => set({ incidentPhase: phase }),

  nextIncidentPhase: () => {
    const current = get().incidentPhase;
    if (current < 4) {
      set({ incidentPhase: (current + 1) as IncidentPhase });
    }
  },

  prevIncidentPhase: () => {
    const current = get().incidentPhase;
    if (current > 1) {
      set({ incidentPhase: (current - 1) as IncidentPhase });
    }
  },

  toggleAutoSimulatePhases: () => set((s) => ({ isAutoSimulatingPhases: !s.isAutoSimulatingPhases })),

  // Water Current, Tides & Flow Dynamics (Default: Moderate NE flow at 2.4 kt)
  currentFlowPower: 'moderate',
  currentSpeedKnots: 2.4,
  currentDirectionDeg: 45,
  currentDirectionLabel: 'NE (045°)',
  tidePhase: 'flood',
  tidePhaseIndex: 0,
  isDynamicTideCycling: true,
  dynamicTideSecondsRemaining: 60,

  setCurrentFlowPower: (power) => {
    let speed = 2.4;
    let metocean: MetoceanCondition = 'calm';
    let tide: TidePhase = 'flood';

    if (power === 'slow') {
      speed = 0.6;
      metocean = 'calm';
      tide = 'slack';
    } else if (power === 'moderate') {
      speed = 2.4;
      metocean = 'calm';
      tide = 'flood';
    } else if (power === 'fast') {
      speed = 4.6;
      metocean = 'monsoon';
      tide = 'flood';
    } else if (power === 'extreme') {
      speed = 8.2;
      metocean = 'cyclonic';
      tide = 'spring_surge';
    } else if (power === 'storm') {
      speed = 8.8;
      metocean = 'cyclonic';
      tide = 'spring_surge';
    }

    set({
      currentFlowPower: power,
      currentSpeedKnots: speed,
      metoceanCondition: metocean,
      tidePhase: tide,
    });
  },

  setCurrentSpeedKnots: (speed) => {
    let power: CurrentFlowPower = 'moderate';
    let metocean: MetoceanCondition = 'calm';

    if (speed < 1.2) {
      power = 'slow';
      metocean = 'calm';
    } else if (speed < 3.5) {
      power = 'moderate';
      metocean = 'calm';
    } else if (speed < 6.5) {
      power = 'fast';
      metocean = 'monsoon';
    } else if (speed < 8.5) {
      power = 'extreme';
      metocean = 'cyclonic';
    } else {
      power = 'storm';
      metocean = 'cyclonic';
    }

    set({ currentSpeedKnots: speed, currentFlowPower: power, metoceanCondition: metocean });
  },

  setCurrentDirectionDeg: (deg) => {
    set({ currentDirectionDeg: deg, currentDirectionLabel: getDirectionLabel(deg) });
  },

  setDynamicTideCycling: (active) => set({ isDynamicTideCycling: active }),
  setTidePhaseIndex: (index) => set({ tidePhaseIndex: index }),

  // Weather Side Panel
  isWeatherPanelOpen: false,
  setWeatherPanelOpen: (open) => set({ isWeatherPanelOpen: open }),
  toggleWeatherPanel: () => set((s) => ({ isWeatherPanelOpen: !s.isWeatherPanelOpen })),

  // ElevenLabs Voice Integration
  elevenLabsApiKey: cachedApiKey,
  elevenLabsVoiceId: cachedVoiceId,
  isVoiceModalOpen: false,
  setElevenLabsApiKey: (key) => {
    if (typeof window !== 'undefined') {
      if (key) localStorage.setItem('varuna_elevenlabs_key', key);
      else localStorage.removeItem('varuna_elevenlabs_key');
    }
    set({ elevenLabsApiKey: key });
  },
  setElevenLabsVoiceId: (id) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('varuna_elevenlabs_voice_id', id);
    }
    set({ elevenLabsVoiceId: id });
  },
  setVoiceModalOpen: (open) => set({ isVoiceModalOpen: open }),

  // Modals & Drawers
  isCommandDockOpen: false,
  setCommandDockOpen: (open) => set({ isCommandDockOpen: open }),
  toggleCommandDock: () => set((s) => ({ isCommandDockOpen: !s.isCommandDockOpen })),

  isIncidentModalOpen: false,
  setIncidentModalOpen: (open) => set({ isIncidentModalOpen: open }),
  toggleIncidentModal: () => set((s) => ({ isIncidentModalOpen: !s.isIncidentModalOpen })),

  isHardwareModalOpen: false,
  setHardwareModalOpen: (open) => set({ isHardwareModalOpen: open }),
  toggleHardwareModal: () => set((s) => ({ isHardwareModalOpen: !s.isHardwareModalOpen })),

  isReportModalOpen: false,
  setReportModalOpen: (open) => set({ isReportModalOpen: open }),
  toggleReportModal: () => set((s) => ({ isReportModalOpen: !s.isReportModalOpen })),

  isEodModalOpen: false,
  setEodModalOpen: (open) => set({ isEodModalOpen: open }),
  toggleEodModal: () => set((s) => ({ isEodModalOpen: !s.isEodModalOpen })),

  isSihModalOpen: false,
  setSihModalOpen: (open) => set({ isSihModalOpen: open }),
  toggleSihModal: () => set((s) => ({ isSihModalOpen: !s.isSihModalOpen })),

  isTelemetryDrawerOpen: true,
  setTelemetryDrawerOpen: (open) => set({ isTelemetryDrawerOpen: open }),
  toggleTelemetryDrawer: () => set((s) => ({ isTelemetryDrawerOpen: !s.isTelemetryDrawerOpen })),

  isPhysicsModalOpen: false,
  setPhysicsModalOpen: (open) => set({ isPhysicsModalOpen: open }),
  togglePhysicsModal: () => set((s) => ({ isPhysicsModalOpen: !s.isPhysicsModalOpen })),

  // Hardware Connection Mode
  hardwareMode: 'simulation',
  setHardwareMode: (mode) => set({ hardwareMode: mode }),

  // Dedicated Holographic Part Inspection Modals
  activeHoloModal: null,
  openHoloModal: (comp: HolographicComponentType) => {
    set({
      activeHoloModal: comp,
      selectedSplitPartId: comp,
      selectedAssetId: comp.toUpperCase(),
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      varunaVoice.speakCustom(`Displaying dedicated 3D holographic diagnostics for ${comp.toUpperCase().replace('_', ' ')}.`);
    });
  },
  closeHoloModal: () => set({ activeHoloModal: null }),

  // Vision Gesture Technology
  isGestureCameraActive: false,
  isSyntheticCameraActive: false,
  cameraPermissionState: 'idle',
  cameraErrorMessage: null,
  gestureDetected: null,
  gestureConfidence: 0,
  gestureSpatial: {
    deltaX: 0,
    deltaY: 0,
    zoomDelta: 0,
    distance: 0,
    handsCount: 0,
    primaryHand: null,
    secondaryHand: null,
    activeMode: 'IDLE',
  },
  setGestureCameraActive: (active) => set({ isGestureCameraActive: active }),
  setSyntheticCameraActive: (active) => set({ isSyntheticCameraActive: active }),
  setCameraPermissionState: (status) => set({ cameraPermissionState: status }),
  setCameraErrorMessage: (msg) => set({ cameraErrorMessage: msg }),
  setGestureDetected: (gesture, confidence = 1.0) => {
    const prev = get();
    if (prev.gestureDetected === gesture && Math.abs(prev.gestureConfidence - confidence) < 0.05) {
      return;
    }
    set({ gestureDetected: gesture, gestureConfidence: confidence });
  },
  pointerCursor: { x: 0.5, y: 0.5, active: false },
  setPointerCursor: (cursor: { x: number; y: number; active: boolean }) => set({ pointerCursor: cursor }),

  setGestureSpatial: (spatial: Partial<GestureSpatialState>) =>
    set((state) => ({
      gestureSpatial: { ...state.gestureSpatial, ...spatial },
    })),
  targetedPartId: null,
  setTargetedPartId: (id) => set({ targetedPartId: id }),
  openNextSubsystemView: () => {
    const state = get();
    // If a part is currently targeted by finger laser pointer, open that part
    if (state.targetedPartId) {
      state.openHoloModal(state.targetedPartId);
      state.setCameraViewMode(state.targetedPartId);
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
        varunaVoice.speakCustom(
          `Swipe gesture recognized. Opening dedicated inspection view for ${state.targetedPartId?.toUpperCase().replace('_', ' ')}.`
        );
      });
      return;
    }

    // Otherwise cycle through available subsystems
    const subsystems: HolographicComponentType[] = [
      'helipad',
      'crane1',
      'crane2',
      'command_dock',
      'accommodation',
      'pipe1',
      'pipe2',
      'pipe3',
      'pipe4',
      'pipe5',
      'pipe6',
      'pipe7',
      'pipe8',
      'pipe9',
    ];

    const currentModal = state.activeHoloModal;
    const currentIndex = currentModal ? subsystems.indexOf(currentModal) : -1;
    const nextIndex = (currentIndex + 1) % subsystems.length;
    const nextSubsystem = subsystems[nextIndex];

    state.openHoloModal(nextSubsystem);
    state.setCameraViewMode(nextSubsystem);
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      varunaVoice.speakCustom(
        `Swipe gesture recognized. Opening dedicated inspection view for ${nextSubsystem.toUpperCase().replace('_', ' ')}.`
      );
    });
  },
  openSubsystemByIndex: (index: number) => {
    const state = get();
    switch (index) {
      case 1:
        // Index 1: Helipad
        state.openHoloModal('helipad');
        state.setCameraViewMode('helipad');
        state.setSelectedAssetId('HELIDECK-CAP437');
        import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
          varunaVoice.speakCustom('Subsystem index 1: Helideck CAP 437 holographic inspection opened.');
        });
        break;
      case 2:
        // Index 2: Crane 1
        state.openHoloModal('crane1');
        state.setCameraViewMode('crane1');
        state.setSelectedAssetId('CRANE-PORT-BOOM');
        import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
          varunaVoice.speakCustom('Subsystem index 2: Port Crane 1 lattice boom inspection opened.');
        });
        break;
      case 3:
        // Index 3: Crane 2
        state.openHoloModal('crane2');
        state.setCameraViewMode('crane2');
        state.setSelectedAssetId('CRANE-STARBOARD-PEDESTAL');
        import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
          varunaVoice.speakCustom('Subsystem index 3: Starboard Crane 2 pedestal inspection opened.');
        });
        break;
      case 4:
        // Index 4: Command Dock
        state.openHoloModal('command_dock');
        state.setCameraViewMode('command_dock');
        state.setSelectedAssetId('COMMAND-DOCK-BRIDGE');
        import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
          varunaVoice.speakCustom('Subsystem index 4: Tactical Command Dock opened.');
        });
        break;
      case 5:
        // Index 5: Accommodation & Main Deck
        state.openHoloModal('accommodation');
        state.setCameraViewMode('accommodation');
        state.setSelectedAssetId('ACCOMMODATION-MODULE');
        import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
          varunaVoice.speakCustom('Subsystem index 5: Living quarters and main deck module opened.');
        });
        break;
      default:
        break;
    }
  },

  // Jarvis / Varuna Voice Commander & Wake-Word Architecture
  isVoiceCommanderActive: true,
  isVarunaAwake: false,
  varunaWakeExpiry: 0,
  lastVoiceCommand: null,
  voiceTranscript: null,
  isListeningSpeech: false,
  setVoiceCommanderActive: (active) => set({ isVoiceCommanderActive: active }),
  setLastVoiceCommand: (cmd) => set({ lastVoiceCommand: cmd }),
  setVoiceTranscript: (transcript) => set({ voiceTranscript: transcript }),
  setIsListeningSpeech: (listening) => set({ isListeningSpeech: listening }),

  wakeVaruna: () => {
    const expiry = Date.now() + 10000; // 10 second active listening window
    set({ isVarunaAwake: true, varunaWakeExpiry: expiry });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      // Short reply: the recogniser ignores input while VARUNA talks (echo guard)
      varunaVoice.speakCustom('Yes?');
    });
  },

  sleepVaruna: () => set({ isVarunaAwake: false, varunaWakeExpiry: 0 }),

  // Jarvis Exploded / Split View & Pipe Slicing
  isSplitViewActive: false,
  splitFactor: 0.0,
  isPipeSliced: false,
  isPipeSliceModalOpen: false,
  selectedSplitPartId: null,

  setSplitViewActive: (active) => {
    set({
      isSplitViewActive: active,
      splitFactor: active ? 1.0 : 0.0,
      cameraViewMode: active ? 'split' : 'topside',
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      if (active) {
        varunaVoice.speakCustom('Executing Iron Man piece-by-piece modular split view. All 12 structural assemblies decoupled for holographic diagnostics.');
      } else {
        varunaVoice.speakCustom('Reassembling subsea digital twin. All structural modules locked in nominal alignment.');
      }
    });
  },

  setSplitFactor: (factor) => set({ splitFactor: factor }),

  setPipeSliced: (sliced) => {
    set({
      isPipeSliced: sliced,
      cameraViewMode: sliced ? 'pipe1_slice' : 'pipe1',
      isPipeSliceModalOpen: sliced,
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      if (sliced) {
        varunaVoice.speakCustom('Pipe 1 longitudinal cross-section cut active. Exposing internal multi-phase fluid core and ultrasonic wall profile.');
      } else {
        varunaVoice.speakCustom('Pipeline cross-section closed. Returning to catenary riser inspection.');
      }
    });
  },

  setPipeSliceModalOpen: (open) => set({ isPipeSliceModalOpen: open }),
  setSelectedSplitPartId: (id) => set({ selectedSplitPartId: id }),

  zoomToSplitPart: (partId) => {
    const validComponent = partId.toLowerCase() as HolographicComponentType;
    set({
      selectedSplitPartId: partId,
      selectedAssetId: partId,
      cameraViewMode: 'part_detail',
      activeHoloModal: validComponent,
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      varunaVoice.speakCustom(`Focusing on decoupled module ${partId}. Synchronizing holographic telemetry.`);
    });
  },

  /** VARUNA-AI voice pipeline: wake word gate -> intent parser (src/voice/VoiceCommandParser.ts) -> action. */
  executeVoiceCommand: (rawCommand: string) => {
    set({ lastVoiceCommand: rawCommand });

    const say = (text: string) => {
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => varunaVoice.speakCustom(text));
    };

    const hasWakeWord = WAKE_WORD_REGEX.test(rawCommand);
    const isCurrentlyAwake = get().isVarunaAwake && Date.now() < get().varunaWakeExpiry;

    // Asleep and no wake word: stay silent
    if (!hasWakeWord && !isCurrentlyAwake) return;

    const parsed = parseVoiceCommand(rawCommand);

    // Wake word alone ("Varuna", "hey Varuna, hello") opens the listening window
    if (!parsed) {
      const rest = normalizeTranscript(stripWakeWord(rawCommand)).filter(
        (t) => !['hello', 'hi', 'hey', 'ok', 'okay', 'wake', 'up', 'online', 'start', 'please'].includes(t)
      );
      if (rest.length === 0) {
        get().wakeVaruna();
        return;
      }
      // Something was said but nothing matched: keep listening and ask once
      set({ isVarunaAwake: true, varunaWakeExpiry: Date.now() + 10000, voiceTranscript: null, lastVoiceCommand: null });
      import('../voice/JarvisVoiceCommander').then(({ jarvisVoiceCommander }) => jarvisVoiceCommander.resetDebounce());
      say("Sorry, I didn't catch that. Say help to hear what I can do.");
      return;
    }

    // Keep the session open for quick follow-up commands
    set({ isVarunaAwake: true, varunaWakeExpiry: Date.now() + 12000, voiceTranscript: null });

    const openPanel = (patch: Partial<RigState>, speech: string) => {
      set(patch);
      say(speech);
    };
    const focus = (mode: CameraViewMode, assetId: string, modal: HolographicComponentType, speech: string) =>
      openPanel({ cameraViewMode: mode, selectedAssetId: assetId, activeHoloModal: modal, isTelemetryDrawerOpen: true }, speech);

    switch (parsed.id) {
      case 'split_view':
        return openPanel(
          { isSplitViewActive: true, splitFactor: 1.0, cameraViewMode: 'split' },
          'Opening exploded split view. All structural assemblies decoupled.'
        );
      case 'assemble':
        return openPanel(
          {
            isSplitViewActive: false,
            splitFactor: 0.0,
            isPipeSliced: false,
            isPipeSliceModalOpen: false,
            activeHoloModal: null,
            cameraViewMode: 'topside',
          },
          'Reassembling the digital twin. Full alignment restored.'
        );
      case 'helipad':
        return focus('helipad', 'HELIPAD-DECK', 'helipad', 'Opening the CAP 437 helipad.');
      case 'crane':
        if (!parsed.num) {
          set({ varunaWakeExpiry: Date.now() + 10000 });
          return say('Which crane? Say crane one or crane two.');
        }
        return parsed.num === 1
          ? focus('crane1', 'CRANE-PORT', 'crane1', 'Opening port crane one, the lattice boom.')
          : focus('crane2', 'CRANE-STARBOARD', 'crane2', 'Opening starboard crane two, the pedestal crane.');
      case 'accommodation':
        return focus('accommodation', 'ACCOMMODATION-MODULE', 'accommodation', 'Opening the accommodation module.');
      case 'industrial_pipes':
        return focus('industrial_pipes', 'INDUSTRIAL-PIPES', 'industrial_pipes', 'Opening industrial pipe fitting and valve manifold.');
      case 'jackup_legs':
        return focus('jackup_legs', 'PILLAR-FOUNDATION', 'jackup_legs', 'Opening jack-up legs and foundation columns.');
      case 'drill_string':
        return focus('drill_string', 'DRILL-SYSTEM', 'drill_string', 'Opening the subsea drill string.');
      case 'drill_bit':
        return focus('drill_bit', 'DRILL-SYSTEM', 'drill_bit', 'Opening the PDC drill bit.');
      case 'drill':
        return focus('drill', 'DRILL-SYSTEM', 'drill', 'Opening the drilling derrick and drill system.');
      case 'motor':
        return focus('motor', 'TOP-DRIVE-MOTOR', 'motor', 'Opening the top drive motor.');
      case 'main_deck':
        return focus('main_deck', 'TOPSIDE-DRILL-RIG', 'main_deck', 'Opening the main deck structure.');
      case 'upper_rig':
        return focus('upper_rig', 'TOPSIDE-DRILL-RIG', 'upper_rig', 'Opening the upper rig superstructure.');
      case 'pipe': {
        if (!parsed.num) {
          set({ varunaWakeExpiry: Date.now() + 10000 });
          return say('Which pipe? Say a number from one to nine.');
        }
        const key = `pipe${parsed.num}` as HolographicComponentType;
        return focus(key as CameraViewMode, `PIPE-${parsed.num}`, key, `Opening flowline pipe ${parsed.num}.`);
      }
      case 'well': {
        if (!parsed.num) {
          set({ varunaWakeExpiry: Date.now() + 10000 });
          return say('Which well? Say a number from one to seven.');
        }
        const key = `well${parsed.num}` as HolographicComponentType;
        return focus(key as CameraViewMode, `WELL-${parsed.num}`, key, `Opening production well ${parsed.num}.`);
      }
      case 'wells_all':
        return focus('wells1_7', 'WELL-CLUSTER', 'wells1_7', 'Opening wells one through seven.');
      case 'slice':
        return openPanel(
          { isPipeSliced: true, isPipeSliceModalOpen: true, cameraViewMode: 'pipe1_slice', selectedAssetId: 'RISER-ALPHA' },
          'Opening the pipe cross-section.'
        );
      case 'command_dock':
        return openPanel({ isCommandDockOpen: true }, 'Opening the command dock.');
      case 'hardware':
        return openPanel({ isHardwareModalOpen: true }, 'Opening the hardware SCADA gateway.');
      case 'presentation':
        return openPanel({ isSihModalOpen: true }, 'Opening the presentation deck.');
      case 'database':
        return openPanel({ isTelemetryDrawerOpen: true, isEodModalOpen: true }, 'Opening the six month production ledger.');
      case 'compliance':
        return openPanel({ isReportModalOpen: true }, 'Opening the compliance audit report.');
      case 'physics_report':
        return openPanel({ isPhysicsModalOpen: true }, 'Showing the physics and equations report.');
      case 'weather':
        set({ isWeatherPanelOpen: true });
        import('../services/KgD6WeatherService').then(({ KgD6WeatherService }) =>
          KgD6WeatherService.getSpokenWeatherForecast().then(say).catch(() => say('Opening the weather panel.'))
        );
        return;
      case 'water_status':
        import('../physics/DynamicTideEngine').then(({ dynamicTideEngine }) => say(dynamicTideEngine.getWaterStatusSpeech()));
        return;
      case 'view_topside':
        return openPanel({ cameraViewMode: 'topside', activeHoloModal: null }, 'Returning to the full rig view.');
      case 'view_subsea':
        return openPanel({ cameraViewMode: 'subsea' }, 'Diving below the waterline.');
      case 'view_manifold':
        return openPanel({ cameraViewMode: 'manifold' }, 'Moving to the seabed manifold.');
      case 'mode_hologram':
        return say("You're already in the hologram view.");
      case 'mode_realistic':
      case 'mode_thermal':
      case 'mode_acoustic':
      case 'mode_color':
        return say('The twin runs in hologram view only.');
      case 'start_camera':
        import('../vision/JarvisGestureVisionEngine').then(({ jarvisGestureEngine }) => jarvisGestureEngine.start());
        return say('Starting the gesture camera.');
      case 'stop_camera':
        import('../vision/JarvisGestureVisionEngine').then(({ jarvisGestureEngine }) => jarvisGestureEngine.stop());
        return say('Gesture camera off.');
      case 'close':
        return openPanel(
          {
            activeHoloModal: null,
            isSihModalOpen: false,
            isEodModalOpen: false,
            isReportModalOpen: false,
            isHardwareModalOpen: false,
            isPhysicsModalOpen: false,
            isWeatherPanelOpen: false,
            isPipeSliceModalOpen: false,
            isCommandDockOpen: false,
          },
          'Closed.'
        );
      case 'repeat':
        return say(get().voiceStatus.lastMessage || 'I am ready for your command.');
      case 'help':
        set({ varunaWakeExpiry: Date.now() + 20000 });
        return say(VOICE_HELP_TEXT);
      case 'sleep':
        set({ isVarunaAwake: false, varunaWakeExpiry: 0 });
        return say('Standing by. Say Varuna when you need me.');
    }
  },

  voiceStatus: {
    isSpeaking: false,
    lastMessage: 'VARUNA-AI Online. Subsea monitoring active at 2,040m depth.',
    timestamp: Date.now(),
  },
  setVoiceStatus: (status) =>
    set({
      voiceStatus: {
        ...status,
        timestamp: Date.now(),
      },
    }),
}));
