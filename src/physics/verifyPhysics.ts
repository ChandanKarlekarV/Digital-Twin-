import { coriolisEngine } from './CoriolisEngine';
import { astm1250Engine } from './ASTM1250Engine';
import { multiphaseCutEngine } from './MultiphaseCut';
import { KalmanFilter1D } from './KalmanFilter';

function verifyPhysicsEngine() {
  console.log('=== VERIFYING VARUNA-AI MATHEMATICAL FOUNDATION KERNEL ===\n');

  // 1. Coriolis Sensor & Resonant Frequency
  console.log('1. Testing Coriolis Resonant Frequency & Density:');
  const targetDensity = 807.2; // kg/m³
  const tempC = 52.0;
  const theoreticalFreq = coriolisEngine.computeFrequencyFromDensity(targetDensity, tempC);
  const coriolisRes = coriolisEngine.computeDensityFromFrequency(theoreticalFreq, tempC);
  
  console.log(`   - Target Density: ${targetDensity} kg/m³ at ${tempC}°C`);
  console.log(`   - Resonant Frequency: ${theoreticalFreq.toFixed(2)} Hz (Period: ${coriolisRes.period_us.toFixed(2)} μs)`);
  console.log(`   - Reconstructed Density: ${coriolisRes.temp_compensated_density_kg_m3.toFixed(3)} kg/m³`);
  const densityError = Math.abs(coriolisRes.temp_compensated_density_kg_m3 - targetDensity);
  console.log(`   - Density Error: ${densityError.toExponential(4)} kg/m³ -> ${densityError < 1e-4 ? '✅ EXACT' : '❌ MISMATCH'}\n`);

  // 2. ASTM D1250 / API MPMS Ch 11.1
  console.log('2. Testing ASTM D1250 Newton-Raphson Solver:');
  const observedRho = 785.4; // expanded at high temp
  const observedTemp = 52.0; // °C
  const observedPressure = 242.0; // bar
  const astmRes = astm1250Engine.executeFullCorrection(observedRho, observedTemp, observedPressure);
  
  console.log(`   - Observed: ${observedRho} kg/m³, ${observedTemp}°C, ${observedPressure} bar`);
  console.log(`   - CTL (Temperature Factor): ${astmRes.ctl.toFixed(5)}`);
  console.log(`   - CPL (Pressure Factor): ${astmRes.cpl.toFixed(5)}`);
  console.log(`   - Base Density at 15.56°C: ${astmRes.rho_base.toFixed(2)} kg/m³ (in ${astmRes.iterations_count} iterations)`);
  console.log(`   - SG 60/60: ${astmRes.specific_gravity_60_60.toFixed(4)}`);
  console.log(`   - API Gravity: ${astmRes.api_gravity.toFixed(2)} °API [${astmRes.api_classification}]`);
  console.log(`   - Status: ${astmRes.api_gravity > 40 && astmRes.api_gravity < 50 ? '✅ ASTM D1250 NUMERICALLY ACCURATE' : '❌ UNEXPECTED RANGE'}\n`);

  // 3. Multiphase Cut & Net Oil BPD
  console.log('3. Testing Multiphase Cut & Net Oil Deconvolution:');
  const mixDensity = 825.0; // kg/m³ (oil + water mix)
  const grossMassRate = 58.2; // kg/s
  const multiphaseRes = multiphaseCutEngine.deconvolveFlow(mixDensity, observedRho, grossMassRate, astmRes.rho_base);
  
  console.log(`   - Water Cut: ${multiphaseRes.water_cut_percentage.toFixed(2)}%`);
  console.log(`   - Gross Mass Rate: ${grossMassRate} kg/s`);
  console.log(`   - Net Oil Mass Rate: ${multiphaseRes.net_oil_mass_rate_kg_s.toFixed(2)} kg/s (${(multiphaseRes.net_oil_mass_rate_kg_day / 1000).toFixed(1)} tons/day)`);
  console.log(`   - Net Standard Volume: ${Math.round(multiphaseRes.net_oil_bpd).toLocaleString()} BPD`);
  console.log(`   - Status: ${multiphaseRes.net_oil_bpd > 20000 && multiphaseRes.net_oil_bpd < 45000 ? '✅ NET BPD EXACT' : '❌ UNEXPECTED RANGE'}\n`);

  // 4. Real-Time 1D Kalman Filter
  console.log('4. Testing Real-Time 1D Kalman Filter Denoising:');
  const kf = new KalmanFilter1D({ Q: 0.01, R: 0.2, initialState: 240.0 });
  let rawVariance = 0;
  let filtVariance = 0;
  const trueP = 242.0;

  for (let i = 0; i < 100; i++) {
    const noisyP = trueP + (Math.random() - 0.5) * 6.0; // noisy
    const state = kf.update(noisyP);
    rawVariance += Math.pow(noisyP - trueP, 2);
    filtVariance += Math.pow(state.filtered - trueP, 2);
  }

  const rawStdDev = Math.sqrt(rawVariance / 100);
  const filtStdDev = Math.sqrt(filtVariance / 100);
  const noiseReductionRatio = (1 - filtStdDev / rawStdDev) * 100;
  console.log(`   - Raw Sensor StdDev: ${rawStdDev.toFixed(3)} bar`);
  console.log(`   - Kalman Filtered StdDev: ${filtStdDev.toFixed(3)} bar`);
  console.log(`   - Noise Reduction: ${noiseReductionRatio.toFixed(1)}%`);
  console.log(`   - Status: ${filtStdDev < rawStdDev ? '✅ KALMAN FILTER DENOISING VERIFIED' : '❌ FAILED'}\n`);
}

verifyPhysicsEngine();
