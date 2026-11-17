import * as THREE from 'three';

/**
 * Advanced Holographic Digital Twin Shader Material
 * Features:
 * - Dynamic Fresnel edge rim illumination
 * - Real-time vertical scanlines and elevation wave sweep
 * - Cybernetic digital grid and vertex color modulation
 * - Translucent holographic projection aesthetics
 */

export const HolographicVertexShader = `
uniform float uTime;
attribute vec3 customColor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
varying float vFresnel;

void main() {
  vUv = uv;
  vColor = customColor;
  
  // Transform normal to world space
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vNormal = worldNormal;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;

  // Compute view vector in world space
  vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
  float ndotv = max(dot(worldNormal, viewDir), 0.0);
  vFresnel = pow(1.0 - ndotv, 2.2);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const HolographicFragmentShader = `
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
uniform float uOpacity;
uniform float uScanlineFreq;
uniform float uGlowIntensity;
uniform float uUseVertexColor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
varying float vFresnel;

void main() {
  // Flat, single-tone body (no rainbow vertex gradient) so the silhouette reads cleanly
  vec3 base = (uUseVertexColor > 0.5 && length(vColor) > 0.01) ? vColor : uBaseColor;

  // Per-fragment Fresnel: crisp edges instead of the interpolated per-vertex smear
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - abs(dot(n, viewDir)), 2.5);

  // Thin, slow scanlines (subtle — texture, not stripes)
  float scan = smoothstep(0.92, 1.0, sin(vWorldPosition.y * uScanlineFreq * 6.0 - uTime * 2.0));

  // One soft sweep band travelling up the structure every few seconds
  float sweepY = mod(uTime * 9.0, 140.0) - 60.0;
  float sweep = exp(-abs(vWorldPosition.y - sweepY) * 0.35) * 0.6;

  vec3 finalColor = base * 0.22
    + uGlowColor * fresnel * uGlowIntensity
    + uGlowColor * (scan * 0.12 + sweep);

  float alpha = clamp((0.18 + fresnel * 0.75 + sweep * 0.3) * uOpacity, 0.08, 0.95);
  gl_FragColor = vec4(finalColor, alpha);
}
`;

export interface HolographicMaterialOptions {
  baseColor?: string | THREE.Color;
  glowColor?: string | THREE.Color;
  opacity?: number;
  scanlineFreq?: number;
  glowIntensity?: number;
  useVertexColor?: boolean;
  wireframe?: boolean;
}

export function createHolographicMaterial(options: HolographicMaterialOptions = {}): THREE.ShaderMaterial {
  const baseColor = options.baseColor ? (typeof options.baseColor === 'string' ? new THREE.Color(options.baseColor) : options.baseColor) : new THREE.Color('#00E5FF');
  const glowColor = options.glowColor ? (typeof options.glowColor === 'string' ? new THREE.Color(options.glowColor) : options.glowColor) : new THREE.Color('#00FFFF');

  return new THREE.ShaderMaterial({
    vertexShader: HolographicVertexShader,
    fragmentShader: HolographicFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false, // Ensures see-through hologram projection layers
    side: THREE.DoubleSide,
    wireframe: options.wireframe ?? false,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: baseColor },
      uGlowColor: { value: glowColor },
      uOpacity: { value: options.opacity ?? 0.85 },
      uScanlineFreq: { value: options.scanlineFreq ?? 0.8 },
      uGlowIntensity: { value: options.glowIntensity ?? 1.8 },
      uUseVertexColor: { value: options.useVertexColor ? 1.0 : 0.0 },
    },
  });
}
