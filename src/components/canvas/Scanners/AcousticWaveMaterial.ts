import * as THREE from 'three';

/**
 * Acoustic DAS (Distributed Acoustic Sensing) Pulse Material
 * High-contrast wireframe with traveling acoustic frequency waves and Reliance Red stress alerts.
 */

const AcousticVertexShader = `
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

const AcousticFragmentShader = `
uniform float uTime;
uniform float uStressAnomaly; // 0.0 (nominal) to 1.0 (rupture / high turbulence)

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  // Acoustic traveling sonic pulse along vertical Y-axis
  float sonicWave = sin(vWorldPosition.y * 0.8 - uTime * 6.0);
  float pulseIntensity = smoothstep(0.7, 1.0, sonicWave);

  // Micro-crack / stress zone at mid-depth (Y ~ -50)
  float stressZone = smoothstep(12.0, 0.0, abs(vWorldPosition.y + 50.0)) * uStressAnomaly;
  float stressFlash = sin(uTime * 14.0) * 0.5 + 0.5;

  // Base Neon Cyan Acoustic Sonic Grid
  vec3 cyanAcoustic = vec3(0.0, 0.94, 1.0);
  // Reliance Industrial Red Alert
  vec3 relianceRed = vec3(0.93, 0.11, 0.14);

  vec3 color = mix(cyanAcoustic * (0.3 + pulseIntensity * 0.7), relianceRed * 1.5, stressZone * stressFlash);

  // Holographic wireframe grid lines
  float gridLine = step(0.92, fract(vUv.x * 20.0)) + step(0.92, fract(vUv.y * 40.0));
  color += cyanAcoustic * gridLine * 0.5;

  gl_FragColor = vec4(color, 0.88);
}
`;

export function createAcousticWaveMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: AcousticVertexShader,
    fragmentShader: AcousticFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uStressAnomaly: { value: 0.8 },
    },
    wireframe: true,
    transparent: true,
  });
}
