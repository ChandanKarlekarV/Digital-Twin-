import * as THREE from 'three';
import { HOLO } from './HoloPalette';

/**
 * Custom GLSL Gerstner Wave Ocean Shader
 * 4-Wave Gerstner displacement with high transparency, Fresnel reflection,
 * subsurface scattering, and specular highlights all around the rig.
 */

export const OceanVertexShader = `
uniform float uTime;
uniform float uWaveHeightScale;
uniform vec4 uWaveA;
uniform vec4 uWaveB;
uniform vec4 uWaveC;
uniform vec4 uWaveD;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;
#include <fog_pars_vertex>

vec3 GerstnerWave(
  vec4 wave, 
  vec3 p, 
  inout vec3 tangent, 
  inout vec3 binormal
) {
  float steepness = wave.z * uWaveHeightScale;
  float wavelength = wave.w;
  float k = 2.0 * 3.14159265 / wavelength;
  float c = sqrt(9.8 / k);
  vec2 d = normalize(wave.xy);
  float f = k * (dot(d, p.xz) - c * uTime * 0.7);
  float a = steepness / k;

  tangent += vec3(
    -d.x * d.x * (steepness * sin(f)),
    d.x * (steepness * cos(f)),
    -d.x * d.y * (steepness * sin(f))
  );
  binormal += vec3(
    -d.x * d.y * (steepness * sin(f)),
    d.y * (steepness * cos(f)),
    -d.y * d.y * (steepness * sin(f))
  );

  return vec3(
    d.x * (a * cos(f)),
    a * sin(f),
    d.y * (a * cos(f))
  );
}

void main() {
  vUv = uv;
  vec3 gridPoint = position;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 p = gridPoint;

  p += GerstnerWave(uWaveA, gridPoint, tangent, binormal);
  p += GerstnerWave(uWaveB, gridPoint, tangent, binormal);
  p += GerstnerWave(uWaveC, gridPoint, tangent, binormal);
  p += GerstnerWave(uWaveD, gridPoint, tangent, binormal);

  vec3 normal = normalize(cross(binormal, tangent));
  vNormal = normal;
  vWaveHeight = p.y;

  vec4 worldPos = modelMatrix * vec4(p, 1.0);
  vWorldPosition = worldPos.xyz;
  vec4 mvPosition = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const OceanFragmentShader = `
uniform vec3 uColor;
uniform float uTime;

varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vWaveHeight;
#include <fog_pars_fragment>

// Anti-aliased thin line where fract(v) crosses 0.5
float isoLine(float v, float width) {
  float d = abs(fract(v) - 0.5);
  float w = fwidth(v) * width;
  return 1.0 - smoothstep(0.0, w, d);
}

void main() {
  // One uniform tone for the whole sea (no depth/fresnel colour split)
  vec3 color = uColor * 0.06;

  // Glowing wave-height contour lines that ride with the swell
  float contour = isoLine(vWaveHeight * 1.6, 1.2);
  // Faint 10 m survey grid anchored to the world
  float grid = max(isoLine(vWorldPosition.x / 10.0 + 0.5, 1.0), isoLine(vWorldPosition.z / 10.0 + 0.5, 1.0));

  color += uColor * (contour * 0.35 + grid * 0.08);
  gl_FragColor = vec4(color, 1.0);
  #include <fog_fragment>
}
`;

/**
 * Hologram sea: additive, so it tints everything below evenly and never darkens part of
 * the view; colour is a single hue, wave shape shows only through contour lines.
 */
export function createOceanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: OceanVertexShader,
    fragmentShader: OceanFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uWaveHeightScale: { value: 1.0 },
      uWaveA: { value: new THREE.Vector4(1.0, 0.2, 0.22, 45.0) },
      uWaveB: { value: new THREE.Vector4(0.8, 0.6, 0.15, 28.0) },
      uWaveC: { value: new THREE.Vector4(-0.4, 0.9, 0.10, 16.0) },
      uWaveD: { value: new THREE.Vector4(0.3, -0.95, 0.06, 9.0) },
      uColor: { value: new THREE.Color(HOLO.primary) },
      uIsUnderwater: { value: 0.0 },
    },
  });
}