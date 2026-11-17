import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EXTRA_DEPTH_OBJ } from '../../services/RigModelCache';

/**
 * Semi-submersible hull under the topside, in model (OBJ) units — modelled after the
 * reference renders: four thick columns standing on two pontoons, tubular X-bracing between
 * the column pairs, eight mooring lines to seabed anchors and the marine riser down to the
 * wellhead. Replaces the model's own underwater columns, which were noisy and broke apart.
 */

// Column centres measured from the model's own columns (x, z)
const COLUMN_X = [-0.28, 0.08];
const COLUMN_Z = [-0.38, 0.28];
const COLUMN_SIZE = 0.21;
const COLUMN_TOP_Y = 0.07; // overlaps into the deck so the joint is closed
const PONTOON_TOP_Y = -0.64;
const PONTOON_HEIGHT = 0.14;
const PONTOON_WIDTH = 0.24;
const PONTOON_Z = [-0.58, 0.48];
const BRACE_R = 0.028;
const SEABED_Y = -0.585 - EXTRA_DEPTH_OBJ;
const MOORING_REACH = 1.05;

export interface HullMaterials {
  body: THREE.Material;
  glow: THREE.Material;
  edge: THREE.Material;
}

/** Tube between two points */
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 12, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function stripToPositionNormal(g: THREE.BufferGeometry) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  return out;
}

export function buildHull() {
  const solids: THREE.BufferGeometry[] = [];
  const columnHeight = COLUMN_TOP_Y - PONTOON_TOP_Y + 0.02;

  // Columns
  for (const x of COLUMN_X) {
    for (const z of COLUMN_Z) {
      const c = new RoundedBoxGeometry(COLUMN_SIZE, columnHeight, COLUMN_SIZE, 4, 0.045);
      c.translate(x, PONTOON_TOP_Y - 0.02 + columnHeight / 2, z);
      solids.push(c);
    }
  }

  // Pontoons (one under each column pair, rounded bow and stern)
  const pontoonLen = PONTOON_Z[1] - PONTOON_Z[0];
  for (const x of COLUMN_X) {
    const p = new RoundedBoxGeometry(PONTOON_WIDTH, PONTOON_HEIGHT, pontoonLen, 4, 0.06);
    p.translate(x, PONTOON_TOP_Y - PONTOON_HEIGHT / 2, (PONTOON_Z[0] + PONTOON_Z[1]) / 2);
    solids.push(p);
  }

  // Bracing between the left and right column pairs: a horizontal brace above the pontoons
  // and an X brace in the same plane, front and back
  const [xl, xr] = COLUMN_X;
  const inner = COLUMN_SIZE / 2 - 0.01;
  for (const z of COLUMN_Z) {
    const lowY = PONTOON_TOP_Y + 0.08;
    const highY = -0.3;
    solids.push(strut(new THREE.Vector3(xl + inner, lowY, z), new THREE.Vector3(xr - inner, lowY, z), BRACE_R * 1.3));
    solids.push(strut(new THREE.Vector3(xl + inner, lowY, z), new THREE.Vector3(xr - inner, highY, z), BRACE_R));
    solids.push(strut(new THREE.Vector3(xl + inner, highY, z), new THREE.Vector3(xr - inner, lowY, z), BRACE_R));
  }
  // Longitudinal braces between front and back columns, near the water line
  for (const x of COLUMN_X) {
    solids.push(strut(new THREE.Vector3(x, -0.3, COLUMN_Z[0] + inner), new THREE.Vector3(x, -0.3, COLUMN_Z[1] - inner), BRACE_R));
  }

  const hull = mergeGeometries(solids.map(stripToPositionNormal))!;
  const edges = mergeGeometries(
    solids.map((g) => new THREE.EdgesGeometry(g, 20))
  )!;

  // Moorings: two lines per column, fanning outward, hanging down and lying flat at the anchor
  const cx = (xl + xr) / 2;
  const cz = (COLUMN_Z[0] + COLUMN_Z[1]) / 2;
  const moorings: THREE.BufferGeometry[] = [];
  for (const x of COLUMN_X) {
    for (const z of COLUMN_Z) {
      const out = new THREE.Vector2(x - cx, z - cz).normalize();
      for (const spread of [-0.35, 0.35]) {
        const dir = out.clone().rotateAround(new THREE.Vector2(), spread);
        const start = new THREE.Vector3(x + out.x * (COLUMN_SIZE / 2), PONTOON_TOP_Y - 0.02, z + out.y * (COLUMN_SIZE / 2));
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          const fall = 1 - (1 - t) * (1 - t); // steep below the fairlead, flat on the seabed
          pts.push(
            new THREE.Vector3(
              start.x + dir.x * MOORING_REACH * t,
              start.y + (SEABED_Y + 0.004 - start.y) * fall,
              start.z + dir.y * MOORING_REACH * t
            )
          );
        }
        moorings.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.013, 8, false));
        // anchor block
        const anchor = new THREE.BoxGeometry(0.05, 0.03, 0.05);
        const end = pts[pts.length - 1];
        anchor.translate(end.x, SEABED_Y + 0.015, end.z);
        moorings.push(anchor);
      }
    }
  }
  const mooring = mergeGeometries(moorings.map(stripToPositionNormal))!;

  return { hull, edges, mooring };
}

interface SemiSubHullProps {
  materials: HullMaterials;
  /** Riser runs from the deck to the wellhead along this (x, z) axis */
  riserAxis: THREE.Vector2;
  /** Hidden while the rig is exploded (they would hang off disconnected) */
  showMoorings: boolean;
  onClick?: (e: any) => void;
}

export const SemiSubHull: React.FC<SemiSubHullProps> = ({ materials, riserAxis, showMoorings, onClick }) => {
  const { hull, edges, mooring } = useMemo(buildHull, []);
  const riserLength = COLUMN_TOP_Y - SEABED_Y;

  return (
    <group>
      <mesh geometry={hull} material={materials.body} castShadow receiveShadow onClick={onClick} />
      <mesh geometry={hull} material={materials.glow} renderOrder={2} />
      <lineSegments geometry={edges} material={materials.edge} renderOrder={3} />

      {showMoorings && (
        <>
          <mesh geometry={mooring} material={materials.body} castShadow />
          <mesh geometry={mooring} material={materials.glow} renderOrder={2} />
          {/* Marine riser: deck to wellhead, with buoyancy collars */}
          <group position={[riserAxis.x, COLUMN_TOP_Y - riserLength / 2, riserAxis.y]}>
            <mesh material={materials.body} castShadow>
              <cylinderGeometry args={[0.022, 0.022, riserLength, 16]} />
            </mesh>
            <mesh material={materials.glow} renderOrder={2}>
              <cylinderGeometry args={[0.022, 0.022, riserLength, 16]} />
            </mesh>
            {[-0.35, -0.1, 0.15, 0.4].map((f) => (
              <mesh key={f} position={[0, f * riserLength, 0]} material={materials.glow} renderOrder={2}>
                <cylinderGeometry args={[0.036, 0.036, 0.05, 16]} />
              </mesh>
            ))}
          </group>
        </>
      )}
    </group>
  );
};
