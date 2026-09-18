import * as THREE from 'three';

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
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const OceanFragmentShader = `
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uCameraPosition;
uniform float uIsUnderwater;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vWaveHeight;

void main() {
  vec3 normal = normalize(vNormal);
  if (uIsUnderwater > 0.5) {
    normal = -normal;
  }

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // 1. Fresnel Reflection Factor
  float fresnel = dot(viewDir, normal);
  fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
  fresnel = pow(fresnel, 2.5) * 0.75 + 0.15;

  // 2. Subsurface Scattering / Single-Tone Dark Navy Water Color
  float heightFactor = clamp((vWaveHeight + 1.2) / 2.4, 0.0, 1.0);
  vec3 waterBaseColor = mix(uDeepColor, uShallowColor, heightFactor * 0.35);

  // 3. Sun Specular Highlights
  vec3 lightDir = normalize(uSunDirection);
  vec3 halfVector = normalize(lightDir + viewDir);
  float NdotH = max(dot(normal, halfVector), 0.0);
  float specular = pow(NdotH, 96.0) * 1.5;
  vec3 specularColor = uSunColor * specular;

  // 4. Subtle Crest Wave Highlights
  float foamFactor = smoothstep(0.95, 1.5, vWaveHeight);
  vec3 finalColor = mix(waterBaseColor, uFoamColor, foamFactor * 0.3);

  finalColor = mix(finalColor, uShallowColor * 1.1, fresnel * 0.3);
  finalColor += specularColor;

  // Transparent Water: Allows seeing submerged drill string and columns seamlessly in unified dark navy
  float opacity = uIsUnderwater > 0.5 ? 0.40 : 0.45;
  gl_FragColor = vec4(finalColor, opacity);
}
`;

export function createOceanMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: OceanVertexShader,
    fragmentShader: OceanFragmentShader,
    transparent: true,
    depthWrite: false, // Prevents depth occlusion of transparent water
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uWaveHeightScale: { value: 1.0 },
      uWaveA: { value: new THREE.Vector4(1.0, 0.2, 0.22, 45.0) },
      uWaveB: { value: new THREE.Vector4(0.8, 0.6, 0.15, 28.0) },
      uWaveC: { value: new THREE.Vector4(-0.4, 0.9, 0.10, 16.0) },
      uWaveD: { value: new THREE.Vector4(0.3, -0.95, 0.06, 9.0) },
      uDeepColor: { value: new THREE.Color('#010C1E') },
      uShallowColor: { value: new THREE.Color('#021838') },
      uFoamColor: { value: new THREE.Color('#00E5FF') },
      uSunDirection: { value: new THREE.Vector3(60, 100, 50).normalize() },
      uSunColor: { value: new THREE.Color('#FFFFFF') },
      uCameraPosition: { value: new THREE.Vector3(0, 0, 0) },
      uIsUnderwater: { value: 0.0 },
    },
  });
}
