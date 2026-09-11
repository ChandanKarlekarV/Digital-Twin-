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
  // Base tint: either vertex colors or uniform base color
  vec3 base = (uUseVertexColor > 0.5 && length(vColor) > 0.01) ? vColor : uBaseColor;

  // 1. Vertical Sweeping Scanlines
  float scanline = sin(vWorldPosition.y * uScanlineFreq - uTime * 3.5) * 0.5 + 0.5;
  scanline = pow(scanline, 4.0) * 0.35;

  // 2. High-speed Fast Laser Pulse
  float laserPulse = sin(vWorldPosition.y * 0.2 - uTime * 5.0);
  laserPulse = smoothstep(0.85, 1.0, laserPulse) * 0.6;

  // 3. Cyber Wireframe Grid pattern from UV or world coords
  float gridX = abs(fract(vWorldPosition.x * 0.5) - 0.5);
  float gridZ = abs(fract(vWorldPosition.z * 0.5) - 0.5);
  float grid = smoothstep(0.04, 0.0, min(gridX, gridZ)) * 0.25;

  // 4. Fresnel Edge Glow (Intense neon outline)
  vec3 rimGlow = uGlowColor * vFresnel * uGlowIntensity;

  // 5. Breathing ambient glow
  float pulse = sin(uTime * 2.0) * 0.08 + 0.92;

  // Composite holographic color
  vec3 finalColor = base * 0.6 + rimGlow + (uGlowColor * (scanline + laserPulse + grid));
  finalColor *= pulse;

  // Holographic alpha: transparent in center, brightly luminous on silhouette edges
  float alpha = clamp((0.35 + vFresnel * 0.6 + scanline * 0.2 + laserPulse * 0.3) * uOpacity, 0.15, 0.95);

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
