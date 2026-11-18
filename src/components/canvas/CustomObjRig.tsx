import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useRigStore } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { createHolographicMaterial } from '../../shaders/HolographicMaterial';
import { HOLO } from '../../shaders/HoloPalette';
import { SubseaPipelineFlowNetwork } from './SubseaPipelineFlowNetwork';
import { HoloSeabed } from './HoloSeabed';
import {
  rigModelCache,
  RigPart,
  RigParts,
  RigPartId,
  MODEL_SCALE,
  WATER_LINE_OBJ_Y,
  SEABED_WORLD_Y,
} from '../../services/RigModelCache';

interface CustomObjRigProps {
  objUrl: string;
}

/** Not drawn: the model's base slab and ground block (oversized glowing land) and loose debris */
const HIDDEN_IN_SCENE = new Set<RigPartId>(['manifold', 'seabed_block', 'debris']);

/** Visual turns per real revolution: 120 RPM shown at a readable 1 rev/s */
const SPIN_DISPLAY_SCALE = 0.5;
const NOMINAL_RPM = 120;

/** Diagnostic spoken / telemetry asset when a part is clicked in the assembled rig */
const PART_ASSET: Record<RigPartId, string> = {
  helipad: 'TOPSIDE-DRILL-RIG',
  crane1: 'CRANE-SYSTEM',
  crane2: 'CRANE-SYSTEM',
  accommodation: 'TOPSIDE-DRILL-RIG',
  upper_rig: 'DRILL-SYSTEM',
  industrial_pipes: 'TOPSIDE-DRILL-RIG',
  main_deck: 'TOPSIDE-DRILL-RIG',
  jackup_legs: 'PILLAR-FOUNDATION',
  seabed_block: 'SUBSEA-BEDROCK',
  columns: 'PILLAR-FOUNDATION',
  subsea: 'MANIFOLD-D6-MAIN',
  debris: 'TOPSIDE-DRILL-RIG',
  manifold: 'MANIFOLD-D6-MAIN',
  casing: 'DRILL-SYSTEM',
  drill: 'DRILL-SYSTEM',
};

/**
 * KG-D6 platform as a single-hue hologram, built from its physical sub-assemblies.
 * Assembled, the parts sit exactly where the model has them; in exploded view every
 * part slides out along its own offset (derrick up, modules outward, subsea down,
 * casing off the drill string). The model's own drill string and bit spin at live RPM.
 */
