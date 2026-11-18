import { create } from 'zustand';
import {
  parseVoiceCommand,
  normalizeTranscript,
  stripWakeWord,
  hasWakeWord,
  VOICE_HELP_TEXT,
} from '../voice/VoiceCommandParser';
import { answerRigQuestion } from '../voice/RigKnowledge';

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
export type MetoceanCondition = 'calm' | 'monsoon' | 'cyclonic';

export type MicState = 'off' | 'starting' | 'listening' | 'blocked' | 'unsupported' | 'error';

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
  | 'THUMB_UP'
  | 'THUMB_DOWN'
  | 'ZOOM'
  | null;

/** Parts a finger-count pose can select (1-5); a fist then opens the selection. */
export const GESTURE_PARTS: Record<number, { part: HolographicComponentType; asset: string; label: string }> = {
  1: { part: 'helipad', asset: 'HELIDECK-CAP437', label: 'the helideck' },
  2: { part: 'crane1', asset: 'CRANE-PORT-BOOM', label: 'crane one' },
  3: { part: 'crane2', asset: 'CRANE-STARBOARD-PEDESTAL', label: 'crane two' },
  4: { part: 'command_dock', asset: 'COMMAND-DOCK-BRIDGE', label: 'the command dock' },
  5: { part: 'accommodation', asset: 'ACCOMMODATION-MODULE', label: 'the living quarters' },
};

export interface GestureSelection {
  index: number;
  label: string;
  /** Part under the pointer when the selection was made with one finger */
  targetPart: HolographicComponentType | null;
  at: number;
}

/** Layer-wise views, top to bottom (thumb up / down or the layer buttons step through them). */
export const VIEW_LAYERS: { mode: CameraViewMode; label: string }[] = [
  { mode: 'upper_rig', label: 'Derrick & topside' },
  { mode: 'topside', label: 'Full rig' },
  { mode: 'subsea', label: 'Below the waterline' },
  { mode: 'manifold', label: 'Seabed manifold' },
  { mode: 'drill', label: 'Drill string & bit' },
];

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
    | 'DECOUPLED_DUAL'
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

/**
 * Incident drills. Each phase's text describes what the twin's physics actually does in that
 * phase (TelemetryEmitter.incidentTarget); live values appear in the panels, so the text
 * avoids fixed numbers except where the model produces them. Phase 4 is recovery.
 */
const phase = (label: string, description: string, actionRecommended: string, tacticalVoiceAlert: string) => ({ label, description, actionRecommended, tacticalVoiceAlert });

