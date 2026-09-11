import * as THREE from 'three';

/**
 * Procedural Industrial Textures for 3D Oil Rig, Subsea Pipes, and Manifolds
 */

export function createSteelPlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base metallic navy/slate
  ctx.fillStyle = '#1A2938';
  ctx.fillRect(0, 0, 512, 512);

  // Panel seams
  ctx.strokeStyle = '#0E1722';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 248);
  ctx.strokeRect(260, 4, 248, 248);
  ctx.strokeRect(4, 260, 248, 248);
  ctx.strokeRect(260, 260, 248, 248);

  // Rivets on seams
  ctx.fillStyle = '#3E546B';
  const rivetPoints = [
    16, 64, 128, 192, 240, 272, 336, 400, 464, 496
  ];
  for (const x of rivetPoints) {
    for (const y of rivetPoints) {
      if (x === 16 || x === 240 || x === 272 || x === 496 || y === 16 || y === 240 || y === 272 || y === 496) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Subtle noise
  for (let i = 0; i < 4000; i++) {
    const nx = Math.random() * 512;
    const ny = Math.random() * 512;
    const val = Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${val + 20}, ${val + 35}, ${val + 50}, 0.15)`;
    ctx.fillRect(nx, ny, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

export function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ED1B24'; // Reliance Industrial Red
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#111827'; // Dark charcoal stripe
  ctx.beginPath();
  for (let i = -256; i < 512; i += 64) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 32, 0);
    ctx.lineTo(i + 32 + 256, 256);
    ctx.lineTo(i + 256, 256);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

export function createGratedMetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#16222F';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#0B1117';
  for (let x = 8; x < 128; x += 16) {
    for (let y = 8; y < 128; y += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

export function createCarbonSteelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Carbon steel gradient
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#1E293B');
  grad.addColorStop(0.5, '#334155');
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Directional brush scratches
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 200; i++) {
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  return texture;
}