export const CustomObjRig: React.FC<CustomObjRigProps> = ({ objUrl }) => {
  const [rigParts, setRigParts] = useState<RigParts | null>(null);
  const [rigCenter, setRigCenter] = useState<THREE.Vector3 | null>(null);
  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const anyPanelOpen = useRigStore(
    (s) =>
      !!s.activeHoloModal ||
      s.isEodModalOpen ||
      s.isPresentationOpen ||
      s.isReportModalOpen ||
      s.isPhysicsModalOpen ||
      s.isPipeSliceModalOpen
  );
  const selectedSplitPartId = useRigStore((s) => s.selectedSplitPartId);

  const wholeRigGroupRef = useRef<THREE.Group>(null);
  const partGroupRefs = useRef<Partial<Record<RigPartId, THREE.Group | null>>>({});
  const drillSpinRef = useRef<THREE.Group>(null);
  const explode = useRef(0);

  // Three layers per part: a solid lit body (casts/receives shadows, gives depth when zoomed),
  // a Fresnel rim glow, and crisp baked feature edges that stay sharp at any zoom.
  const materials = useMemo(() => {
    const body = (color: string) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: '#03141D',
        roughness: 0.55,
        metalness: 0.35,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
    const edge = (color: string, opacity: number) =>
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    return {
      body: body('#0B2A3A'),
      bodySelected: body('#145A75'),
      glow: createHolographicMaterial({ baseColor: '#000000', glowColor: HOLO.primary, opacity: 0.55, scanlineFreq: 1.2, glowIntensity: 1.3 }),
      glowHot: createHolographicMaterial({ baseColor: '#000000', glowColor: HOLO.hot, opacity: 0.7, scanlineFreq: 2.0, glowIntensity: 1.8 }),
      edge: edge(HOLO.primary, 0.75),
      edgeHot: edge(HOLO.hot, 1.0),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    rigModelCache
      .preload(objUrl)
      .then((data) => {
        if (cancelled) return;
        setRigCenter(data.center.clone());
        setRigParts(rigModelCache.getParts(objUrl));
      })
      .catch(console.warn);
    return () => {
      cancelled = true;
    };
  }, [objUrl]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    materials.glow.uniforms.uTime.value = t;
    materials.glowHot.uniforms.uTime.value = t;

    // Exploded-view easing (~0.6 s)
    const target = useRigStore.getState().isSplitViewActive ? 1 : 0;
    explode.current += (target - explode.current) * Math.min(1, delta * 4);
    const f = explode.current;
    const ease = f * f * (3 - 2 * f);
    rigParts?.parts.forEach((p) => {
      const g = partGroupRefs.current[p.id];
      if (g) g.position.copy(p.explodeOffset).multiplyScalar(ease);
    });

    // Drill string + bit spin about the bore axis at live RPM
    const spin = drillSpinRef.current;
    if (spin) {
      const { emergencyScenario, incidentPhase } = useRigStore.getState();
      const isDrillIssue = emergencyScenario === 'drill_damage' || emergencyScenario === 'stuck_drill';
      const rpm = isDrillIssue
        ? Math.max(0, NOMINAL_RPM - 32 * incidentPhase)
        : useTelemetryStore.getState().currentRecord?.drill_rpm ?? NOMINAL_RPM;
      const omega = (rpm / 60) * Math.PI * 2 * SPIN_DISPLAY_SCALE;
      if (isDrillIssue && incidentPhase >= 3) {
        spin.rotation.y += Math.sin(t * 40) * 0.01; // stalled: torsional vibration only
      } else if (isDrillIssue) {
        spin.rotation.y += delta * omega * (0.5 + 0.5 * Math.max(0, Math.sin(t * 3))); // stick-slip
      } else {
        spin.rotation.y += delta * omega;
      }
    }

    // Platform heave/pitch during a weather squall
    const g = wholeRigGroupRef.current;
    if (!g) return;
    const { emergencyScenario, incidentPhase } = useRigStore.getState();
    if (emergencyScenario === 'weather_squall') {
      g.rotation.z = Math.sin(t * 1.5) * 0.015 * incidentPhase;
      g.rotation.x = Math.cos(t * 1.2) * 0.012 * incidentPhase;
      g.position.y = Math.sin(t * 2.0) * 0.25 * incidentPhase;
    } else if (g.rotation.z !== 0 || g.position.y !== 0) {
      g.rotation.set(0, 0, 0);
      g.position.y = 0;
    }
  });

  if (!rigParts || !rigCenter) return null;

  const onPartClick = (part: RigPart) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const store = useRigStore.getState();
    if (store.isSplitViewActive) {
      // In exploded view a click opens that part's dedicated inspection
      store.setSelectedSplitPartId(part.id);
      store.openHoloModal(part.component);
      return;
    }
    store.setSelectedAssetId(PART_ASSET[part.id]);
    varunaVoice.speakDiagnostic(PART_ASSET[part.id]);
  };

  const renderPart = (p: RigPart) => {
    const hot = selectedSplitPartId === p.id || p.id === 'drill';
    return (
      <>
        <mesh geometry={p.geometry} material={selectedSplitPartId === p.id ? materials.bodySelected : materials.body} castShadow receiveShadow onClick={onPartClick(p)} />
        <mesh geometry={p.geometry} material={hot ? materials.glowHot : materials.glow} renderOrder={2} />
        {p.edges && <lineSegments geometry={p.edges} material={hot ? materials.edgeHot : materials.edge} renderOrder={3} />}
      </>
    );
  };
  const axis = rigParts.drillAxis;

  return (
    <group ref={wholeRigGroupRef}>
      {/* Model space: scaled to metres, rotated to face the default camera, water line at Y = 0 */}
      <group
        scale={MODEL_SCALE}
        position={[-rigCenter.x * MODEL_SCALE, -WATER_LINE_OBJ_Y * MODEL_SCALE, -rigCenter.z * MODEL_SCALE]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        {rigParts.parts.filter((p) => !HIDDEN_IN_SCENE.has(p.id)).map((p) => (
          <group key={p.id} ref={(el) => (partGroupRefs.current[p.id] = el)}>
            {p.id === 'drill' ? (
              // Pivot on the bore axis so the string spins in place
              <group position={[axis.x, 0, axis.y]}>
                <group ref={drillSpinRef}>
                  <group position={[-axis.x, 0, -axis.y]}>{renderPart(p)}</group>
                </group>
              </group>
            ) : (
              renderPart(p)
            )}

            {/* Part label, exploded view only, hidden whenever a panel is open */}
            {isSplitViewActive && !anyPanelOpen && (
              <Html position={p.center.toArray()} center zIndexRange={[20, 0]}>
                <button
                  onClick={() => {
                    const store = useRigStore.getState();
                    store.setSelectedSplitPartId(p.id);
                    store.openHoloModal(p.component);
                  }}
                  className={`whitespace-nowrap px-2 py-0.5 rounded-md border font-mono text-[10px] tracking-wider uppercase backdrop-blur-sm transition-colors ${
                    selectedSplitPartId === p.id
                      ? 'bg-cyan-300/90 text-slate-950 border-white'
                      : 'bg-slate-950/70 text-cyan-200 border-cyan-400/40 hover:border-cyan-300 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              </Html>
            )}
          </group>
        ))}
      </group>
      <SubseaPipelineFlowNetwork />
      <HoloSeabed seabedY={SEABED_WORLD_Y} radius={50} />
    </group>
  );
};
