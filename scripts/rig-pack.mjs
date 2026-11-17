/**
 * Writes the baked rig (format v3), gzipped:
 *
 *   gzip( [u32 headerByteLength][JSON header][padding to 4][binary chunks...] )
 *
 * Positions are quantised to uint16 per axis over the mesh's bounding box (step < 0.1 mm
 * at world scale) and normals to int8; UVs are not stored (the hologram shaders never
 * sample textures). The browser inflates it with DecompressionStream.
 *
 * meshes: { name: { position: Float32Array, normal: Int8Array, index: Uint16Array|Uint32Array,
 *                   edges: Uint32Array, triLabels?: Uint8Array, edgeLabels?: Uint8Array } }
 */
import zlib from 'zlib';

export function packRig(center, labels, meshes) {
  const header = { version: 3, center, labels, meshes: {} };
  const chunks = [];
  let offset = 0;
  const push = (typed) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) chunks.push(Buffer.alloc(pad));
    offset += pad;
    chunks.push(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
    const at = offset;
    offset += typed.byteLength;
    return { offset: at };
  };

  for (const [name, m] of Object.entries(meshes)) {
    const p = m.position;
    const vertexCount = p.length / 3;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i++) {
      const a = i % 3;
      if (p[i] < min[a]) min[a] = p[i];
      if (p[i] > max[a]) max[a] = p[i];
    }
    const step = min.map((lo, a) => (max[a] - lo) / 65535 || 1);
    const q = new Uint16Array(p.length);
    for (let i = 0; i < p.length; i++) q[i] = Math.round((p[i] - min[i % 3]) / step[i % 3]);

    header.meshes[name] = {
      vertexCount,
      indexCount: m.index.length,
      indexType: m.index instanceof Uint32Array ? 'u32' : 'u16',
      position: { ...push(q), min, step },
      normal: push(m.normal),
      index: push(m.index),
      edgeCount: m.edges.length / 2,
      edges: push(m.edges),
      triLabels: m.triLabels ? push(m.triLabels) : null,
      edgeLabels: m.edgeLabels ? push(m.edgeLabels) : null,
    };
  }

  const json = Buffer.from(JSON.stringify(header));
  const headLen = Buffer.alloc(4);
  headLen.writeUInt32LE(json.length);
  const headPad = Buffer.alloc((4 - ((4 + json.length) % 4)) % 4);
  return zlib.gzipSync(Buffer.concat([headLen, json, headPad, ...chunks]), { level: 9 });
}
