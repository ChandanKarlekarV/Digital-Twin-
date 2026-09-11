import { create } from 'zustand';

export type CameraViewMode = 'topside' | 'subsea' | 'manifold' | 'riser' | 'free';
export type ScannerMode = 'normal' | 'thermal' | 'acoustic' | 'gamma' | 'hologram';
export type MetoceanCondition = 'calm' | 'monsoon' | 'cyclonic';
export type EmergencyScenario = 'none' | 'rupture' | 'stuck_drill' | 'hydrate_plug';

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

export type CurrentFlowPower = 'slow' | 'moderate' | 'fast' | 'extreme';
export type TidePhase = 'flood' | 'ebb' | 'slack' | 'spring_surge';

interface RigState {
  // Navigation & View
  cameraViewMode: CameraViewMode;
  setCameraViewMode: (mode: CameraViewMode) => void;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;

  // Custom .OBJ Model Loading (Defaults to Blender untitled.obj)
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
  setEmergencyScenario: (scenario: EmergencyScenario) => void;

  // Water Current, Tides & Flow Dynamics
  currentFlowPower: CurrentFlowPower;
  currentSpeedKnots: number;
  currentDirectionDeg: number;
  currentDirectionLabel: string;
  tidePhase: TidePhase;
  setCurrentFlowPower: (power: CurrentFlowPower) => void;
  setCurrentSpeedKnots: (speed: number) => void;
  setCurrentDirectionDeg: (deg: number) => void;

  // HUD & Drawers
  isCommandDockOpen: boolean;
  setCommandDockOpen: (open: boolean) => void;
  toggleCommandDock: () => void;

  isTelemetryDrawerOpen: boolean;
  setTelemetryDrawerOpen: (open: boolean) => void;
  toggleTelemetryDrawer: () => void;

  isPhysicsModalOpen: boolean;
  setPhysicsModalOpen: (open: boolean) => void;
  togglePhysicsModal: () => void;

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

export const useRigStore = create<RigState>((set) => ({
  cameraViewMode: 'topside',
  setCameraViewMode: (mode) => set({ cameraViewMode: mode }),
  selectedAssetId: 'RISER-ALPHA',
  setSelectedAssetId: (id) => set({ selectedAssetId: id, isTelemetryDrawerOpen: !!id }),

  customObjUrl: '/models/untitled.obj',
  customObjFileName: 'untitled.obj',
  setCustomObjUrl: (url, fileName) =>
    set({
      customObjUrl: url,
      customObjFileName: fileName || (url ? 'Custom Rig Model (.obj)' : null),
    }),

  scannerMode: 'hologram',
  setScannerMode: (mode) => set({ scannerMode: mode }),

  metoceanCondition: 'calm',
  setMetoceanCondition: (condition) => set({ metoceanCondition: condition }),
  emergencyScenario: 'none',
  setEmergencyScenario: (scenario) => set({ emergencyScenario: scenario }),

  // Water Current, Tides & Flow Dynamics (Default: Moderate NE flow at 2.4 kt)
  currentFlowPower: 'moderate',
  currentSpeedKnots: 2.4,
  currentDirectionDeg: 45,
  currentDirectionLabel: 'NE (045°)',
  tidePhase: 'flood',

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
    } else {
      power = 'extreme';
      metocean = 'cyclonic';
    }

    set({ currentSpeedKnots: speed, currentFlowPower: power, metoceanCondition: metocean });
  },

  setCurrentDirectionDeg: (deg) => {
    set({ currentDirectionDeg: deg, currentDirectionLabel: getDirectionLabel(deg) });
  },

  isCommandDockOpen: false,
  setCommandDockOpen: (open) => set({ isCommandDockOpen: open }),
  toggleCommandDock: () => set((s) => ({ isCommandDockOpen: !s.isCommandDockOpen })),

  isTelemetryDrawerOpen: true,
  setTelemetryDrawerOpen: (open) => set({ isTelemetryDrawerOpen: open }),
  toggleTelemetryDrawer: () => set((s) => ({ isTelemetryDrawerOpen: !s.isTelemetryDrawerOpen })),

  isPhysicsModalOpen: false,
  setPhysicsModalOpen: (open) => set({ isPhysicsModalOpen: open }),
  togglePhysicsModal: () => set((s) => ({ isPhysicsModalOpen: !s.isPhysicsModalOpen })),

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
