import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { HolographicComponentType } from '../store/useRigStore';

export interface CachedRigData {
  baseGroup: THREE.Group;
  center: THREE.Vector3;
  drillGeo: THREE.BufferGeometry | null;
  manifoldGeo: THREE.BufferGeometry | null;
  topsideGeo: THREE.BufferGeometry | null;
  colorBuffers: Map<string, Float32Array>;
}

class RigModelCache {
  private cache: Map<string, CachedRigData> = new Map();
  private loadPromises: Map<string, Promise<CachedRigData>> = new Map();
  private defaultUrl = '/models/untitled.obj';

  public readonly MODEL_SCALE = 45.0;
  public readonly WATER_LINE_OBJ_Y = -0.22;

  // Cached materials for zero shader compilation overhead
  private highlightMaterials: Map<string, THREE.Material> = new Map();

  /**
   * Asynchronously preloads the OBJ model into RAM and precomputes all vertex buffers
   */
  public preload(url: string = this.defaultUrl): Promise<CachedRigData> {
    if (this.cache.has(url)) {
      return Promise.resolve(this.cache.get(url)!);
    }

    if (this.loadPromises.has(url)) {
      return this.loadPromises.get(url)!;
    }

    const promise = new Promise<CachedRigData>((resolve, reject) => {
      const loader = new OBJLoader();
      loader.load(
        url,
        (loadedObj) => {
          const data = this.processLoadedObject(loadedObj);
          this.cache.set(url, data);
          resolve(data);
        },
        undefined,
        (err) => {
          console.warn(`Failed to preload 3D model ${url}:`, err);
          reject(err);
        }
      );
    });

    this.loadPromises.set(url, promise);
    return promise;
  }

  /**
   * Fast synchronous retrieval if preloaded, or fallback to async promise
   */
  public getCachedData(url: string = this.defaultUrl): CachedRigData | null {
    return this.cache.get(url) || null;
  }

