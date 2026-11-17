import * as THREE from 'three';

/**
 * Single-hue hologram palette. Every 3D element of the twin is drawn in these cyan tones
 * (no per-subsystem colours); state is communicated with brightness and pulsing instead.
 */
export const HOLO = {
  /** Main glow / edges */
  primary: '#00E5FF',
  /** Bright highlight (selected, alarms) */
  hot: '#BFFBFF',
  /** Mid tone for secondary structure */
  mid: '#0FA3C2',
  /** Faint lattice / grids */
  dim: '#0A4D66',
  /** Scene background & fog */
  background: '#010A14',
} as const;

const cache = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Shared additive, unlit hologram material. Additive blending makes overlapping
 * parts brighten rather than occlude, which is what gives the projected look.
 */
export function holoMaterial(opts: { color?: string; opacity?: number; wireframe?: boolean } = {}): THREE.MeshBasicMaterial {
  const color = opts.color ?? HOLO.primary;
  const opacity = opts.opacity ?? 0.6;
  const wireframe = opts.wireframe ?? false;
  const key = `${color}|${opacity}|${wireframe}`;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      wireframe,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    cache.set(key, mat);
  }
  return mat;
}
