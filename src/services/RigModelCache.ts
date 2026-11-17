import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { HolographicComponentType } from '../store/useRigStore';

/** Built-in rig, pre-baked from rig.obj by scripts/convert-rig-model.mjs */
export const DEFAULT_RIG_URL = '/models/rig.bin.gz';

export interface CachedRigData {
  center: THREE.Vector3;
  drillGeo: THREE.BufferGeometry | null;
  manifoldGeo: THREE.BufferGeometry | null;
  topsideGeo: THREE.BufferGeometry | null;
  /** Baked feature-edge vertex pairs (built-in model only) */
  drillEdges?: Uint32Array | null;
  manifoldEdges?: Uint32Array | null;
  topsideEdges?: Uint32Array | null;
  /** Baked per-triangle / per-edge part labels for the topside (built-in model only) */
  topsideTriLabels?: Uint8Array | null;
  topsideEdgeLabels?: Uint8Array | null;
  labelNames?: string[];
}

// ---- Model placement shared by the scene (OBJ units -> metres) ----
export const MODEL_SCALE = 45.0;
export const WATER_LINE_OBJ_Y = -0.22;
/** World Y of the mudline (≈ -16 m) */
export const SEABED_WORLD_Y = (-0.585 - WATER_LINE_OBJ_Y) * MODEL_SCALE;

/** Physical sub-assemblies the rig is split into (for the exploded view and part inspection). */
export type RigPartId =
  | 'helipad'
  | 'crane1'
  | 'crane2'
  | 'accommodation'
  | 'upper_rig'
  | 'industrial_pipes'
  | 'main_deck'
  | 'jackup_legs'
  | 'columns'
  | 'subsea'
  | 'debris'
  | 'seabed_block'
  | 'manifold'
  | 'casing'
  | 'drill';

export interface RigPart {
  id: RigPartId;
  label: string;
  /** Inspection modal opened for this part */
  component: HolographicComponentType;
  /** Shares position/normal attributes with the source mesh; own index of this part's triangles */
  geometry: THREE.BufferGeometry;
  /** Centre in OBJ (model-local) space */
  center: THREE.Vector3;
  /** Feature edges (crisp CAD lines) of this part, or null for imported models */
  edges: THREE.BufferGeometry | null;
  /** Exploded-view displacement in OBJ space */
  explodeOffset: THREE.Vector3;
}

export interface RigParts {
  parts: RigPart[];
  /** Drill bore axis (x, z) in OBJ space — the drill part spins about it */
  drillAxis: THREE.Vector2;
}

interface BinMeshInfo {
  vertexCount: number;
  indexCount: number;
  indexType: 'u16' | 'u32';
  position: { offset: number; min?: number[]; step?: number[] };
  normal: { offset: number };
  index: { offset: number };
  edgeCount?: number;
  edges?: { offset: number };
  triLabels?: { offset: number } | null;
  edgeLabels?: { offset: number } | null;
}

const PART_META: Record<RigPartId, { label: string; component: HolographicComponentType }> = {
  helipad: { label: 'Helideck', component: 'helipad' },
  crane1: { label: 'Crane 1', component: 'crane1' },
  crane2: { label: 'Crane 2', component: 'crane2' },
  accommodation: { label: 'Accommodation & Process Modules', component: 'accommodation' },
  upper_rig: { label: 'Central Derrick Tower', component: 'upper_rig' },
  industrial_pipes: { label: 'Process Piping', component: 'industrial_pipes' },
  main_deck: { label: 'Control Dock & Main Deck', component: 'command_dock' },
  jackup_legs: { label: 'Jacket Legs', component: 'jackup_legs' },
  columns: { label: 'Support Legs', component: 'jackup_legs' },
  subsea: { label: 'Subsea Equipment', component: 'wells1_7' },
  debris: { label: 'Loose Fragments', component: 'main_deck' },
  seabed_block: { label: 'Seabed Block', component: 'jackup_legs' },
  manifold: { label: 'Subsea Manifold', component: 'wells1_7' },
  casing: { label: 'Well Casing', component: 'drill' },
  drill: { label: 'Drill String & Bit', component: 'drill_string' },
};

/** Which part the inspection modal shows for each component type */
export const COMPONENT_TO_PART: Partial<Record<HolographicComponentType, RigPartId>> = {
  helipad: 'helipad',
  crane1: 'crane1',
  crane2: 'crane2',
  accommodation: 'accommodation',
  upper_rig: 'upper_rig',
  motor: 'upper_rig',
  industrial_pipes: 'main_deck',
  command_dock: 'main_deck',
  main_deck: 'main_deck',
  jackup_legs: 'columns',
  drill: 'casing',
  drill_string: 'drill',
  drill_bit: 'drill',
  wells1_7: 'manifold',
  well1: 'manifold',
  well2: 'manifold',
  well3: 'manifold',
  well4: 'manifold',
  well5: 'manifold',
  well6: 'manifold',
  well7: 'manifold',
};

