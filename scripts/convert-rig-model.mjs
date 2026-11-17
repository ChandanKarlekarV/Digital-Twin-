/**
 * Offline converter: public/models/rig.obj (59 MB text) -> public/models/rig.bin
 *
 * The browser used to download and parse the 59 MB OBJ on the main thread at
 * every start (several seconds of frozen UI). This bakes the three meshes the
 * app uses into an indexed, quantised binary that loads with zero parsing:
 *
 *   [u32 headerByteLength][JSON header][padding to 4][binary chunks...]
 *
 * Header: { version, center:[x,y,z], meshes: { name: { vertexCount, indexCount,
 *   position:{offset}, normal:{offset}, uv:{offset}|null, index:{offset} } } }
 *
 * Usage: node scripts/convert-rig-model.mjs [input.obj] [output.bin]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2] || path.join(root, 'public/models/rig.obj');
const output = process.argv[3] || path.join(root, 'public/models/rig.bin');

const KEEP = ['model_Mesh', 'model1_Mesh', 'modelfinal_Mesh'];
const EDGE_ANGLE_DEG = 30;

/**
 * Feature edges (as vertex-index pairs into the mesh's own position buffer): open borders and
 * creases sharper than `angleDeg`. Same result as THREE.EdgesGeometry, but baked offline so the
 * browser gets crisp CAD linework without a ~1.5 s computation at load.
 */
