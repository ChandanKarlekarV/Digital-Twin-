import { TelemetryRecord } from '../types/telemetry';
import { telemetryDb } from '../db/TelemetryDatabase';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useRigStore } from '../store/useRigStore';
import { KalmanFilter1D } from './KalmanFilter';
import { coriolisEngine } from './CoriolisEngine';
import { astm1250Engine } from './ASTM1250Engine';
import { multiphaseCutEngine } from './MultiphaseCut';

interface AssetFilterBank {
  pressure: KalmanFilter1D;
  temperature: KalmanFilter1D;
  frequency: KalmanFilter1D;
  massRate: KalmanFilter1D;
  waterCut: KalmanFilter1D;
}

class TelemetryEmitterService {
  private timerId: number | NodeJS.Timeout | null = null;
  private isRunning = false;
  private tickCount = 0;
  private filterBanks: Map<string, AssetFilterBank> = new Map();

  constructor() {
    this.initFilterBanks();
  }

  private initFilterBanks(): void {
    const assets = [
      'RISER-ALPHA',
      'RISER-BRAVO',
      'MANIFOLD-D6-MAIN',
      'XT-WELLHEAD-01',
      'XT-WELLHEAD-02',
      'TOPSIDE-MPFM-01',
      'TOPSIDE-DRILL-RIG',
    ];

    for (const id of assets) {
      this.filterBanks.set(id, {
        pressure: new KalmanFilter1D({ Q: 0.02, R: 0.25, initialState: 240.0, maxResidualThreshold: 45 }),
        temperature: new KalmanFilter1D({ Q: 0.005, R: 0.08, initialState: 52.0, maxResidualThreshold: 15 }),
        frequency: new KalmanFilter1D({ Q: 0.01, R: 0.15, initialState: 1245.0, maxResidualThreshold: 20 }),
        massRate: new KalmanFilter1D({ Q: 0.05, R: 0.4, initialState: 55.0, maxResidualThreshold: 30 }),
        waterCut: new KalmanFilter1D({ Q: 0.01, R: 0.1, initialState: 4.5, maxResidualThreshold: 10 }),
      });
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Seed 7-day database in background
    telemetryDb.seedSevenDayHistory().catch(console.error);

    // 10 Hz (100ms) interval timer
    this.timerId = setInterval(() => {
      this.emitTick();
    }, 100);
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }

  private emitTick(): void {
    this.tickCount++;
    const now = Date.now();
    const { selectedAssetId, emergencyScenario } = useRigStore.getState();
    const activeAsset = selectedAssetId || 'RISER-ALPHA';

    const assets = [
      { id: 'RISER-ALPHA', baseP: 242.0, baseT: 52.0, baseMass: 58.2, nominalBpd: 34200 },
      { id: 'RISER-BRAVO', baseP: 238.5, baseT: 50.5, baseMass: 53.6, nominalBpd: 31500 },
      { id: 'MANIFOLD-D6-MAIN', baseP: 255.0, baseT: 68.0, baseMass: 201.0, nominalBpd: 118000 },
      { id: 'XT-WELLHEAD-01', baseP: 278.0, baseT: 78.5, baseMass: 38.0, nominalBpd: 22300 },
      { id: 'XT-WELLHEAD-02', baseP: 282.0, baseT: 81.0, baseMass: 31.5, nominalBpd: 18500 },
      { id: 'TOPSIDE-MPFM-01', baseP: 85.0, baseT: 38.0, baseMass: 201.0, nominalBpd: 118000 },
      { id: 'TOPSIDE-DRILL-RIG', baseP: 180.0, baseT: 45.0, baseMass: 65.0, nominalBpd: 38000 },
    ];

    for (const asset of assets) {
      let filterBank = this.filterBanks.get(asset.id);
      if (!filterBank) {
        this.initFilterBanks();
        filterBank = this.filterBanks.get(asset.id)!;
      }

      // Base physical variables with subtle wave / pump harmonics
      const waveHarmonic = Math.sin(this.tickCount * 0.08) * 0.8;
      const pumpHarmonic = Math.sin(this.tickCount * 0.4) * 0.3;

      let targetP = asset.baseP + waveHarmonic + pumpHarmonic;
      let targetT = asset.baseT + Math.sin(this.tickCount * 0.02) * 0.2;
      let targetMass = asset.baseMass * (1 + (Math.sin(this.tickCount * 0.05) * 0.02));
      let targetWC = 4.2 + Math.sin(this.tickCount * 0.01) * 0.6;
      let statusFlag = 0;

      // Handle emergency scenarios
      if (emergencyScenario === 'rupture' && (asset.id === 'RISER-ALPHA' || asset.id === 'MANIFOLD-D6-MAIN')) {
        // Catastrophic pressure drop & sea water ingress
        targetP = Math.max(15.0, asset.baseP - 68.0 - Math.random() * 8.0);
        targetWC = Math.min(85.0, 48.0 + Math.random() * 10.0);
        targetMass *= 0.35;
        statusFlag = 2; // Critical ESD
      } else if (emergencyScenario === 'stuck_drill' && (asset.id === 'TOPSIDE-DRILL-RIG' || asset.id === 'XT-WELLHEAD-01')) {
        targetP = asset.baseP + 45.0 + Math.random() * 12.0;
        statusFlag = 4; // Drill Lock
      } else if (emergencyScenario === 'hydrate_plug' && (asset.id === 'MANIFOLD-D6-MAIN' || asset.id === 'XT-WELLHEAD-02')) {
        targetT = 3.2 + Math.random() * 0.8; // Freezing seabed
        targetP = asset.baseP + 35.0 + Math.random() * 5.0;
        targetMass *= 0.15;
        statusFlag = 3; // Hydrate alert
      }

      // Inject raw sensor noise & occasional multiphase bubble glitch
      const isGlitch = Math.random() < 0.03; // 3% glitch chance
      const glitchNoise = isGlitch ? (Math.random() - 0.5) * 18.0 : 0;
      const gaussianNoiseP = (Math.random() - 0.5) * 1.8 + glitchNoise;
      const gaussianNoiseT = (Math.random() - 0.5) * 0.6;
      const gaussianNoiseMass = (Math.random() - 0.5) * 1.5;

      const rawP = targetP + gaussianNoiseP;
      const rawT = targetT + gaussianNoiseT;
      const rawMass = Math.max(0, targetMass + gaussianNoiseMass);
      const rawWC = Math.max(0, targetWC + (Math.random() - 0.5) * 0.8);

      // Theoretical frequency for Coriolis tube
      const baseDensity = 807.2; // kg/m³
      const expectedRawDensity = baseDensity * (1 + (rawWC / 100) * 0.24) - (rawT - 15.56) * 0.65;
      const nominalFOsc = coriolisEngine.computeFrequencyFromDensity(expectedRawDensity, rawT);
      const rawFOsc = nominalFOsc + (Math.random() - 0.5) * 2.5 + (isGlitch ? 15.0 : 0);

      // Execute Kalman filtering
      const kP = filterBank.pressure.update(rawP);
      const kT = filterBank.temperature.update(rawT);
      const kFOsc = filterBank.frequency.update(rawFOsc);
      const kMass = filterBank.massRate.update(rawMass);
      const kWC = filterBank.waterCut.update(rawWC);

      // Raw record calculations
      const rawCoriolis = coriolisEngine.computeDensityFromFrequency(rawFOsc, rawT);
      const rawAstm = astm1250Engine.executeFullCorrection(rawCoriolis.temp_compensated_density_kg_m3, rawT, rawP);
      const rawMultiphase = multiphaseCutEngine.deconvolveFlow(
        rawCoriolis.temp_compensated_density_kg_m3,
        rawAstm.rho_base * 0.98,
        rawMass,
        rawAstm.rho_base
      );

      // Filtered record calculations
      const filtCoriolis = coriolisEngine.computeDensityFromFrequency(kFOsc.filtered, kT.filtered);
      const filtAstm = astm1250Engine.executeFullCorrection(filtCoriolis.temp_compensated_density_kg_m3, kT.filtered, kP.filtered);
      const filtMultiphase = multiphaseCutEngine.deconvolveFlow(
        filtCoriolis.temp_compensated_density_kg_m3,
        filtAstm.rho_base * 0.98,
        kMass.filtered,
        filtAstm.rho_base
      );

      const rawRecord: TelemetryRecord = {
        timestamp: now,
        asset_id: asset.id,
        p_line_bar: Number(rawP.toFixed(2)),
        t_line_c: Number(rawT.toFixed(2)),
        f_osc_hz: Number(rawFOsc.toFixed(2)),
        raw_density: Number(rawCoriolis.uncompensated_density_kg_m3.toFixed(2)),
        corrected_density: Number(rawAstm.rho_base.toFixed(2)),
        api_gravity: Number(rawAstm.api_gravity.toFixed(2)),
        water_cut_pct: Number(rawWC.toFixed(2)),
        gross_mass_rate: Number(rawMass.toFixed(2)),
        net_oil_bpd: Number(rawMultiphase.net_oil_bpd.toFixed(1)),
        status_flag: statusFlag,
      };

      const filteredRecord: TelemetryRecord = {
        timestamp: now,
        asset_id: asset.id,
        p_line_bar: Number(kP.filtered.toFixed(2)),
        t_line_c: Number(kT.filtered.toFixed(2)),
        f_osc_hz: Number(kFOsc.filtered.toFixed(2)),
        raw_density: Number(filtCoriolis.uncompensated_density_kg_m3.toFixed(2)),
        corrected_density: Number(filtAstm.rho_base.toFixed(2)),
        api_gravity: Number(filtAstm.api_gravity.toFixed(2)),
        water_cut_pct: Number(kWC.filtered.toFixed(2)),
        gross_mass_rate: Number(kMass.filtered.toFixed(2)),
        net_oil_bpd: Number(filtMultiphase.net_oil_bpd.toFixed(1)),
        status_flag: statusFlag,
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