/** Topside triangle -> sub-assembly, by its centroid in OBJ space */
function classifyTopside(x: number, y: number, z: number): RigPartId {
  const distXZ = Math.hypot(x, z);
  const distHelipad = Math.hypot(x - 0.12, z + 0.5);
  // Diorama ground block under the mudline: full footprint
  if (y < -0.575) return 'seabed_block';
  if (y < 0.05) return 'jackup_legs';
  if (y > 0.28 && distHelipad < 0.28) return 'helipad';
  if (y > 0.32 && distXZ < 0.16) return 'upper_rig';
  if (y > 0.18 && (x < -0.09 || (z < -0.1 && x < 0.05))) return 'crane1';
  if (y > 0.18 && x > 0.09 && z < 0.15) return 'crane2';
  if (y > 0.08 && y < 0.32 && z > 0.12 && x > -0.05) return 'accommodation';
  // Process piping on the deck stays with the deck rather than becoming a loose fragment
  return 'main_deck';
}

// Drill bore axis and radii measured from the built-in model (OBJ units):
// drill string r ≈ 0.03–0.05, casing wall r ≥ 0.09, bit petals reach r ≈ 0.12 below y = -1.97
const DRILL_AXIS = new THREE.Vector2(0.004, -0.031);
const DRILL_STRING_MAX_R = 0.075;
const BIT_TOP_Y = -1.97;
const BIT_MAX_R = 0.12;

function getIndex(geo: THREE.BufferGeometry): ArrayLike<number> {
  if (geo.index) return geo.index.array;
  const n = geo.attributes.position.count;
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  return idx;
}

/**
 * Splits a geometry's triangles (and its baked feature edges) into groups; every result
 * shares the source vertex buffer, so the split costs only new index arrays.
 */
