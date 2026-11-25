// Mobile/iOS GPU VRAM guard: downscales oversized 2D textures before or right after
// creation so total GPU texture memory stays well inside iOS WebKit's ~400 MB tab limit.
// Never invoked on desktop browsers.

const ATLAS_RE = /(plates-|retail-fronts|sentinel|t7-east|talent-wall|tidal-|road-sign|路名牌|花草字|flowerbed|common-footer)/i;
const DETAIL_SLOTS = new Set(['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'alphaMap']);

function isDrawableImage(img) {
  if (!img || typeof img !== 'object') return false;
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }
  if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) {
    return img.width > 0 && img.height > 0;
  }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return img.width > 0 && img.height > 0;
  }
  if (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas) {
    return img.width > 0 && img.height > 0;
  }
  return false;
}

function downscaleImage(img, maxDim) {
  if (!isDrawableImage(img)) return null;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h || (w <= maxDim && h <= maxDim)) return null;
  const scale = maxDim / Math.max(w, h);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, nw, nh);
    return canvas;
  } catch {
    return null;
  }
}

export function compactMobileTexture(tex, slotName = 'map', ownerName = '') {
  if (
    !tex ||
    tex.isDataTexture ||
    tex.isCompressedTexture ||
    tex.isCubeTexture ||
    tex.isFramebufferTexture ||
    tex.isDepthTexture ||
    tex.isRenderTargetTexture ||
    tex.isVideoTexture ||
    tex.isDataArrayTexture ||
    tex.isData3DTexture
  ) return;
  if (tex.userData?.__mobileCompacted) return;
  const img = tex.image;
  if (!isDrawableImage(img)) return;
  const src = img.src || '';
  const hint = `${tex.name || ''} ${ownerName} ${src}`;
  const maxDim = DETAIL_SLOTS.has(slotName) ? 256 : ATLAS_RE.test(hint) ? 1024 : 512;
  const resized = downscaleImage(img, maxDim);
  if (resized) {
    if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
      try { img.close(); } catch {}
    }
    tex.image = resized;
    tex.needsUpdate = true;
  }
  if (tex.anisotropy > 1) tex.anisotropy = 1;
  tex.userData = { ...tex.userData, __mobileCompacted: true };
}

export function compactMobileScene(root) {
  if (!root) return;
  const visited = new Set();
  root.traverse(obj => {
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      if (!m) continue;
      for (const slot of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'alphaMap']) {
        const tex = m[slot];
        if (!tex || visited.has(tex.uuid)) continue;
        visited.add(tex.uuid);
        compactMobileTexture(tex, slot, obj.name || m.name || '');
      }
      if (m.uniforms) {
        for (const [uk, u] of Object.entries(m.uniforms)) {
          const tex = u?.value;
          if (!tex || !tex.isTexture || visited.has(tex.uuid)) continue;
          visited.add(tex.uuid);
          compactMobileTexture(tex, uk, obj.name || '');
        }
      }
    }
  });
}

// Patch TextureLoader & CanvasTexture behavior on mobile so textures loaded asynchronously
// (GLBs, lazy foliage, talent plates) are also downscaled before first GPU upload.
export function installMobileTextureGuard(THREE) {
  if (THREE.TextureLoader.prototype.__mobileGuardInstalled) return;
  THREE.TextureLoader.prototype.__mobileGuardInstalled = true;
  const origLoad = THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    return origLoad.call(this, url, tex => {
      const hint = String(url || '');
      const slot = /(normal|rough|arm|bump|ao)/i.test(hint) ? 'normalMap' : 'map';
      compactMobileTexture(tex, slot, hint);
      if (onLoad) onLoad(tex);
    }, onProgress, onError);
  };
}