function featureEdges(pos, index, angleDeg) {
  const cosThreshold = Math.cos((angleDeg * Math.PI) / 180);
  const q = (i) => `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
  const vkey = new Map();
  const canon = new Uint32Array(pos.length / 3);
  for (let i = 0; i < canon.length; i++) {
    const k = q(i);
    if (!vkey.has(k)) vkey.set(k, i);
    canon[i] = vkey.get(k);
  }
  const edgeMap = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    const tri = [canon[index[t]], canon[index[t + 1]], canon[index[t + 2]]];
    a.fromArray(pos, tri[0] * 3);
    b.fromArray(pos, tri[1] * 3);
    c.fromArray(pos, tri[2] * 3);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    for (let e = 0; e < 3; e++) {
      const v0 = tri[e], v1 = tri[(e + 1) % 3];
      if (v0 === v1) continue;
      const key = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;
      const rec = edgeMap.get(key);
      if (!rec) edgeMap.set(key, { v0, v1, n: n.clone(), count: 1, tri: t / 3 });
      else {
        rec.count++;
        if (rec.count === 2 && rec.n.dot(n) <= cosThreshold) rec.sharp = true;
      }
    }
  }
  const out = [];
  const tris = [];
  for (const r of edgeMap.values()) {
    if (r.count === 1 || r.sharp) {
      out.push(r.v0, r.v1);
      tris.push(r.tri);
    }
  }
  return { pairs: new Uint32Array(out), tris: new Uint32Array(tris), canon };
}

// ---------------- Topside part labelling ----------------
// Labels are baked per triangle so the exploded view gets clean sub-assemblies: initial
// region rules, then neighbour smoothing (removes jagged borders and slivers), then small
// islands are merged into the part they touch, and loose debris is dropped.
const LABELS = ['main_deck', 'helipad', 'crane1', 'crane2', 'accommodation', 'upper_rig', 'columns', 'subsea', 'seabed_block', 'debris'];
const L = Object.fromEntries(LABELS.map((n, i) => [n, i]));

/**
 * Region rules in model (OBJ) space, mapped by inspecting each structure on its own:
 * helideck disc at (0.04, -0.62); derrick at the centre; crane 1 (lattice mast) on the +z side;
 * crane 2 (mast + long boom) between the helideck and the derrick; deck modules elsewhere.
 */
function regionLabel(x, y, z) {
  if (y < -0.575) return L.seabed_block;
  if (y < -0.46) return L.subsea;
  if (y < 0.04) return L.columns;
  if (y > 0.28 && Math.hypot(x - 0.04, z + 0.62) < 0.2) return L.helipad;
  if (y > 0.32 && Math.hypot(x, z) < 0.16) return L.upper_rig;
  if (y > 0.1 && z > 0.12 && x > -0.05) return L.crane1;
  if ((y > 0.2 && x > -0.14 && z < -0.08) || (y > 0.35 && z < -0.08)) return L.crane2;
  if (y > 0.16) return L.accommodation;
  return L.main_deck;
}

function labelTopside(pos, index, canon) {
  const triCount = index.length / 3;
  const labels = new Uint8Array(triCount);
  for (let t = 0; t < triCount; t++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const v = index[t * 3 + k];
      cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2];
    }
    labels[t] = regionLabel(cx / 3, cy / 3, cz / 3);
  }

  // triangle adjacency through shared (position-canonical) vertices
  const vertTris = new Map();
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const v = canon[index[t * 3 + k]];
      let list = vertTris.get(v);
      if (!list) vertTris.set(v, (list = []));
      list.push(t);
    }
  }
  const neighbours = (t, cb) => {
    for (let k = 0; k < 3; k++) for (const n of vertTris.get(canon[index[t * 3 + k]])) if (n !== t) cb(n);
  };
  const fixed = (l) => l === L.columns || l === L.subsea || l === L.seabed_block;

  // 1. majority smoothing of the topside labels (height bands stay fixed)
  for (let pass = 0; pass < 4; pass++) {
    const next = labels.slice();
    const counts = new Uint16Array(LABELS.length);
    for (let t = 0; t < triCount; t++) {
      if (fixed(labels[t])) continue;
      counts.fill(0);
      neighbours(t, (n) => counts[labels[n]]++);
      let best = labels[t], bestN = counts[best];
      for (let l = 0; l < LABELS.length; l++) if (!fixed(l) && counts[l] > bestN) { best = l; bestN = counts[l]; }
      next[t] = best;
    }
    labels.set(next);
  }

  // 2. islands: connected pieces of one label that are not its main body merge into their neighbour
  for (let pass = 0; pass < 3; pass++) {
    const seen = new Uint8Array(triCount);
    const byLabel = new Map();
    for (let t = 0; t < triCount; t++) {
      if (seen[t]) continue;
      const comp = [t];
      seen[t] = 1;
      for (let i = 0; i < comp.length; i++) {
        neighbours(comp[i], (n) => {
          if (!seen[n] && labels[n] === labels[t]) { seen[n] = 1; comp.push(n); }
        });
      }
      const l = labels[t];
      if (!byLabel.has(l)) byLabel.set(l, []);
      byLabel.get(l).push(comp);
    }
    let changed = 0;
    byLabel.forEach((comps, l) => {
      if (l === L.debris) return;
      comps.sort((a, b) => b.length - a.length);
      const keep = fixed(l) ? 0 : 1; // topside parts keep only their largest body
      comps.slice(keep).forEach((comp) => {
        if (fixed(l) && comp.length >= 400) return; // subsea equipment pieces of real size stay
        const counts = new Map();
        comp.forEach((t) => neighbours(t, (n) => {
          if (labels[n] !== l) counts.set(labels[n], (counts.get(labels[n]) || 0) + 1);
        }));
        let best = L.debris, bestN = 0;
        counts.forEach((n, nl) => { if (nl !== L.debris && n > bestN) { best = nl; bestN = n; } });
        // fully disconnected pieces are debris; tiny subsea crumbs too
        if (fixed(l)) best = bestN > 0 && !fixed(best) ? best : L.debris;
        comp.forEach((t) => (labels[t] = best));
        changed++;
      });
    });
    if (!changed) break;
  }

  // 3. whole-mesh debris: loose fragments under 250 triangles
  const seen = new Uint8Array(triCount);
  for (let t = 0; t < triCount; t++) {
    if (seen[t]) continue;
    const comp = [t];
    seen[t] = 1;
    for (let i = 0; i < comp.length; i++) neighbours(comp[i], (n) => { if (!seen[n]) { seen[n] = 1; comp.push(n); } });
    if (comp.length < 250) comp.forEach((x) => (labels[x] = L.debris));
  }
  return labels;
}

console.time('parse');
const obj = new OBJLoader().parse(fs.readFileSync(input, 'utf8'));
console.timeEnd('parse');

const box = new THREE.Box3().setFromObject(obj);
const center = box.getCenter(new THREE.Vector3());

const header = { version: 2, center: center.toArray(), labels: LABELS, meshes: {} };
const chunks = [];
let offset = 0;

const push = (typed) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    offset += pad;
  }
  const at = offset;
  chunks.push(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
  offset += typed.byteLength;
  return { offset: at };
};

obj.traverse((child) => {
  if (!child.isMesh || !KEEP.includes(child.name)) return;

  let geo = child.geometry;
  // Normals are re-quantised to int8, so merge on a coarse key to collapse duplicates
  geo.deleteAttribute('color');
  geo = mergeVertices(geo, 1e-5);
  geo.computeBoundingBox();

  const pos = geo.attributes.position.array;
  const nrmSrc = geo.attributes.normal.array;
  const nrm = new Int8Array(nrmSrc.length);
  for (let i = 0; i < nrmSrc.length; i++) nrm[i] = Math.round(Math.max(-1, Math.min(1, nrmSrc[i])) * 127);

  const uvAttr = geo.attributes.uv;
  const idx = geo.index.array;
  const vertexCount = geo.attributes.position.count;
  const index = vertexCount > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);

  const fe = featureEdges(pos, idx, EDGE_ANGLE_DEG);
  const edges = fe.pairs;
  let triLabels = null;
  let edgeLabels = null;
  if (child.name === 'modelfinal_Mesh') {
    console.time('labels');
    triLabels = labelTopside(pos, idx, fe.canon);
    console.timeEnd('labels');
    edgeLabels = new Uint8Array(fe.tris.length);
    for (let e = 0; e < fe.tris.length; e++) edgeLabels[e] = triLabels[fe.tris[e]];
    const counts = {};
    triLabels.forEach((l) => (counts[LABELS[l]] = (counts[LABELS[l]] || 0) + 1));
    console.log('  part triangles', counts);
  }
  header.meshes[child.name] = {
    vertexCount,
    indexCount: index.length,
    indexType: index instanceof Uint32Array ? 'u32' : 'u16',
    position: push(new Float32Array(pos)),
    normal: push(nrm),
    uv: uvAttr ? push(new Float32Array(uvAttr.array)) : null,
    index: push(index),
    edgeCount: edges.length / 2,
    edges: push(edges),
    triLabels: triLabels ? push(triLabels) : null,
    edgeLabels: edgeLabels ? push(edgeLabels) : null,
  };
  console.log(`${child.name}: ${child.geometry.attributes.position.count} -> ${vertexCount} verts, ${index.length / 3} tris, ${edges.length / 2} edges`);
});

const json = Buffer.from(JSON.stringify(header));
const headLen = Buffer.alloc(4);
headLen.writeUInt32LE(json.length);
const headPad = Buffer.alloc((4 - ((4 + json.length) % 4)) % 4);
fs.writeFileSync(output, Buffer.concat([headLen, json, headPad, ...chunks]));
console.log(`wrote ${output} (${(fs.statSync(output).size / 1e6).toFixed(1)} MB)`);
