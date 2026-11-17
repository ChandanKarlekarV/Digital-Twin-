import { TelemetryRecord } from '../types/telemetry';
import { telemetryDb } from '../db/TelemetryDatabase';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useRigStore } from '../store/useRigStore';
import { KalmanFilter1D } from './KalmanFilter';
import { coriolisEngine } from './CoriolisEngine';
import { astm1250Engine } from './ASTM1250Engine';
import { multiphaseCutEngine } from './MultiphaseCut';
import { aiIngestionPipeline } from '../services/AiIngestionPipeline';
import { midnightSettlementEngine } from '../services/MidnightSettlementEngine';

const ASSET_BASELINES = [
  { id: 'RISER-ALPHA', baseP: 242.0, baseT: 52.0, baseMass: 58.2, nominalBpd: 34200 },
  { id: 'RISER-BRAVO', baseP: 238.5, baseT: 50.5, baseMass: 53.6, nominalBpd: 31500 },
  { id: 'MANIFOLD-D6-MAIN', baseP: 255.0, baseT: 68.0, baseMass: 201.0, nominalBpd: 118000 },
  { id: 'XT-WELLHEAD-01', baseP: 278.0, baseT: 78.5, baseMass: 38.0, nominalBpd: 22300 },
  { id: 'XT-WELLHEAD-02', baseP: 282.0, baseT: 81.0, baseMass: 31.5, nominalBpd: 18500 },
  { id: 'TOPSIDE-MPFM-01', baseP: 85.0, baseT: 38.0, baseMass: 201.0, nominalBpd: 118000 },
  { id: 'TOPSIDE-DRILL-RIG', baseP: 210.0, baseT: 60.0, baseMass: 65.0, nominalBpd: 38000 },
];

/** KG-D6 condensate base density at 15.56 °C (≈ 43.7 °API) */
const BASE_OIL_DENSITY = 807.2;
const NOMINAL_WATER_CUT = 4.5;

const BRINE_DENSITY = 1025.0;
/** Solution gas-oil ratio, scf of gas per stock-tank barrel */
const GAS_OIL_RATIO_SCF_BBL = 480;

/** In-situ oil density from the PVT line: thermal expansion lowers it ~0.65 kg/m³ per °C. */
function inSituOilDensity(baseDensity: number, tempC: number): number {
  return baseDensity - (tempC - 15.56) * 0.65;
}

/** Volume-weighted oil/brine mixture density seen by the Coriolis tube. */
function expectedMixDensity(baseDensity: number, waterCutPct: number, tempC: number): number {
  const wc = waterCutPct / 100;
  return (1 - wc) * inSituOilDensity(baseDensity, tempC) + wc * BRINE_DENSITY;
}

interface AssetFilterBank {
  pressure: KalmanFilter1D;
  temperature: KalmanFilter1D;
  frequency: KalmanFilter1D;
  massRate: KalmanFilter1D;
  waterCut: KalmanFilter1D;
  drillTorque: KalmanFilter1D;
  drillRop: KalmanFilter1D;
}

/**
 * Ultra-Fast & High-Accuracy 50.0 Hz (20ms) Physics & Sensor Telemetry Emitter
 * Ingests subsea multiphase flows and topside rotary drilling dynamics in real-time.
 */
class TelemetryEmitterService {
  private timerId: number | NodeJS.Timeout | null = null;
  private isRunning = false;
  private tickCount = 0;
  private filterBanks: Map<string, AssetFilterBank> = new Map();
  private autoPhaseTick = 0;
  private samplingIntervalMs = 20; // 50.0 Hz ultra-fast real-time sampling

  constructor() {
    this.initFilterBanks();
  }