  /**
   * Process raw loaded OBJ: normalize, compute center, extract geometries, and precompute vertex colors
   */
  private processLoadedObject(loadedObj: THREE.Group): CachedRigData {
    const box = new THREE.Box3().setFromObject(loadedObj);
    const center = new THREE.Vector3();
    box.getCenter(center);

    loadedObj.scale.set(this.MODEL_SCALE, this.MODEL_SCALE, this.MODEL_SCALE);
    loadedObj.position.x = -center.x * this.MODEL_SCALE;
    loadedObj.position.y = -this.WATER_LINE_OBJ_Y * this.MODEL_SCALE;
    loadedObj.position.z = -center.z * this.MODEL_SCALE;
    loadedObj.rotation.y = -Math.PI / 2;

    let drillGeo: THREE.BufferGeometry | null = null;
    let manifoldGeo: THREE.BufferGeometry | null = null;
    let topsideGeo: THREE.BufferGeometry | null = null;

    loadedObj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name || '';
        if (name === 'model_Mesh') {
          drillGeo = mesh.geometry.clone();
        } else if (name === 'model1_Mesh') {
          manifoldGeo = mesh.geometry.clone();
        } else if (name === 'modelfinal_Mesh') {
          topsideGeo = mesh.geometry.clone();
        }
      }
    });

    const colorBuffers = new Map<string, Float32Array>();

    if (topsideGeo) {
      this.precomputeColorBuffers(topsideGeo, colorBuffers);
    }

    return {
      baseGroup: loadedObj,
      center,
      drillGeo,
      manifoldGeo,
      topsideGeo,
      colorBuffers,
    };
  }

  /**
   * Precomputes all vertex color buffers in a single pass at load time
   */
  private precomputeColorBuffers(geo: THREE.BufferGeometry, colorBuffers: Map<string, Float32Array>) {
    const pos = geo.attributes.position;
    const count = pos.count;

    // Base colors
    const cDimmed = new THREE.Color('#031526');
    const cHelipadGreen = new THREE.Color('#00FF66');
    const cCrane1Amber = new THREE.Color('#FF9900');
    const cCrane2Pink = new THREE.Color('#FF007F');
    const cAccommodationViolet = new THREE.Color('#9933FF');
    const cProcessPipesCyan = new THREE.Color('#00FFFF');
    const cJackUpLegsTeal = new THREE.Color('#00B4D8');
    const cMainDeckBlue = new THREE.Color('#1976D2');
    const cSubseaAqua = new THREE.Color('#00D2FF');
    const cMotorSky = new THREE.Color('#38BDF8');

    // 1. Full Colored Rig Buffer
    const fullColored = new Float32Array(count * 3);

    // 2. Component highlight buffers
    const targetTypes: HolographicComponentType[] = [
      'helipad',
      'crane1',
      'crane2',
      'accommodation',
      'industrial_pipes',
      'jackup_legs',
      'main_deck',
      'upper_rig',
      'motor',
      'command_dock',
    ];

    const targetBuffers = new Map<string, Float32Array>();
    targetTypes.forEach((t) => targetBuffers.set(t, new Float32Array(count * 3)));

    for (let i = 0; i < count; i += 3) {
      const x0 = pos.getX(i), y0 = pos.getY(i), z0 = pos.getZ(i);
      const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
      const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);

      const cx = (x0 + x1 + x2) / 3;
      const cy = (y0 + y1 + y2) / 3;
      const cz = (z0 + z1 + z2) / 3;
      const distXZ = Math.sqrt(cx * cx + cz * cz);
      const distHelipad = Math.sqrt((cx - 0.12) * (cx - 0.12) + (cz + 0.50) * (cz + 0.50));

      // --- FULL COLORED RIG CLASSIFICATION ---
      let fullChosen = cMainDeckBlue;
      if (cy < 0.05) {
        fullChosen = distXZ < 0.06 ? cSubseaAqua : cJackUpLegsTeal;
      } else {
        if (cy > 0.28 && distHelipad < 0.28) {
          fullChosen = cHelipadGreen;
        } else if (cy > 0.18 && (cx < -0.09 || (cz < -0.10 && cx < 0.05))) {
          fullChosen = cCrane1Amber;
        } else if (cy > 0.18 && cx > 0.09 && cz < 0.15) {
          fullChosen = cCrane2Pink;
        } else if (cy > 0.08 && cy < 0.32 && cz > 0.12 && cx > -0.05 && distHelipad >= 0.28) {
          fullChosen = cAccommodationViolet;
        } else if (cy > 0.06 && cy < 0.30 && Math.abs(cx) <= 0.14 && Math.abs(cz) <= 0.14) {
          fullChosen = cProcessPipesCyan;
        } else if (cy > 0.35 && distXZ < 0.14) {
          fullChosen = cProcessPipesCyan;
        } else {
          fullChosen = cMainDeckBlue;
        }
      }

      for (let j = 0; j < 3; j++) {
        const idx = (i + j) * 3;
        fullColored[idx] = fullChosen.r;
        fullColored[idx + 1] = fullChosen.g;
        fullColored[idx + 2] = fullChosen.b;
      }

      // --- INDIVIDUAL HIGHLIGHT BUFFERS ---
      targetTypes.forEach((type) => {
        const buf = targetBuffers.get(type)!;
        let chosen = cDimmed;

        if (type === 'helipad' && cy > 0.28 && distHelipad < 0.28) {
          chosen = cHelipadGreen;
        } else if (type === 'crane1' && cy > 0.18 && (cx < -0.09 || (cz < -0.10 && cx < 0.05))) {
          chosen = cCrane1Amber;
        } else if (type === 'crane2' && cy > 0.18 && cx > 0.09 && cz < 0.15) {
          chosen = cCrane2Pink;
        } else if (type === 'accommodation' && cy > 0.08 && cy < 0.32 && cz > 0.12 && cx > -0.05 && distHelipad >= 0.28) {
          chosen = cAccommodationViolet;
        } else if (type === 'industrial_pipes' && cy > 0.06 && cy < 0.30 && Math.abs(cx) <= 0.14 && Math.abs(cz) <= 0.14) {
          chosen = cProcessPipesCyan;
        } else if (type === 'jackup_legs' && cy < 0.05) {
          chosen = cJackUpLegsTeal;
        } else if (type === 'main_deck' && cy >= 0.05 && cy <= 0.16) {
          chosen = cMainDeckBlue;
        } else if (type === 'upper_rig' && cy > 0.32 && distXZ < 0.16) {
          chosen = cProcessPipesCyan;
        } else if (type === 'motor' && cy > 0.18 && cy < 0.36 && distXZ < 0.12) {
          chosen = cMotorSky;
        } else if (type === 'command_dock' && cy >= 0.08 && cy <= 0.26) {
          chosen = cProcessPipesCyan;
        }

        for (let j = 0; j < 3; j++) {
          const idx = (i + j) * 3;
          buf[idx] = chosen.r;
          buf[idx + 1] = chosen.g;
          buf[idx + 2] = chosen.b;
        }
      });
    }

    colorBuffers.set('full_colored', fullColored);
    targetBuffers.forEach((buf, key) => colorBuffers.set(key, buf));
  }

  /**
   * Instantly creates a cloned Group with the specified holographic highlight applied
   */
  public getHoloRigGroup(url: string, type: HolographicComponentType): THREE.Group | null {
    const data = this.getCachedData(url);
    if (!data) return null;

    const group = new THREE.Group();
    group.scale.set(this.MODEL_SCALE, this.MODEL_SCALE, this.MODEL_SCALE);
    group.position.x = -data.center.x * this.MODEL_SCALE;
    group.position.y = -this.WATER_LINE_OBJ_Y * this.MODEL_SCALE;
    group.position.z = -data.center.z * this.MODEL_SCALE;
    group.rotation.y = -Math.PI / 2;

    // 1. Drill String Mesh
    if (data.drillGeo) {
      const isTarget = type === 'drill' || type === 'drill_string' || type === 'drill_bit';
      const wireColor = type === 'drill_bit' ? '#FF3300' : type === 'drill_string' ? '#00D2FF' : '#00E5FF';
      const mat = new THREE.MeshStandardMaterial({
        color: isTarget ? wireColor : '#001A33',
        emissive: isTarget ? wireColor : '#001122',
        emissiveIntensity: isTarget ? 3.2 : 0.1,
        wireframe: true,
        transparent: true,
        opacity: isTarget ? 0.95 : 0.1,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(data.drillGeo, mat);
      mesh.name = 'model_Mesh';
      group.add(mesh);
    }

    // 2. Subsea Manifold Mesh
    if (data.manifoldGeo) {
      const isTarget = type.startsWith('well') || type === 'wells1_7';
      const mat = new THREE.MeshStandardMaterial({
        color: isTarget ? '#C084FC' : '#001A33',
        emissive: isTarget ? '#A855F7' : '#001122',
        emissiveIntensity: isTarget ? 3.2 : 0.1,
        wireframe: true,
        transparent: true,
        opacity: isTarget ? 0.95 : 0.1,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(data.manifoldGeo, mat);
      mesh.name = 'model1_Mesh';
      group.add(mesh);
    }

    // 3. Topside Rig Mesh with instant cached vertex colors
    if (data.topsideGeo) {
      const geo = data.topsideGeo.clone();
      const colorBuf = data.colorBuffers.get(type) || data.colorBuffers.get('full_colored');
      if (colorBuf) {
        geo.setAttribute('color', new THREE.BufferAttribute(colorBuf, 3));
      }

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.25,
        metalness: 0.6,
        wireframe: true,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'modelfinal_Mesh';
      group.add(mesh);
    }

    return group;
  }
}

export const rigModelCache = new RigModelCache();