export const INCIDENT_SCENARIOS_CATALOG: Record<EmergencyScenario, IncidentMetadata> = {
  none: {
    id: 'none',
    title: 'Normal operations',
    shortLabel: 'ALL NORMAL',
    category: 'flowline',
    targetAssetId: 'MANIFOLD-D6-MAIN',
    primaryRisk: 'None',
    phases: {
      1: phase('Monitoring', 'All metered assets inside their operating envelope.', 'Keep monitoring.', 'All readings normal.'),
      2: phase('Monitoring', 'Normal.', 'None.', 'Normal.'),
      3: phase('Monitoring', 'Normal.', 'None.', 'Normal.'),
      4: phase('Monitoring', 'Normal.', 'None.', 'Normal.'),
    },
  },
  pipe_blockage: {
    id: 'pipe_blockage',
    title: 'Riser Alpha flow restriction',
    shortLabel: 'PIPE CONGESTION',
    category: 'flowline',
    targetAssetId: 'MANIFOLD-D6-MAIN',
    primaryRisk: 'Back-pressure on the wells, lost production, low-flow cooling toward hydrate conditions',
    phases: {
      1: phase('Phase 1: Restriction building', 'Friction in riser Alpha rises. Manifold pressure starts to climb and flow shifts to riser Bravo.', 'Watch manifold pressure and the riser flow split; prepare chemical injection.', 'Warning. Flow restriction building in riser Alpha.'),
      2: phase('Phase 2: Flow choking', 'The wells feel the back-pressure and block flow falls. Riser Bravo carries most of the gas.', 'Reduce well chokes; prime MEG injection.', 'Caution. Riser Alpha is choking. Manifold pressure rising.'),
      3: phase('Phase 3: Near-total blockage', 'Riser Alpha almost closed: manifold pressure about 45 bar above normal, and the low flow cools the line toward hydrate conditions.', 'Inject MEG at maximum rate; consider shutting in riser Alpha.', 'Emergency. Riser Alpha nearly blocked. Manifold pressure critical.'),
      4: phase('Phase 4: Restriction clearing', 'The restriction eases: pressure falls back and flow returns to both risers.', 'Reopen gradually and confirm the riser split is balanced.', 'Restriction clearing. Pressures returning to normal.'),
    },
  },
  drill_damage: {
    id: 'drill_damage',
    title: 'Drill bit damage and stick-slip',
    shortLabel: 'DRILL DAMAGE',
    category: 'drilling',
    targetAssetId: 'DRILL-SYSTEM',
    primaryRisk: 'Bit cutter damage, torque overload, drill-string twist-off',
    phases: {
      1: phase('Phase 1: Stick-slip', 'Torque oscillates at the string’s first torsional mode (about 0.19 Hz) and rotary speed starts to fall.', 'Reduce rotary speed and weight on bit.', 'Warning. Stick-slip vibration on the drill string.'),
      2: phase('Phase 2: Over-torque', 'Torque swings grow as the bit loses cutters; rotary speed falls further.', 'Pick up off bottom; prepare to trip out.', 'Caution. Drill string torque overload.'),
      3: phase('Phase 3: Stall', 'The bit stalls (0 RPM) and the string holds stall torque.', 'Cut top-drive power; set slips.', 'Emergency. Drill string stalled. Top drive cut out.'),
      4: phase('Phase 4: Released', 'Torque relieved; rotation resumes at reduced speed.', 'Trip out and replace the bit.', 'Drill string free. Rotation restored at reduced speed.'),
    },
  },
  oil_overload: {
    id: 'oil_overload',
    title: 'Condensate surge into the separator',
    shortLabel: 'LIQUID SURGE',
    category: 'topside',
    targetAssetId: 'TOPSIDE-MPFM-01',
    primaryRisk: 'Separator high-high level, liquid carry-over into gas compression',
    phases: {
      1: phase('Phase 1: Liquid surge', 'Condensate arriving topside rises about 25% above the published rate.', 'Watch separator level; check meter density.', 'Advisory. Condensate surge arriving topside.'),
      2: phase('Phase 2: High level, more water', 'Liquids about 50% above normal and water cut climbing.', 'Choke back the wells; route surplus to storage.', 'Warning. Separator level high and water cut rising.'),
      3: phase('Phase 3: High-high level', 'Liquids about 80% above normal; risk of carry-over into the gas train.', 'Trip the wells to protect the compressors.', 'Emergency. Separator high-high level.'),
      4: phase('Phase 4: Normalising', 'Liquids back to about 10% above normal; water cut falling.', 'Reset level alarms; balance the trains.', 'Separator levels back to normal.'),
    },
  },
  weather_squall: {
    id: 'weather_squall',
    title: 'Severe weather squall',
    shortLabel: 'WEATHER SQUALL',
    category: 'metocean',
    targetAssetId: 'TOPSIDE-DRILL-RIG',
    primaryRisk: 'Crane and helideck operations outside limits; wave loading on the jacket and risers',
    phases: {
      1: phase('Phase 1: Squall approaching', 'Pressure falling and wind backing; gusts approaching crane limits (35–38 kt).', 'Warn crane operators; check the live weather panel.', 'Weather advisory. Squall approaching.'),
      2: phase('Phase 2: Wind and waves building', 'Gusts above crane limits and waves building.', 'Stop crane lifts; close the helideck.', 'Caution. Crane lifts stopped. Helideck closed.'),
      3: phase('Phase 3: Storm peak', 'Peak wind and waves; the hologram shows the platform response.', 'Secure loose equipment; keep personnel inside.', 'Severe weather. Personnel to stay inside.'),
      4: phase('Phase 4: Passing', 'Wind and sea easing.', 'Inspect risers and cranes before resuming.', 'Squall passing. Inspect before resuming work.'),
    },
  },
  rupture: {
    id: 'rupture',
    title: 'Riser Alpha loss of containment',
    shortLabel: 'RISER LEAK',
    category: 'flowline',
    targetAssetId: 'RISER-ALPHA',
    primaryRisk: 'Gas and condensate released to sea from riser Alpha',
    phases: {
      1: phase('Phase 1: Small leak', 'About 2% of riser Alpha’s flow escapes. The mass balance starts to drift; only the leak detector can see it.', 'Watch the mass-balance panel.', 'Advisory. Mass balance drifting on the riser section.'),
      2: phase('Phase 2: Leak growing', 'About 6% escapes. Riser Alpha pressure falls below the model and the mass-balance alarm trips.', 'Confirm with subsea leak sensors or an ROV; prepare SSIV closure.', 'Warning. Leak detected on riser Alpha.'),
      3: phase('Phase 3: Major leak', 'About 15% of riser Alpha’s flow is lost.', 'Close the riser Alpha subsea isolation valve.', 'Emergency. Major leak on riser Alpha. Close the isolation valve.'),
      4: phase('Phase 4: Isolated', 'SSIV closed: riser Alpha is isolated and all flow goes through riser Bravo.', 'Send an ROV to inspect and clamp the riser.', 'Riser Alpha isolated. Flow diverted to riser Bravo.'),
    },
  },
  hydrate_plug: {
    id: 'hydrate_plug',
    title: 'Hydrate forming in the manifold',
    shortLabel: 'HYDRATE PLUG',
    category: 'wellhead',
    targetAssetId: 'MANIFOLD-D6-MAIN',
    primaryRisk: 'Solid gas hydrate blocking the manifold at high pressure and low temperature',
    phases: {
      1: phase('Phase 1: Hydrate starting', 'Restriction growing in the manifold with free water arriving; flow falls and the lines cool.', 'Start MEG injection.', 'Advisory. Hydrate risk in the manifold.'),
      2: phase('Phase 2: Slurry', 'Restriction tightens; well-head pressures rise as flow falls.', 'Increase MEG dosing.', 'Caution. Hydrate restriction growing.'),
      3: phase('Phase 3: Plug', 'Manifold close to blocked; wells near shut-in pressure.', 'Isolate the wells; depressurise and dose MEG.', 'Emergency. Hydrate plug in the manifold.'),
      4: phase('Phase 4: Melted', 'Plug dissolving; flow and temperature recovering.', 'Reduce MEG to maintenance rate.', 'Hydrate plug cleared. Flow recovering.'),
    },
  },
  stuck_drill: {
    id: 'stuck_drill',
    title: 'Stuck drill pipe',
    shortLabel: 'STUCK DRILL',
    category: 'drilling',
    targetAssetId: 'DRILL-SYSTEM',
    primaryRisk: 'Differential sticking, rotational lock-up, twist-off',
    phases: {
      1: phase('Phase 1: Drag rising', 'Rotary speed falling and torque oscillating as drag builds.', 'Circulate at full rate to clean the hole.', 'Advisory. Drag increasing on the drill string.'),
      2: phase('Phase 2: Overload', 'Speed falls further; torque swings grow.', 'Work the pipe; apply back-off torque.', 'Warning. Drill string torque above normal.'),
      3: phase('Phase 3: Stuck', 'Rotation stops (0 RPM) at stall torque.', 'Cut the top drive; fire the jars.', 'Emergency. Drill string stuck. Top drive cut out.'),
      4: phase('Phase 4: Freed', 'Pipe freed; rotation restored at reduced speed.', 'Ream the tight section before drilling on.', 'Drill string freed. Rotation restored.'),
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
    name: 'KG-D6 production platform',
    category: 'topside',
    depthMeters: 0,
    position: [0, 8, 0],
    description: 'Fixed production platform with process modules, cranes, helideck and drilling derrick',
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
    description: 'Two pedestal deck cranes for supply and equipment handling'
  },
  'PILLAR-FOUNDATION': {
    id: 'PILLAR-FOUNDATION',
    name: 'Support legs & foundation',
    category: 'topside',
    depthMeters: -5,
    position: [0, -5, 0],
    description: 'Four steel jacket legs carrying the topside to the seabed foundation'
  },
  'RISER-ALPHA': {
    id: 'RISER-ALPHA',
    name: 'Subsea Production Risers & Flow Conduits',
    category: 'riser',
    depthMeters: -8,
    position: [0, -6, 0],
    description: 'Two production risers carrying gas and condensate from the subsea manifold to the topside'
  },
  'MANIFOLD-D6-MAIN': {
    id: 'MANIFOLD-D6-MAIN',
    name: 'Subsea Production Manifold Hub D6-M1',
    category: 'seabed',
    depthMeters: -1000,
    position: [0, -10.5, 0],
    description: 'Subsea gathering manifold commingling the wells before the risers'
  },
  'SUBSEA-BEDROCK': {
    id: 'SUBSEA-BEDROCK',
    name: 'Reservoir and wells',
    category: 'seabed',
    depthMeters: -4200,
    position: [0, -35, 0],
    description: 'HPHT gas-condensate reservoir; MJ field wells reach about 4,200 m below sea level'
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


  isReportModalOpen: boolean;
  setReportModalOpen: (open: boolean) => void;

  isEodModalOpen: boolean;
  setEodModalOpen: (open: boolean) => void;

  isPresentationOpen: boolean;
  setPresentationOpen: (open: boolean) => void;

  isTelemetryDrawerOpen: boolean;
  toggleTelemetryDrawer: () => void;

  isPhysicsModalOpen: boolean;
  setPhysicsModalOpen: (open: boolean) => void;
  togglePhysicsModal: () => void;

  // Hardware Connection Mode

  // Dedicated Holographic Part Inspection Modals (Pipes 1-9, Drill, Motor, Helipad, Cranes, Upper Rig, Wells 1-7)
  activeHoloModal: HolographicComponentType | null;
  openHoloModal: (comp: HolographicComponentType) => void;
  closeHoloModal: () => void;


  // Vision Gesture Technology
  isGestureCameraActive: boolean;
  cameraPermissionState: 'idle' | 'requesting' | 'active' | 'denied' | 'error';
  cameraErrorMessage: string | null;
  gestureDetected: RecognizedGesture;
  gestureSpatial: GestureSpatialState;
  setGestureCameraActive: (active: boolean) => void;
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
  /** Part picked by a finger-count pose; a fist opens it */
  gestureSelection: GestureSelection | null;
  setGestureSelection: (sel: GestureSelection | null) => void;
  /** One-shot zoom request (factor < 1 zooms in) from on-screen buttons */
  cameraNudge: { zoom: number; seq: number };
  nudgeZoom: (factor: number) => void;
  /** Move one layer up (-1) or down (+1) through VIEW_LAYERS */
  stepLayer: (dir: 1 | -1) => void;

  // Varuna Voice Commander & Wake-Word Architecture
  isVoiceCommanderActive: boolean;
  isVarunaAwake: boolean;
  varunaWakeExpiry: number;
  voiceTranscript: string | null;
  isListeningSpeech: boolean;
  /** Microphone state shown in the HUD, with a plain-language reason when it is not listening */
  micState: MicState;
  micMessage: string | null;
  setMicState: (state: MicState, message?: string | null) => void;
  setVoiceCommanderActive: (active: boolean) => void;
  setVoiceTranscript: (transcript: string | null) => void;
  setIsListeningSpeech: (listening: boolean) => void;
  wakeVaruna: () => void;
  sleepVaruna: () => void;
  executeVoiceCommand: (command: string) => void;

  // Varuna Exploded / Split View & Pipe Slicing
  isSplitViewActive: boolean;
  isPipeSliced: boolean;
  isPipeSliceModalOpen: boolean;
  selectedSplitPartId: string | null;
  setSplitViewActive: (active: boolean) => void;
  setPipeSliced: (sliced: boolean) => void;
  setPipeSliceModalOpen: (open: boolean) => void;
  setSelectedSplitPartId: (id: string | null) => void;

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
  setSelectedAssetId: (id) => set(id ? { selectedAssetId: id, isTelemetryDrawerOpen: true, isWeatherPanelOpen: false } : { selectedAssetId: id, isTelemetryDrawerOpen: false }),

  customObjUrl: '/models/rig.bin.gz',
  customObjFileName: 'KG-D6 rig (built-in)',
  setCustomObjUrl: (url, fileName) =>
    set({
      customObjUrl: url,
      customObjFileName: fileName || (url ? 'Custom Rig Model (.obj)' : null),
    }),

  // The twin is hologram-only; other modes are kept in the type for older callers but render as hologram

  metoceanCondition: 'calm',
  setMetoceanCondition: (condition) => set({ metoceanCondition: condition }),
  emergencyScenario: 'none',
  incidentPhase: 1,
  isAutoSimulatingPhases: false,

  setEmergencyScenario: (scenario, phase = 1) => {
    // A squall drill holds the storm current (pausing the live feed); ending it resumes live data
    if (scenario === 'weather_squall') {
      set({
        emergencyScenario: scenario,
        incidentPhase: phase,
        metoceanCondition: 'cyclonic',
        currentFlowPower: 'storm',
        currentSpeedKnots: 3.5,
        isDynamicTideCycling: false,
      });
    } else {
      const wasSquall = get().emergencyScenario === 'weather_squall';
      set({
        emergencyScenario: scenario,
        incidentPhase: phase,
        ...(wasSquall ? { isDynamicTideCycling: true, metoceanCondition: 'calm' as MetoceanCondition } : {}),
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

  // Water current (replaced within seconds by the live Open-Meteo feed)
  currentFlowPower: 'moderate',
  currentSpeedKnots: 1.2,
  currentDirectionDeg: 45,
  currentDirectionLabel: 'NE (045°)',
  tidePhase: 'flood',
  tidePhaseIndex: 0,
  isDynamicTideCycling: true,
  dynamicTideSecondsRemaining: 60,

  setCurrentFlowPower: (power) => {
    // Surface-current regimes for the block (same as the tidal fallback in DynamicTideEngine)
    let speed = 1.2;
    let metocean: MetoceanCondition = 'calm';
    let tide: TidePhase = 'flood';

    if (power === 'slow') {
      speed = 0.3;
      metocean = 'calm';
      tide = 'slack';
    } else if (power === 'moderate') {
      speed = 1.2;
      metocean = 'calm';
      tide = 'flood';
    } else if (power === 'fast') {
      speed = 2.0;
      metocean = 'monsoon';
      tide = 'flood';
    } else if (power === 'extreme') {
      speed = 2.8;
      metocean = 'cyclonic';
      tide = 'spring_surge';
    } else if (power === 'storm') {
      speed = 3.5;
      metocean = 'cyclonic';
      tide = 'spring_surge';
    }

    set({
      currentFlowPower: power,
      currentSpeedKnots: speed,
      metoceanCondition: metocean,
      tidePhase: tide,
      isDynamicTideCycling: false,
    });
  },

  setCurrentSpeedKnots: (speed) => {
    let power: CurrentFlowPower = 'moderate';
    let metocean: MetoceanCondition = 'calm';

    if (speed < 0.75) {
      power = 'slow';
      metocean = 'calm';
    } else if (speed < 1.6) {
      power = 'moderate';
      metocean = 'calm';
    } else if (speed < 2.4) {
      power = 'fast';
      metocean = 'monsoon';
    } else if (speed < 3.2) {
      power = 'extreme';
      metocean = 'cyclonic';
    } else {
      power = 'storm';
      metocean = 'cyclonic';
    }

    // A manual setting pauses the live/tidal auto mode so it is not overwritten
    set({ currentSpeedKnots: speed, currentFlowPower: power, metoceanCondition: metocean, isDynamicTideCycling: false });
  },

  setCurrentDirectionDeg: (deg) => {
    set({ currentDirectionDeg: deg, currentDirectionLabel: getDirectionLabel(deg), isDynamicTideCycling: false });
  },

  setDynamicTideCycling: (active) => set({ isDynamicTideCycling: active }),

  // Weather Side Panel
  isWeatherPanelOpen: false,
  setWeatherPanelOpen: (open) => set(open ? { isWeatherPanelOpen: true, isTelemetryDrawerOpen: false } : { isWeatherPanelOpen: false }),
  // The two right-hand panels share one slot: opening one closes the other
  toggleWeatherPanel: () => set((s) => (s.isWeatherPanelOpen ? { isWeatherPanelOpen: false } : { isWeatherPanelOpen: true, isTelemetryDrawerOpen: false })),

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


  isReportModalOpen: false,
  setReportModalOpen: (open) => set({ isReportModalOpen: open }),

  isEodModalOpen: false,
  setEodModalOpen: (open) => set({ isEodModalOpen: open }),

  isPresentationOpen: false,
  setPresentationOpen: (open) => set({ isPresentationOpen: open }),

  isTelemetryDrawerOpen: true,
  toggleTelemetryDrawer: () => set((s) => (s.isTelemetryDrawerOpen ? { isTelemetryDrawerOpen: false } : { isTelemetryDrawerOpen: true, isWeatherPanelOpen: false })),

  isPhysicsModalOpen: false,
  setPhysicsModalOpen: (open) => set({ isPhysicsModalOpen: open }),
  togglePhysicsModal: () => set((s) => ({ isPhysicsModalOpen: !s.isPhysicsModalOpen })),

  // Hardware Connection Mode

  // Dedicated Holographic Part Inspection Modals
  activeHoloModal: null,
  openHoloModal: (comp: HolographicComponentType) => {
    set({
      activeHoloModal: comp,
      selectedSplitPartId: comp,
      selectedAssetId: comp.toUpperCase(),
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      varunaVoice.speakCustom(`Inspecting ${comp.replace(/_/g, ' ')}.`);
    });
  },
  closeHoloModal: () => set({ activeHoloModal: null }),

  // Vision Gesture Technology
  isGestureCameraActive: false,
  cameraPermissionState: 'idle',
  cameraErrorMessage: null,
  gestureDetected: null,
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
  setCameraPermissionState: (status) => set({ cameraPermissionState: status }),
  setCameraErrorMessage: (msg) => set({ cameraErrorMessage: msg }),
  setGestureDetected: (gesture, confidence = 1.0) => {
    const prev = get();
    if (prev.gestureDetected === gesture) {
      return;
    }
    set({ gestureDetected: gesture });
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
          `Opening ${state.targetedPartId?.replace(/_/g, ' ')}.`
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
        `Opening ${nextSubsystem.replace(/_/g, ' ')}.`
      );
    });
  },
  openSubsystemByIndex: (index: number) => {
    const sub = GESTURE_PARTS[index];
    if (!sub) return;
    const state = get();
    state.openHoloModal(sub.part);
    state.setCameraViewMode(sub.part as CameraViewMode);
    state.setSelectedAssetId(sub.asset);
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => varunaVoice.speakCustom(`Opening ${sub.label}.`));
  },

  gestureSelection: null,
  setGestureSelection: (sel) => set({ gestureSelection: sel }),

  cameraNudge: { zoom: 1, seq: 0 },
  nudgeZoom: (factor) => set((s) => ({ cameraNudge: { zoom: factor, seq: s.cameraNudge.seq + 1 } })),

  stepLayer: (dir) => {
    const cur = VIEW_LAYERS.findIndex((l) => l.mode === get().cameraViewMode);
    // From a non-layer view, "down" starts at the top layer and "up" at the bottom
    const next = cur < 0 ? (dir > 0 ? 0 : VIEW_LAYERS.length - 1) : Math.min(VIEW_LAYERS.length - 1, Math.max(0, cur + dir));
    if (next === cur) return;
    set({ cameraViewMode: VIEW_LAYERS[next].mode });
  },

  // Varuna Voice Commander & Wake-Word Architecture
  isVoiceCommanderActive: true,
  isVarunaAwake: false,
  varunaWakeExpiry: 0,
  voiceTranscript: null,
  isListeningSpeech: false,
  micState: 'off',
  micMessage: null,
  setMicState: (micState, micMessage = null) => set({ micState, micMessage }),
  setVoiceCommanderActive: (active) => set({ isVoiceCommanderActive: active }),
  setVoiceTranscript: (transcript) => set({ voiceTranscript: transcript }),
  setIsListeningSpeech: (listening) => set({ isListeningSpeech: listening }),

  wakeVaruna: () => {
    const expiry = Date.now() + 10000; // 10 second active listening window
    set({ isVarunaAwake: true, varunaWakeExpiry: expiry });
    // A 150 ms chime instead of speech: no TTS start-up delay and no echo-guard dead time
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => varunaVoice.playWakeChime());
  },

  sleepVaruna: () => set({ isVarunaAwake: false, varunaWakeExpiry: 0 }),

  // Varuna Exploded / Split View & Pipe Slicing
  isSplitViewActive: false,
  isPipeSliced: false,
  isPipeSliceModalOpen: false,
  selectedSplitPartId: null,

  setSplitViewActive: (active) => {
    set({
      isSplitViewActive: active,
      cameraViewMode: active ? 'split' : 'topside',
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      if (active) {
        varunaVoice.speakCustom('Exploded view. Every assembly is separated; tap one to inspect it.');
      } else {
        varunaVoice.speakCustom('Reassembled.');
      }
    });
  },


  setPipeSliced: (sliced) => {
    set({
      isPipeSliced: sliced,
      cameraViewMode: sliced ? 'pipe1_slice' : 'pipe1',
      isPipeSliceModalOpen: sliced,
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => {
      if (sliced) {
        varunaVoice.speakCustom('Pipe one cross-section, showing the gas and condensate flow inside.');
      } else {
        varunaVoice.speakCustom('Cross-section closed.');
      }
    });
  },

  setPipeSliceModalOpen: (open) => set({ isPipeSliceModalOpen: open }),
  setSelectedSplitPartId: (id) => set({ selectedSplitPartId: id }),

  /** VARUNA-AI voice pipeline: wake word gate -> intent parser (src/voice/VoiceCommandParser.ts) -> action. */
  executeVoiceCommand: (rawCommand: string) => {

    const say = (text: string) => {
      import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) => varunaVoice.speakCustom(text));
    };

    const isCurrentlyAwake = get().isVarunaAwake && Date.now() < get().varunaWakeExpiry;

    // Asleep and no wake word: stay silent
    if (!isCurrentlyAwake && !hasWakeWord(rawCommand)) return;

    const parsed = parseVoiceCommand(rawCommand);

    // Questions about the rig are answered from live telemetry; other questions get a polite refusal
    const answer = answerRigQuestion(stripWakeWord(rawCommand), parsed);
    if (answer) {
      set({ isVarunaAwake: true, varunaWakeExpiry: Date.now() + 12000, voiceTranscript: null });
      return say(answer);
    }

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
      set({ isVarunaAwake: true, varunaWakeExpiry: Date.now() + 10000, voiceTranscript: null });
      import('../voice/VarunaVoiceCommander').then(({ varunaVoiceCommander }) => varunaVoiceCommander.resetDebounce());
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
      openPanel({ cameraViewMode: mode, selectedAssetId: assetId, activeHoloModal: modal, isTelemetryDrawerOpen: true, isWeatherPanelOpen: false }, speech);

    switch (parsed.id) {
      case 'split_view':
        return openPanel(
          { isSplitViewActive: true, cameraViewMode: 'split' },
          'Opening exploded split view. All structural assemblies decoupled.'
        );
      case 'assemble':
        return openPanel(
          {
            isSplitViewActive: false,
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
      case 'presentation':
        return openPanel({ isPresentationOpen: true }, 'Opening the presentation deck.');
      case 'database':
        return openPanel({ isTelemetryDrawerOpen: true, isWeatherPanelOpen: false, isEodModalOpen: true }, 'Opening the six month production ledger.');
      case 'compliance':
        return openPanel({ isReportModalOpen: true }, 'Opening the compliance audit report.');
      case 'physics_report':
        return openPanel({ isPhysicsModalOpen: true }, 'Showing the physics and equations report.');
      case 'weather':
        set({ isWeatherPanelOpen: true, isTelemetryDrawerOpen: false });
        import('../services/KgD6WeatherService').then(({ KgD6WeatherService }) =>
          KgD6WeatherService.getSpokenWeatherForecast().then(say).catch(() => say('Opening the weather panel.'))
        );
        return;
      case 'water_status':
        import('../physics/DynamicTideEngine').then(({ dynamicTideEngine }) => say(dynamicTideEngine.getWaterStatusSpeech()));
        return;
      case 'view_topside':
        return openPanel({ cameraViewMode: 'topside', activeHoloModal: null }, 'Returning to the full rig view.');
      case 'zoom_in':
        get().nudgeZoom(0.6);
        return say('Zooming in.');
      case 'zoom_out':
        get().nudgeZoom(1.65);
        return say('Zooming out.');
      case 'view_subsea':
        return openPanel({ cameraViewMode: 'subsea' }, 'Diving below the waterline.');
      case 'view_manifold':
        return openPanel({ cameraViewMode: 'manifold' }, 'Moving to the seabed manifold.');
      case 'start_camera':
        import('../vision/VarunaGestureEngine').then(({ varunaGestureEngine }) => varunaGestureEngine.start());
        return say('Starting the gesture camera.');
      case 'stop_camera':
        import('../vision/VarunaGestureEngine').then(({ varunaGestureEngine }) => varunaGestureEngine.stop());
        return say('Gesture camera off.');
      case 'close':
        return openPanel(
          {
            activeHoloModal: null,
            isPresentationOpen: false,
            isEodModalOpen: false,
            isReportModalOpen: false,
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
    lastMessage: 'VARUNA-AI online. Monitoring the KG-D6 block.',
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