function splitByTriangle<K extends string>(
  geo: THREE.BufferGeometry,
  pick: (cx: number, cy: number, cz: number, tri: number) => K,
  edgePairs?: Uint32Array | null,
  pickEdge?: (edge: number) => K
) {
  const pos = geo.attributes.position;
  const edgeBuckets = new Map<K, number[]>();
  if (edgePairs) {
    for (let e = 0; e < edgePairs.length; e += 2) {
      const a = edgePairs[e], b = edgePairs[e + 1];
      const k = pickEdge
        ? pickEdge(e / 2)
        : pick((pos.getX(a) + pos.getX(b)) / 2, (pos.getY(a) + pos.getY(b)) / 2, (pos.getZ(a) + pos.getZ(b)) / 2, -1);
      let list = edgeBuckets.get(k);
      if (!list) edgeBuckets.set(k, (list = []));
      list.push(a, b);
    }
  }
  const index = getIndex(geo);
  const buckets = new Map<K, number[]>();
  const sums = new Map<K, [number, number, number, number]>();
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const k = pick(cx, cy, cz, t / 3);
    let list = buckets.get(k);
    if (!list) {
      list = [];
      buckets.set(k, list);
      sums.set(k, [0, 0, 0, 0]);
    }
    list.push(a, b, c);
    const s = sums.get(k)!;
    s[0] += cx;
    s[1] += cy;
    s[2] += cz;
    s[3]++;
  }
  const big = pos.count > 65535;
  const out = new Map<K, { geometry: THREE.BufferGeometry; edges: THREE.BufferGeometry | null; center: THREE.Vector3 }>();
  buckets.forEach((list, k) => {
    const edgeList = edgeBuckets.get(k);
    let edges: THREE.BufferGeometry | null = null;
    if (edgeList) {
      edges = new THREE.BufferGeometry();
      edges.setAttribute('position', pos);
      edges.setIndex(new THREE.BufferAttribute(big ? new Uint32Array(edgeList) : new Uint16Array(edgeList), 1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', pos);
    if (geo.attributes.normal) g.setAttribute('normal', geo.attributes.normal);
    g.setIndex(new THREE.BufferAttribute(big ? new Uint32Array(list) : new Uint16Array(list), 1));
    // Bounds of this part only (computeBounding* would measure the whole shared vertex buffer)
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < list.length; i++) box.expandByPoint(v.fromBufferAttribute(pos, list[i]));
    g.boundingBox = box;
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    if (edges) {
      edges.boundingBox = box;
      edges.boundingSphere = g.boundingSphere;
    }
    const s = sums.get(k)!;
    out.set(k, { geometry: g, edges, center: new THREE.Vector3(s[0] / s[3], s[1] / s[3], s[2] / s[3]) });
  });
  return out;
}

class RigModelCache {
  private cache: Map<string, CachedRigData> = new Map();
  private loadPromises: Map<string, Promise<CachedRigData>> = new Map();
  private partsCache: Map<string, RigParts> = new Map();

  public readonly MODEL_SCALE = MODEL_SCALE;
  public readonly WATER_LINE_OBJ_Y = WATER_LINE_OBJ_Y;

  /**
   * Loads the rig once per URL. The built-in rig is a pre-baked binary (no parsing);
   * user-imported files (blob: URLs) still go through OBJLoader.
   */
  public preload(url: string = DEFAULT_RIG_URL): Promise<CachedRigData> {
    const cached = this.cache.get(url);
    if (cached) return Promise.resolve(cached);

    const pending = this.loadPromises.get(url);
    if (pending) return pending;

    const promise = (url === DEFAULT_RIG_URL ? this.loadBinary(url) : this.loadObj(url))
      .then((data) => {
        this.cache.set(url, data);
        return data;
      })
      .catch((err) => {
        this.loadPromises.delete(url);
        console.warn(`Failed to load 3D model ${url}:`, err);
        throw err;
      });

    this.loadPromises.set(url, promise);
    return promise;
  }

  public getCachedData(url: string = DEFAULT_RIG_URL): CachedRigData | null {
    return this.cache.get(url) || null;
  }

  /**
   * The rig split into its physical sub-assemblies (computed once per model, ~50 ms).
   * Each part carries an exploded-view offset pointing away from the rig centre.
   */
  public getParts(url: string = DEFAULT_RIG_URL): RigParts | null {
    const cachedParts = this.partsCache.get(url);
    if (cachedParts) return cachedParts;
    const data = this.getCachedData(url);
    if (!data) return null;

    const parts: RigPart[] = [];
    const add = (id: RigPartId, geometry: THREE.BufferGeometry, edges: THREE.BufferGeometry | null, center: THREE.Vector3) =>
      parts.push({ id, ...PART_META[id], geometry, edges, center, explodeOffset: new THREE.Vector3() });

    if (data.topsideGeo) {
      const tri = data.topsideTriLabels;
      const edge = data.topsideEdgeLabels;
      const names = (data.labelNames ?? []) as RigPartId[];
      // Built-in model: cleaned labels baked by the converter; imported models: region rules
      const split =
        tri && edge && names.length
          ? splitByTriangle(data.topsideGeo, (_x, _y, _z, t) => names[tri[t]], data.topsideEdges, (e) => names[edge[e]])
          : splitByTriangle(data.topsideGeo, classifyTopside, data.topsideEdges);
      split.forEach((p, id) => add(id, p.geometry, p.edges, p.center));
    }
    if (data.manifoldGeo) {
      splitByTriangle(data.manifoldGeo, () => 'manifold' as const, data.manifoldEdges).forEach((p, id) =>
        add(id, p.geometry, p.edges, p.center)
      );
    }
    if (data.drillGeo) {
      splitByTriangle(
        data.drillGeo,
        (x, y, z) => {
          const r = Math.hypot(x - DRILL_AXIS.x, z - DRILL_AXIS.y);
          return r < DRILL_STRING_MAX_R || (y < BIT_TOP_Y && r < BIT_MAX_R) ? 'drill' : 'casing';
        },
        data.drillEdges
      ).forEach((p, id) => add(id, p.geometry, p.edges, p.center));
    }

    // Exploded layout: lift the topside tiers apart, push side modules outward,
    // drop the subsea pieces, and slide the casing off the drill string.
    const topCenter = data.topsideGeo?.boundingSphere?.center ?? new THREE.Vector3();
    const radial = (c: THREE.Vector3, dist: number) => {
      const d = new THREE.Vector2(c.x - topCenter.x, c.z - topCenter.z);
      if (d.lengthSq() < 1e-6) d.set(1, 0);
      d.normalize().multiplyScalar(dist);
      return new THREE.Vector3(d.x, 0, d.y);
    };
    for (const p of parts) {
      switch (p.id) {
        case 'upper_rig':
          p.explodeOffset.set(0, 0.42, 0);
          break;
        case 'helipad':
          p.explodeOffset.copy(radial(p.center, 0.4)).setY(0.22);
          break;
        case 'crane1':
        case 'crane2':
          p.explodeOffset.copy(radial(p.center, 0.38)).setY(0.14);
          break;
        case 'accommodation':
          p.explodeOffset.copy(radial(p.center, 0.36)).setY(0.06);
          break;
        case 'industrial_pipes':
          p.explodeOffset.set(0, 0.2, 0);
          break;
        case 'main_deck':
        case 'seabed_block':
        case 'columns':
        case 'subsea':
        case 'debris':
          break;
        case 'jackup_legs':
          p.explodeOffset.set(0, -0.18, 0);
          break;
        case 'manifold':
          p.explodeOffset.set(0, -0.32, 0);
          break;
        case 'casing':
          p.explodeOffset.set(0.32, -0.38, 0);
          break;
        case 'drill':
          p.explodeOffset.set(0, -0.38, 0);
          break;
      }
    }

    const result = { parts, drillAxis: DRILL_AXIS.clone() };
    this.partsCache.set(url, result);
    return result;
  }

  /** One part of the rig, for the dedicated inspection view. */
  public getPart(url: string, id: RigPartId): RigPart | null {
    return this.getParts(url)?.parts.find((p) => p.id === id) ?? null;
  }

  private async loadBinary(url: string): Promise<CachedRigData> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    let buf = await res.arrayBuffer();
    // Gzip magic (1f 8b): inflate here. A host that already sent Content-Encoding: gzip hands over plain bytes.
    const magic = new Uint8Array(buf, 0, 2);
    if (magic[0] === 0x1f && magic[1] === 0x8b) {
      buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }

    const headerLen = new DataView(buf).getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headerLen))) as {
      center: [number, number, number];
      labels?: string[];
      meshes: Record<string, BinMeshInfo>;
    };
    const base = 4 + headerLen + ((4 - ((4 + headerLen) % 4)) % 4);

    const build = (name: string): THREE.BufferGeometry | null => {
      const m = header.meshes[name];
      if (!m) return null;
      const geo = new THREE.BufferGeometry();
      // v3: uint16 per axis over the bounding box -> float metres
      const { offset, min, step } = m.position;
      let pos: Float32Array;
      if (min && step) {
        const q = new Uint16Array(buf, base + offset, m.vertexCount * 3);
        pos = new Float32Array(q.length);
        for (let i = 0; i < q.length; i++) pos[i] = min[i % 3] + q[i] * step[i % 3];
      } else {
        pos = new Float32Array(buf, base + offset, m.vertexCount * 3);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute(
        'normal',
        new THREE.BufferAttribute(new Int8Array(buf, base + m.normal.offset, m.vertexCount * 3), 3, true)
      );
      const index =
        m.indexType === 'u32'
          ? new Uint32Array(buf, base + m.index.offset, m.indexCount)
          : new Uint16Array(buf, base + m.index.offset, m.indexCount);
      geo.setIndex(new THREE.BufferAttribute(index, 1));
      geo.computeBoundingSphere();
      return geo;
    };

    const bytes = (name: string, key: 'triLabels' | 'edgeLabels', count: (m: BinMeshInfo) => number): Uint8Array | null => {
      const m = header.meshes[name];
      const ref = m?.[key];
      return ref ? new Uint8Array(buf, base + ref.offset, count(m)) : null;
    };

    const edges = (name: string): Uint32Array | null => {
      const m = header.meshes[name];
      return m?.edges && m.edgeCount ? new Uint32Array(buf, base + m.edges.offset, m.edgeCount * 2) : null;
    };

    return {
      center: new THREE.Vector3(...header.center),
      drillGeo: build('model_Mesh'),
      manifoldGeo: build('model1_Mesh'),
      topsideGeo: build('modelfinal_Mesh'),
      drillEdges: edges('model_Mesh'),
      manifoldEdges: edges('model1_Mesh'),
      topsideEdges: edges('modelfinal_Mesh'),
      topsideTriLabels: bytes('modelfinal_Mesh', 'triLabels', (m) => m.indexCount / 3),
      topsideEdgeLabels: bytes('modelfinal_Mesh', 'edgeLabels', (m) => m.edgeCount ?? 0),
      labelNames: header.labels,
    };
  }

  private loadObj(url: string): Promise<CachedRigData> {
    return new Promise((resolve, reject) => {
      new OBJLoader().load(
        url,
        (loadedObj) => {
          const center = new THREE.Box3().setFromObject(loadedObj).getCenter(new THREE.Vector3());
          const byName = new Map<string, THREE.BufferGeometry>();
          let largest: THREE.BufferGeometry | null = null;
          loadedObj.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            byName.set(mesh.name, mesh.geometry);
            if (!largest || mesh.geometry.attributes.position.count > largest.attributes.position.count) {
              largest = mesh.geometry;
            }
          });
          resolve({
            center,
            drillGeo: byName.get('model_Mesh') ?? null,
            manifoldGeo: byName.get('model1_Mesh') ?? null,
            // Arbitrary user models: render the biggest mesh as the topside
            topsideGeo: byName.get('modelfinal_Mesh') ?? largest,
          });
        },
        undefined,
        reject
      );
    });
  }
}

export const rigModelCache = new RigModelCache();
