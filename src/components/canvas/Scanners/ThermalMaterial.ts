import * as THREE from 'three';

/**
 * Thermal DTS (Distributed Temperature Sensing) Material
 * Applies an Inferno/Ironbow false-color temperature map with radial heat dissipation.
 */

const ThermalVertexShader = `
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const ThermalFragmentShader = `
uniform float uTime;
uniform float uCoreTemp;     // e.g. 85.0 °C
uniform float uAmbientTemp;  // e.g. 3.5 °C

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

// Inferno / Ironbow false color ramp
vec3 inferno(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.05, 0.03, 0.53); // Deep ocean cold 3.5°C
  vec3 c1 = vec3(0.42, 0.00, 0.66); // Cool pipe jacket
  vec3 c2 = vec3(0.70, 0.16, 0.56); // Warm boundary
  vec3 c3 = vec3(0.90, 0.40, 0.20); // Hot fluid 60°C
  vec3 c4 = vec3(0.98, 0.95, 0.22); // Core fluid 85°C

  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);

  // Depth-dependent temperature gradient (hotter at seabed, cooling upwards)
  float depthFactor = clamp((-vWorldPosition.y) / 120.0, 0.0, 1.0);
  float internalHeat = mix(0.45, 0.95, depthFactor);

  // Heat pulse pulsation
  float heatPulse = sin(vWorldPosition.y * 0.2 + uTime * 2.0) * 0.05;
  float normalizedTemp = clamp(internalHeat + heatPulse - rim * 0.35, 0.0, 1.0);

  vec3 thermalColor = inferno(normalizedTemp);

  // Core glow
  thermalColor += vec3(0.3, 0.1, 0.0) * pow(1.0 - rim, 2.0);

  gl_FragColor = vec4(thermalColor, 0.95);
}
`;

export function createThermalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ThermalVertexShader,
    fragmentShader: ThermalFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uCoreTemp: { value: 85.0 },
      uAmbientTemp: { value: 3.5 },
    },
    transparent: true,
  });
}