  /**
   * Each asset's filters start at that asset's own operating point. (They used to all start at
   * RISER-ALPHA's values, so other assets' readings were rejected as outliers and the display
   * froze at 1245 Hz / 500 kg/m³ / 151 °API.)
   */
  private initFilterBanks(): void {
    for (const asset of ASSET_BASELINES) {
      const density = expectedMixDensity(BASE_OIL_DENSITY, NOMINAL_WATER_CUT, asset.baseT);
      const fOsc = coriolisEngine.computeFrequencyFromDensity(density, asset.baseT);
      this.filterBanks.set(asset.id, {
        pressure: new KalmanFilter1D({ Q: 0.015, R: 0.20, initialState: asset.baseP, maxResidualThreshold: 45 }),
        temperature: new KalmanFilter1D({ Q: 0.003, R: 0.06, initialState: asset.baseT, maxResidualThreshold: 15 }),
        frequency: new KalmanFilter1D({ Q: 0.008, R: 0.12, initialState: fOsc, maxResidualThreshold: 20 }),
        massRate: new KalmanFilter1D({ Q: 0.04, R: 0.35, initialState: asset.baseMass, maxResidualThreshold: 30 }),
        waterCut: new KalmanFilter1D({ Q: 0.008, R: 0.08, initialState: NOMINAL_WATER_CUT, maxResidualThreshold: 10 }),
        drillTorque: new KalmanFilter1D({ Q: 0.02, R: 0.18, initialState: 28.4, maxResidualThreshold: 25 }),
        drillRop: new KalmanFilter1D({ Q: 0.01, R: 0.10, initialState: 12.5, maxResidualThreshold: 15 }),
      });
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Seed 6-Month persistent database in background
    telemetryDb.seedSixMonthHistory().catch(console.error);

    // 2. Start AI Automated Ingestion & Anomaly Detection Pipeline
    aiIngestionPipeline.start();

    // 3. Start 12:00 Midnight Automated EOD Settlement Engine
    midnightSettlementEngine.start();

    // 4. Ultra-Fast 50.0 Hz (20ms) interval timer
    this.timerId = setInterval(() => {
      this.emitTick();
    }, this.samplingIntervalMs);
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    aiIngestionPipeline.stop();
    midnightSettlementEngine.stop();
    this.isRunning = false;
  }

  public getSamplingRateHz(): number {
    return Math.round(1000 / this.samplingIntervalMs);
  }

  private emitTick(): void {
    this.tickCount++;
    const now = Date.now();
    const preciseIso = new Date(now).toISOString();

    const {
      selectedAssetId,
      emergencyScenario,
      incidentPhase,
      isAutoSimulatingPhases,
      nextIncidentPhase,
      setEmergencyScenario,
    } = useRigStore.getState();

    const activeAsset = selectedAssetId || 'RISER-ALPHA';

    // Auto-simulation progression: advance phase every 300 ticks (6 seconds at 50 Hz)
    if (isAutoSimulatingPhases && emergencyScenario !== 'none') {
      this.autoPhaseTick++;
      if (this.autoPhaseTick >= 300) {
        this.autoPhaseTick = 0;
        if (incidentPhase < 4) {
          nextIncidentPhase();
        } else {
          setEmergencyScenario('none', 1);
        }
      }
    } else {
      this.autoPhaseTick = 0;
    }

    for (const asset of ASSET_BASELINES) {
      let filterBank = this.filterBanks.get(asset.id);
      if (!filterBank) {
        this.initFilterBanks();
        filterBank = this.filterBanks.get(asset.id)!;
      }

      // Base physical variables with subtle wave / pump harmonics
      const waveHarmonic = Math.sin(this.tickCount * 0.016) * 0.8;
      const pumpHarmonic = Math.sin(this.tickCount * 0.08) * 0.3;

      let targetP = asset.baseP + waveHarmonic + pumpHarmonic;
      let targetT = asset.baseT + Math.sin(this.tickCount * 0.004) * 0.2;
      let targetMass = asset.baseMass * (1 + Math.sin(this.tickCount * 0.01) * 0.02);
      let targetWC = NOMINAL_WATER_CUT + Math.sin(this.tickCount * 0.002) * 0.6;
      let statusFlag = 0;

      // Drill dynamics baseline
      let targetTorque = 28.4 + Math.sin(this.tickCount * 0.03) * 1.2;
      let targetRop = 12.5 + Math.sin(this.tickCount * 0.02) * 1.5;
      let targetRpm = 120;
      let targetWob = 140;

      // ================= EMERGENCY & ANOMALY INCIDENT INJECTIONS =================
      const pFactor = incidentPhase; // 1 to 4

      switch (emergencyScenario) {
        case 'pipe_blockage':
          if (asset.id === 'MANIFOLD-D6-MAIN' || asset.id === 'RISER-ALPHA') {
            if (pFactor === 1) {
              targetP += 12.0 + Math.random() * 2.0;
              targetMass *= 0.88;
              statusFlag = 1;
            } else if (pFactor === 2) {
              targetP += 34.0 + Math.random() * 4.0;
              targetMass *= 0.62;
              statusFlag = 1;
            } else if (pFactor >= 3) {
              targetP += 72.0 + Math.random() * 6.0;
              targetMass *= 0.15;
              statusFlag = 2; // Critical ESD
            }
          }
          break;

        case 'hydrate_plug':
          if (asset.id === 'MANIFOLD-D6-MAIN' || asset.id === 'XT-WELLHEAD-01') {
            targetT -= 18.0 * pFactor;
            targetP += 22.0 * pFactor;
            targetWC += 3.5 * pFactor;
            statusFlag = pFactor >= 3 ? 2 : 3;
          }
          break;

        case 'stuck_drill':
        case 'drill_damage':
          if (asset.id === 'TOPSIDE-DRILL-RIG') {
            targetTorque += 6.5 * pFactor + (Math.random() - 0.5) * 4.0;
            targetRpm = Math.max(0, 120 - 32 * pFactor);
            targetRop = Math.max(0.5, 12.5 - 3.2 * pFactor);
            statusFlag = pFactor >= 3 ? 4 : 1;
          }
          break;

        case 'rupture':
          if (asset.id === 'RISER-ALPHA' || asset.id === 'MANIFOLD-D6-MAIN') {
            targetP = Math.max(12.0, targetP - 65.0 * pFactor);
            targetMass *= 0.2;
            statusFlag = 2;
          }
          break;
      }

      // Inject raw sensor noise & occasional multiphase bubble glitch
      const isGlitch = Math.random() < 0.015;
      const glitchNoise = isGlitch ? (Math.random() - 0.5) * 14.0 : 0;
      const gaussianNoiseP = (Math.random() - 0.5) * 1.4 + glitchNoise;
      const gaussianNoiseT = (Math.random() - 0.5) * 0.4;
      const gaussianNoiseMass = (Math.random() - 0.5) * 1.1;

      const rawP = targetP + gaussianNoiseP;
      const rawT = targetT + gaussianNoiseT;
      const rawMass = Math.max(0, targetMass + gaussianNoiseMass);
      const rawWC = Math.max(0, targetWC + (Math.random() - 0.5) * 0.6);
      const rawTorque = targetTorque + (Math.random() - 0.5) * 0.8;
      const rawRop = targetRop + (Math.random() - 0.5) * 0.4;

      // Theoretical frequency for Coriolis tube
      const expectedRawDensity = expectedMixDensity(BASE_OIL_DENSITY, rawWC, rawT);
      const nominalFOsc = coriolisEngine.computeFrequencyFromDensity(expectedRawDensity, rawT);
      const rawFOsc = nominalFOsc + (Math.random() - 0.5) * 2.0 + (isGlitch ? 10.0 : 0);

      // Execute Kalman filtering
      const kP = filterBank.pressure.update(rawP);
      const kT = filterBank.temperature.update(rawT);
      const kFOsc = filterBank.frequency.update(rawFOsc);
      const kMass = filterBank.massRate.update(rawMass);
      const kWC = filterBank.waterCut.update(rawWC);
      const kTorque = filterBank.drillTorque.update(rawTorque);
      const kRop = filterBank.drillRop.update(rawRop);

      // Raw record calculations
      const rawCoriolis = coriolisEngine.computeDensityFromFrequency(rawFOsc, rawT);
      const rawAstm = astm1250Engine.executeFullCorrection(rawCoriolis.temp_compensated_density_kg_m3, rawT, rawP);
      // Oil density comes from the PVT line (as in a real MPFM), not from the water-bearing mixture
      const rawMultiphase = multiphaseCutEngine.deconvolveFlow(
        rawCoriolis.temp_compensated_density_kg_m3,
        inSituOilDensity(BASE_OIL_DENSITY, rawT),
        rawMass,
        BASE_OIL_DENSITY,
        BRINE_DENSITY
      );

      // Filtered record calculations
      const filtCoriolis = coriolisEngine.computeDensityFromFrequency(kFOsc.filtered, kT.filtered);
      const filtAstm = astm1250Engine.executeFullCorrection(filtCoriolis.temp_compensated_density_kg_m3, kT.filtered, kP.filtered);
      const filtMultiphase = multiphaseCutEngine.deconvolveFlow(
        filtCoriolis.temp_compensated_density_kg_m3,
        inSituOilDensity(BASE_OIL_DENSITY, kT.filtered),
        kMass.filtered,
        BASE_OIL_DENSITY,
        BRINE_DENSITY
      );

      // net_oil_bpd is already water-free; gross liquid adds the produced water back
      const netBpd = filtMultiphase.net_oil_bpd;
      const producedWater = filtMultiphase.water_bpd;
      const grossBpd = netBpd + producedWater;
      const purifiedBpd = netBpd;
      const associatedGas = (netBpd * GAS_OIL_RATIO_SCF_BBL) / 1e6;

      const rawRecord: TelemetryRecord = {
        timestamp: now,
        precise_time_iso: preciseIso,
        asset_id: asset.id,
        p_line_bar: Number(rawP.toFixed(2)),
        t_line_c: Number(rawT.toFixed(2)),
        f_osc_hz: Number(rawFOsc.toFixed(2)),
        raw_density: Number(rawCoriolis.uncompensated_density_kg_m3.toFixed(2)),
        corrected_density: Number(rawAstm.rho_base.toFixed(2)),
        api_gravity: Number(rawAstm.api_gravity.toFixed(2)),
        water_cut_pct: Number(rawWC.toFixed(2)),
        gross_mass_rate: Number(rawMass.toFixed(2)),
        gross_liquid_bpd: Number((rawMultiphase.net_oil_bpd + rawMultiphase.water_bpd).toFixed(1)),
        net_oil_bpd: Number(rawMultiphase.net_oil_bpd.toFixed(1)),
        purified_oil_bpd: Number(rawMultiphase.net_oil_bpd.toFixed(1)),
        produced_water_bpd: Number(rawMultiphase.water_bpd.toFixed(1)),
        associated_gas_mmscfd: Number(((rawMultiphase.net_oil_bpd * GAS_OIL_RATIO_SCF_BBL) / 1e6).toFixed(2)),
        status_flag: statusFlag,
        drill_rpm: targetRpm,
        drill_torque_knm: Number(rawTorque.toFixed(1)),
        drill_wob_kn: targetWob,
        drill_rop_mhr: Number(rawRop.toFixed(1)),
        drill_spp_bar: 210,
      };

      const filteredRecord: TelemetryRecord = {
        timestamp: now,
        precise_time_iso: preciseIso,
        asset_id: asset.id,
        p_line_bar: Number(kP.filtered.toFixed(2)),
        t_line_c: Number(kT.filtered.toFixed(2)),
        f_osc_hz: Number(kFOsc.filtered.toFixed(2)),
        raw_density: Number(filtCoriolis.uncompensated_density_kg_m3.toFixed(2)),
        corrected_density: Number(filtAstm.rho_base.toFixed(2)),
        api_gravity: Number(filtAstm.api_gravity.toFixed(2)),
        water_cut_pct: Number(kWC.filtered.toFixed(2)),
        gross_mass_rate: Number(kMass.filtered.toFixed(2)),
        gross_liquid_bpd: Number(grossBpd.toFixed(1)),
        net_oil_bpd: Number(netBpd.toFixed(1)),
        purified_oil_bpd: Number(purifiedBpd.toFixed(1)),
        produced_water_bpd: Number(producedWater.toFixed(1)),
        associated_gas_mmscfd: Number(associatedGas.toFixed(2)),
        status_flag: statusFlag,
        drill_rpm: targetRpm,
        drill_torque_knm: Number(kTorque.filtered.toFixed(1)),
        drill_wob_kn: targetWob,
        drill_rop_mhr: Number(kRop.filtered.toFixed(1)),
        drill_spp_bar: 210,
      };

      // Store in memory & IndexedDB database
      telemetryDb.insert(filteredRecord);

      // If this is the active asset selected by user in 3D scene, push to UI state
      if (asset.id === activeAsset) {
        useTelemetryStore.getState().updateTelemetry(rawRecord, filteredRecord);
      }
    }
  }
}

export const telemetryEmitter = new TelemetryEmitterService();
