import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  COVER_DIAGRAMS,
  EARTH_SOUNDS,
  GOLDEN_SOUNDS,
  MUSIC_SOUNDS,
  RING_CHAPTERS,
  type CoverDiagramRegion,
  type GoldenSound,
  type PlateMode
} from "../data/sounds";
import { audioEngine } from "../lib/audioEngine";

export type CameraPreset = "studio" | "overhead" | "closeup";

interface RecordPlateSceneProps {
  activeId: string;
  hoveredId: string | null;
  isPlaying: boolean;
  stylusParked: boolean;
  progress: number;
  plateMode: PlateMode;
  activeDiagramId: string | null;
  cameraPreset: CameraPreset;
  spinLocked: boolean;
  onHoverSector: (id: string | null) => void;
  onSelectSector: (id: string) => void;
  onDropStylus: (id: string, intraBandRatio: number) => void;
  onParkStylus: () => void;
  onSelectDiagram: (diagram: CoverDiagramRegion) => void;
  onToggleCenterPlay: () => void;
}

const DISC_RADIUS = 3.62;
const GROOVE_SURFACE_INNER = 1.155;
const GROOVE_SURFACE_OUTER = 3.555;
const SPINDLE_HOLE_RADIUS = 0.074;
/** Authentic Voyager Golden Record speed: 16⅔ RPM = 3.6 seconds per revolution */
const NOMINAL_OMEGA = (Math.PI * 2) / 3.6;

function formatCueTime(sec: number): string {
  const safe = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * High-contrast warm museum softbox studio environment map (Equirectangular).
 * Real 24k gold (metalness ~0.95) requires dark warm bronze enclosure baffles contrasting
 * against bright warm studio softbox strips so anisotropic grooves gleam instead of washing out.
 */
function createGoldStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // Base warm dark museum enclosure so non-specular gold facets read as deep burnished 24k gold/copper
  const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0.0, "#2E2416");
  baseGrad.addColorStop(0.28, "#1F170D");
  baseGrad.addColorStop(0.52, "#171109");
  baseGrad.addColorStop(0.78, "#241B10");
  baseGrad.addColorStop(1.0, "#120D07");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Soft warm ambient horizon glow
  const horizonGrad = ctx.createLinearGradient(0, h * 0.34, 0, h * 0.66);
  horizonGrad.addColorStop(0, "rgba(255, 232, 185, 0)");
  horizonGrad.addColorStop(0.5, "rgba(232, 196, 128, 0.22)");
  horizonGrad.addColorStop(1, "rgba(255, 232, 185, 0)");
  ctx.fillStyle = horizonGrad;
  ctx.fillRect(0, h * 0.34, w, h * 0.32);

  // Studio softbox helper (creates twin radial specular flares across anisotropic grooves)
  const paintSoftbox = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    innerStop: string,
    midStop: string
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0.08, 0, 0, 1.0);
    g.addColorStop(0.0, innerStop);
    g.addColorStop(0.48, midStop);
    g.addColorStop(1.0, "rgba(255, 244, 214, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Primary key softbox + opposing fill softbox (produces the iconic NASA twin bowtie flare)
  paintSoftbox(w * 0.19, h * 0.22, w * 0.16, h * 0.19, "#FFFFFF", "rgba(255, 246, 222, 0.78)");
  paintSoftbox(w * 0.69, h * 0.25, w * 0.15, h * 0.17, "#FFFDF6", "rgba(255, 236, 194, 0.68)");
  // Overhead zenith softboxes so Top View reflects warm 24k diagonal brushed gold (GPN-2000-001978)
  paintSoftbox(w * 0.36, h * 0.04, w * 0.34, h * 0.11, "#FFFDF5", "rgba(252, 224, 158, 0.65)");
  paintSoftbox(w * 0.84, h * 0.06, w * 0.22, h * 0.09, "#FFF8E4", "rgba(244, 208, 136, 0.48)");
  // Subtle cool-pastel rim accent for museum glass realism
  paintSoftbox(w * 0.91, h * 0.36, w * 0.09, h * 0.14, "rgba(235, 245, 255, 0.75)", "rgba(212, 232, 248, 0.22)");

  const equirect = new THREE.CanvasTexture(c);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(equirect);
  equirect.dispose();
  pmrem.dispose();
  return envRT.texture;
}

/**
 * Circular tangent anisotropy direction map for spun phonograph LP grooves.
 * Tangent vector at angle theta is (-sin(theta), cos(theta)) encoded in RG [0..255].
 */
function createCircularAnisotropyMap(size = 512): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - half;
      const dy = half - (y + 0.5);
      const len = Math.hypot(dx, dy) || 1;
      // Tangent perpendicular to radial vector (dx, dy)
      const tx = -dy / len;
      const ty = dx / len;
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((tx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ty * 0.5 + 0.5) * 255);
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Diagonal linear brushed-metal anisotropy map matching the ~40° brushed grain on
 * NASA's gold-anodized aluminum Voyager Cover Plate (GPN-2000-001978).
 */
function createDiagonalAnisotropyMap(angleRad = -0.68): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const tx = Math.cos(angleRad);
  const ty = Math.sin(angleRad);
  const rByte = Math.round((tx * 0.5 + 0.5) * 255);
  const gByte = Math.round((ty * 0.5 + 0.5) * 255);
  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    data[idx] = rByte;
    data[idx + 1] = gByte;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds physically-based concentric LP groove maps (albedo, roughness, normal) across r = 1.155 .. 3.555.
 * Each track on the active LP side (27 World Music bands on Side 1, or 21 Greetings/Earth bands on Side 2)
 * is an authentic cut-groove band separated by smooth mirror-gold lands.
 */
function createGroovedRecordMaps(bands: GoldenSound[]): {
  albedoMap: THREE.CanvasTexture;
  roughnessMap: THREE.DataTexture;
  normalMap: THREE.DataTexture;
} {
  const size = 1024;
  const half = size * 0.5;
  const maxU = GROOVE_SURFACE_OUTER;

  // Precompute 1D radial lookup table (in 0.25-pixel increments) for instant clean anti-aliased evaluation
  const lutLen = size * 2;
  const lutRough = new Float32Array(lutLen);
  const lutSlope = new Float32Array(lutLen);
  const lutTone = new Float32Array(lutLen);

  for (let i = 0; i < lutLen; i++) {
    const r = (i / lutLen) * maxU * 1.05;
    // Find if r sits inside one of the concentric cut-groove track bands on this side
    let bandIdx = -1;
    let bandPos = 0;
    for (let b = 0; b < bands.length; b++) {
      const s = bands[b];
      if (r >= s.rInner && r <= s.rOuter) {
        bandIdx = b;
        bandPos = (r - s.rInner) / Math.max(0.001, s.rOuter - s.rInner);
        break;
      }
    }

    if (bandIdx >= 0) {
      // Modulated stereo LP V-grooves inside track band
      const seed = (bandIdx + 1) * 13.37;
      const modulation =
        0.65 +
        0.35 *
          Math.sin(bandPos * Math.PI * (7 + (bandIdx % 5) * 3) + seed) *
          Math.cos(bandPos * Math.PI * 19 - seed * 0.5);
      const fineFreq = 540;
      const microGroove = Math.sin(r * fineFreq + seed);
      const medGroove = Math.sin(r * 135 + seed * 1.7);

      lutRough[i] = 0.235 + 0.065 * modulation + 0.018 * medGroove;
      lutSlope[i] = (0.26 * Math.cos(r * fineFreq + seed) + 0.09 * Math.cos(r * 135)) * modulation;
      lutTone[i] = 0.96 + 0.04 * microGroove * modulation;
    } else {
      // Smooth mirror-polished 24k gold inter-track "land" or outer lead-in / inner lead-out
      const spiralLead = Math.sin(r * 95);
      lutRough[i] = 0.085 + 0.012 * spiralLead;
      lutSlope[i] = 0.025 * Math.cos(r * 95);
      lutTone[i] = 0.87; // Mirror gold land reflects darker ambient contrast between bright groove bands
    }
  }

  const roughData = new Uint8Array(size * size * 4);
  const normData = new Uint8Array(size * size * 4);

  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext("2d")!;
  const albedoImg = actx.createImageData(size, size);
  const aPixels = albedoImg.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = ((x + 0.5 - half) / half) * maxU;
      const dy = ((half - (y + 0.5)) / half) * maxU;
      const r = Math.hypot(dx, dy);
      const lutIdx = Math.min(lutLen - 1, Math.max(0, Math.floor((r / (maxU * 1.05)) * lutLen)));

      const rough = lutRough[lutIdx];
      const slope = lutSlope[lutIdx];
      const tone = lutTone[lutIdx];

      const invR = r > 1e-4 ? 1 / r : 0;
      const nx = slope * dx * invR;
      const ny = slope * dy * invR;
      const nz = Math.sqrt(Math.max(0.2, 1 - nx * nx - ny * ny));

      const p = (y * size + x) * 4;
      const rByte = Math.round(Math.min(255, Math.max(0, rough * 255)));
      roughData[p] = rByte;
      roughData[p + 1] = rByte;
      roughData[p + 2] = rByte;
      roughData[p + 3] = 255;

      normData[p] = Math.round((nx * 0.5 + 0.5) * 255);
      normData[p + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normData[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normData[p + 3] = 255;

      // 24k electroplated gold-over-copper chromaticity (#EDC263 -> #D8A642)
      aPixels[p] = Math.min(255, Math.round(238 * tone));
      aPixels[p + 1] = Math.min(255, Math.round(194 * tone));
      aPixels[p + 2] = Math.min(255, Math.round(98 * tone));
      aPixels[p + 3] = 255;
    }
  }

  actx.putImageData(albedoImg, 0, 0);
  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = 8;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.needsUpdate = true;

  const normalMap = new THREE.DataTexture(normData, size, size, THREE.RGBAFormat);
  normalMap.needsUpdate = true;

  return { albedoMap, roughnessMap, normalMap };
}

/**
 * Builds the Diagonal-Brushed 24k Gold-Anodized Aluminum Voyager Cover Plate textures,
 * compositing NASA's exact Frank Drake photo-etched scientific diagrams from /textures/cover-mask.png.
 */
function createCoverPlateTextures(onReady?: () => void): {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  metalnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  setHighlightedDiagram: (diag: CoverDiagramRegion | null) => void;
} {
  const size = 2048;
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const actx = albedoCanvas.getContext("2d")!;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext("2d")!;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext("2d")!;

  const metalCanvas = document.createElement("canvas");
  metalCanvas.width = size;
  metalCanvas.height = size;
  const mctx = metalCanvas.getContext("2d")!;

  const emissiveCanvas = document.createElement("canvas");
  emissiveCanvas.width = size;
  emissiveCanvas.height = size;
  const ectx = emissiveCanvas.getContext("2d")!;

  const drawBaseBrushedGold = () => {
    // Rich 24k gold-anodized aluminum base matching GPN-2000-001978
    actx.fillStyle = "#D8AB48";
    actx.fillRect(0, 0, size, size);

    bctx.fillStyle = "#808080";
    bctx.fillRect(0, 0, size, size);

    rctx.fillStyle = "#404040"; // ~0.25 base roughness
    rctx.fillRect(0, 0, size, size);

    mctx.fillStyle = "#F2F2F2"; // ~0.95 metalness on brushed gold plate
    mctx.fillRect(0, 0, size, size);

    ectx.fillStyle = "#000000";
    ectx.fillRect(0, 0, size, size);

    // Deterministic diagonal ~40° hand-brushed aerospace aluminum grain lines
    const paintGrainPass = (
      target: CanvasRenderingContext2D,
      lightStroke: string,
      darkStroke: string,
      count: number
    ) => {
      target.save();
      target.translate(size * 0.5, size * 0.5);
      target.rotate(-0.68);
      let s = 42197;
      const rand = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
      for (let i = 0; i < count; i++) {
        const y = (rand() - 0.5) * size * 1.45;
        const x0 = (rand() - 0.5) * size * 1.45;
        const len = 140 + rand() * 680;
        target.strokeStyle = rand() > 0.48 ? lightStroke : darkStroke;
        target.lineWidth = 0.7 + rand() * 1.9;
        target.beginPath();
        target.moveTo(x0 - len * 0.5, y);
        target.lineTo(x0 + len * 0.5, y);
        target.stroke();
      }
      target.restore();
    };

    paintGrainPass(actx, "rgba(249, 219, 138, 0.16)", "rgba(156, 112, 30, 0.14)", 2600);
    paintGrainPass(bctx, "rgba(152, 152, 152, 0.16)", "rgba(104, 104, 104, 0.16)", 1800);
    paintGrainPass(rctx, "rgba(84, 84, 84, 0.22)", "rgba(48, 48, 48, 0.22)", 1600);

    // Outer chamfer ring & center countersunk bushing collar matching GPN-2000-001978
    actx.strokeStyle = "rgba(255, 236, 176, 0.55)";
    actx.lineWidth = 5;
    actx.beginPath();
    actx.arc(size * 0.5, size * 0.5, size * 0.492, 0, Math.PI * 2);
    actx.stroke();

    actx.strokeStyle = "#F7DC88";
    actx.lineWidth = 10;
    actx.beginPath();
    actx.arc(size * 0.5, size * 0.5, size * 0.027, 0, Math.PI * 2);
    actx.stroke();
  };

  drawBaseBrushedGold();

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = 4;

  const metalnessMap = new THREE.CanvasTexture(metalCanvas);
  metalnessMap.anisotropy = 4;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 8;

  let loadedMaskCanvas: HTMLCanvasElement | null = null;
  let currentDiagKey = "__init__";
  let pendingDiag: CoverDiagramRegion | null = null;

  const renderEmissiveLines = (diag: CoverDiagramRegion | null) => {
    pendingDiag = diag;
    if (!loadedMaskCanvas) return;
    const key = diag?.id ?? "none";
    if (key === currentDiagKey) return;
    currentDiagKey = key;

    // Tint all photo-etched Frank Drake lines in warm 24k gold (#C99732) so they remain crisp in shadow
    ectx.globalCompositeOperation = "source-over";
    ectx.clearRect(0, 0, size, size);
    ectx.drawImage(loadedMaskCanvas, 0, 0);
    ectx.globalCompositeOperation = "source-in";
    ectx.fillStyle = "#BD8B28";
    ectx.fillRect(0, 0, size, size);

    // Illuminate ONLY the etched gold lines of the hovered/selected diagram to bright champagne gold
    if (diag) {
      const x0 = Math.max(0, Math.floor((diag.uMin * 0.5 + 0.5) * size));
      const x1 = Math.min(size, Math.ceil((diag.uMax * 0.5 + 0.5) * size));
      const y0 = Math.max(0, Math.floor((diag.vMin * 0.5 + 0.5) * size));
      const y1 = Math.min(size, Math.ceil((diag.vMax * 0.5 + 0.5) * size));
      const sw = Math.max(1, x1 - x0);
      const sh = Math.max(1, y1 - y0);

      const sub = document.createElement("canvas");
      sub.width = sw;
      sub.height = sh;
      const sctx = sub.getContext("2d")!;
      sctx.drawImage(loadedMaskCanvas, x0, y0, sw, sh, 0, 0, sw, sh);
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = "#FFF4BE";
      sctx.fillRect(0, 0, sw, sh);

      ectx.globalCompositeOperation = "lighter";
      ectx.drawImage(sub, x0, y0);
    }

    // Put solid black behind transparent pixels so WebGL samples pure 0 outside etched lines
    ectx.globalCompositeOperation = "destination-over";
    ectx.fillStyle = "#000000";
    ectx.fillRect(0, 0, size, size);
    ectx.globalCompositeOperation = "source-over";
    emissiveMap.needsUpdate = true;
  };

  // Composite the high-resolution Frank Drake vector engraving mask (/textures/cover-mask.png)
  const maskImg = new Image();
  maskImg.crossOrigin = "anonymous";
  maskImg.onload = () => {
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const octx = off.getContext("2d")!;
    octx.drawImage(maskImg, 0, 0, size, size);
    const maskData = octx.getImageData(0, 0, size, size);
    const mp = maskData.data;

    // Build alpha-masked canvas where pixel alpha = etched line intensity (0..255)
    const alphaMask = document.createElement("canvas");
    alphaMask.width = size;
    alphaMask.height = size;
    const amCtx = alphaMask.getContext("2d")!;
    const amImg = amCtx.createImageData(size, size);
    const amp = amImg.data;

    const aData = actx.getImageData(0, 0, size, size);
    const ap = aData.data;
    const bData = bctx.getImageData(0, 0, size, size);
    const bp = bData.data;
    const rData = rctx.getImageData(0, 0, size, size);
    const rp = rData.data;
    const mData = mctx.getImageData(0, 0, size, size);
    const mtp = mData.data;

    for (let i = 0; i < mp.length; i += 4) {
      const lum = mp[i];
      amp[i] = 255;
      amp[i + 1] = 255;
      amp[i + 2] = 255;
      amp[i + 3] = lum;

      const m = lum / 255;
      if (m > 0.04) {
        const blend = Math.min(1, m * 1.18);
        // Frosted bright champagne-gold etched lines (#FFF0B5)
        ap[i] = Math.round(ap[i] * (1 - blend) + 255 * blend);
        ap[i + 1] = Math.round(ap[i + 1] * (1 - blend) + 236 * blend);
        ap[i + 2] = Math.round(ap[i + 2] * (1 - blend) + 168 * blend);

        bp[i] = bp[i + 1] = bp[i + 2] = Math.round(bp[i] * (1 - blend) + 28 * blend);
        rp[i] = rp[i + 1] = rp[i + 2] = Math.round(rp[i] * (1 - blend) + 86 * blend);
        // Lower metalness inside frosted photo-etched lines so they catch diffuse light at all angles
        mtp[i] = mtp[i + 1] = mtp[i + 2] = Math.round(mtp[i] * (1 - blend) + 82 * blend);
      }
    }

    amCtx.putImageData(amImg, 0, 0);
    loadedMaskCanvas = alphaMask;

    actx.putImageData(aData, 0, 0);
    bctx.putImageData(bData, 0, 0);
    rctx.putImageData(rData, 0, 0);
    mctx.putImageData(mData, 0, 0);

    albedoMap.needsUpdate = true;
    bumpMap.needsUpdate = true;
    roughnessMap.needsUpdate = true;
    metalnessMap.needsUpdate = true;

    currentDiagKey = "__force__";
    renderEmissiveLines(pendingDiag);
    onReady?.();
  };
  maskImg.src = "textures/cover-mask.png";

  return {
    albedoMap,
    bumpMap,
    roughnessMap,
    metalnessMap,
    emissiveMap,
    setHighlightedDiagram: renderEmissiveLines
  };
}

function assignPlanarDiscUVs(geo: THREE.BufferGeometry, maxRadius: number) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    uv.setXY(i, vx / (maxRadius * 2) + 0.5, 0.5 - vz / (maxRadius * 2));
  }
  uv.needsUpdate = true;
}

export function RecordPlateScene({
  activeId,
  hoveredId,
  isPlaying,
  stylusParked,
  progress,
  plateMode,
  activeDiagramId,
  cameraPreset,
  spinLocked,
  onHoverSector,
  onSelectSector,
  onDropStylus,
  onParkStylus,
  onSelectDiagram,
  onToggleCenterPlay
}: RecordPlateSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [pointerTip, setPointerTip] = useState<
    | { kind: "sound"; sound: GoldenSound; x: number; y: number }
    | { kind: "diagram"; diagram: CoverDiagramRegion; sound: GoldenSound; x: number; y: number }
    | { kind: "tonearm-hint"; x: number; y: number }
    | {
        kind: "needle-cue";
        sound: GoldenSound;
        cueSec: number;
        x: number;
        y: number;
        isTouch: boolean;
      }
    | { kind: "needle-park"; x: number; y: number; isTouch: boolean }
    | { kind: "platter-scrub"; label: string; rpmLabel: string; x: number; y: number; isTouch: boolean }
    | null
  >(null);

  const propsRef = useRef({
    activeId,
    hoveredId,
    isPlaying,
    stylusParked,
    progress,
    plateMode,
    activeDiagramId,
    cameraPreset,
    spinLocked,
    onHoverSector,
    onSelectSector,
    onDropStylus,
    onParkStylus,
    onSelectDiagram,
    onToggleCenterPlay
  });
  propsRef.current = {
    activeId,
    hoveredId,
    isPlaying,
    stylusParked,
    progress,
    plateMode,
    activeDiagramId,
    cameraPreset,
    spinLocked,
    onHoverSector,
    onSelectSector,
    onDropStylus,
    onParkStylus,
    onSelectDiagram,
    onToggleCenterPlay
  };

  const applyCameraRef = useRef<((preset: CameraPreset) => void) | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    const initW = Math.max(280, container.clientWidth);
    const initH = Math.max(280, container.clientHeight);

    const camera = new THREE.PerspectiveCamera(34, initW / initH, 0.1, 90);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initW, initH);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Custom high-contrast warm studio reflection map for authentic 24k gold metallurgy
    const studioEnv = createGoldStudioEnvironment(renderer);
    scene.environment = studioEnv;
    scene.environmentIntensity = 1.18;

    // Studio lighting: crisp directional key + opposing specular fill for twin radial groove flares
    const hemiLight = new THREE.HemisphereLight("#FFFDF9", "#DDD5C5", 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#FFF8E8", 2.15);
    keyLight.position.set(-5.2, 8.2, 4.4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 22;
    const dCam = 5.2;
    keyLight.shadow.camera.left = -dCam;
    keyLight.shadow.camera.right = dCam;
    keyLight.shadow.camera.top = dCam;
    keyLight.shadow.camera.bottom = -dCam;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const counterFlareLight = new THREE.DirectionalLight("#FFECC4", 1.45);
    counterFlareLight.position.set(5.6, 6.8, -3.8);
    scene.add(counterFlareLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 4.6;
    controls.maxDistance = 48;
    controls.minPolarAngle = 0.04;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.target.set(0, -0.1, 0);

    // =========================================================================
    // 1. Minimalist Museum / Braun-Inspired Turntable Plinth
    // =========================================================================
    const plinthGroup = new THREE.Group();
    scene.add(plinthGroup);

    // Whisper-soft ambient contact shadow beneath plinth over the pastel canvas
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const shCtx = shadowCanvas.getContext("2d")!;
    const shGrad = shCtx.createRadialGradient(128, 128, 42, 128, 128, 126);
    shGrad.addColorStop(0, "rgba(32, 28, 22, 0.14)");
    shGrad.addColorStop(0.68, "rgba(32, 28, 22, 0.05)");
    shGrad.addColorStop(1, "rgba(32, 28, 22, 0)");
    shCtx.fillStyle = shGrad;
    shCtx.fillRect(0, 0, 256, 256);
    const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(10.4, 10.4),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false
      })
    );
    contactShadowMesh.rotateX(-Math.PI / 2);
    contactShadowMesh.position.y = -0.305;
    plinthGroup.add(contactShadowMesh);

    // Warm matte architectural stone deck
    const deckMat = new THREE.MeshStandardMaterial({
      color: "#FAF8F3",
      roughness: 0.86,
      metalness: 0.02
    });
    const deckMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.26, 4.32, 0.24, 112), deckMat);
    deckMesh.position.y = -0.18;
    deckMesh.receiveShadow = true;
    plinthGroup.add(deckMesh);

    // Outer satin-champagne chamfer bezel around plinth
    const satinChampagneMat = new THREE.MeshStandardMaterial({
      color: "#D8C8A3",
      roughness: 0.36,
      metalness: 0.68
    });
    const deckLipGeo = new THREE.TorusGeometry(4.25, 0.022, 16, 128);
    deckLipGeo.rotateX(Math.PI / 2);
    const deckLip = new THREE.Mesh(deckLipGeo, satinChampagneMat);
    deckLip.position.y = -0.06;
    plinthGroup.add(deckLip);

    // Recessed dark-anodized platter mat well directly under the 24k gold record
    // Provides crisp dark museum-frame contrast around the gleaming 24k gold rim
    const platterWellMat = new THREE.MeshStandardMaterial({
      color: "#1B1916",
      roughness: 0.62,
      metalness: 0.28
    });
    const platterWell = new THREE.Mesh(
      new THREE.CylinderGeometry(3.74, 3.76, 0.05, 112),
      platterWellMat
    );
    platterWell.position.y = -0.072;
    platterWell.receiveShadow = true;
    plinthGroup.add(platterWell);

    const platterStrobeRingGeo = new THREE.RingGeometry(3.64, 3.74, 128);
    platterStrobeRingGeo.rotateX(-Math.PI / 2);
    const platterStrobeMat = new THREE.MeshStandardMaterial({
      color: "#2C2822",
      roughness: 0.42,
      metalness: 0.55
    });
    const platterStrobe = new THREE.Mesh(platterStrobeRingGeo, platterStrobeMat);
    platterStrobe.position.y = -0.044;
    plinthGroup.add(platterStrobe);

    // Fixed center turntable spindle rising through the Golden Record's center hole
    const spindleBaseMat = new THREE.MeshStandardMaterial({
      color: "#23211E",
      roughness: 0.26,
      metalness: 0.82
    });
    const fixedSpindle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.066, 0.30, 32),
      spindleBaseMat
    );
    fixedSpindle.position.y = 0.06;
    fixedSpindle.userData = { kind: "center" };
    plinthGroup.add(fixedSpindle);

    // =========================================================================
    // 2. Flippable 24-Karat Gold-Plated Copper Voyager Record & Cover Plate
    // =========================================================================
    // Flip Group handles smooth 180-degree X-rotation (Record <-> Cover Plate) + lift clearance
    const flipGroup = new THREE.Group();
    scene.add(flipGroup);

    // Spin Group handles continuous 16 2/3 RPM rotation around local Y
    const discGroup = new THREE.Group();
    flipGroup.add(discGroup);

    const circularAnisoMap = createCircularAnisotropyMap(512);
    const diagonalAnisoMap = createDiagonalAnisotropyMap(-0.68);
    const musicMaps = createGroovedRecordMaps(MUSIC_SOUNDS);
    const soundsMaps = createGroovedRecordMaps(EARTH_SOUNDS);
    let displayedRecordSide: "music" | "sounds" =
      propsRef.current.plateMode === "sounds" ? "sounds" : "music";
    const initialMaps = displayedRecordSide === "sounds" ? soundsMaps : musicMaps;

    // Solid 24k gold-plated copper platter body (with true center bore)
    const goldEdgeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#E5B852"),
      metalness: 0.96,
      roughness: 0.14,
      clearcoat: 0.25,
      clearcoatRoughness: 0.12
    });

    const outerWallGeo = new THREE.CylinderGeometry(
      DISC_RADIUS,
      DISC_RADIUS,
      0.068,
      144,
      1,
      true
    );
    const outerWall = new THREE.Mesh(outerWallGeo, goldEdgeMat);
    outerWall.castShadow = true;
    discGroup.add(outerWall);

    // Raised outer LP rim bead (r = 3.55 .. 3.62) on top face
    const rimBeadGeo = new THREE.TorusGeometry(DISC_RADIUS - 0.022, 0.036, 20, 144);
    rimBeadGeo.rotateX(Math.PI / 2);
    const rimBead = new THREE.Mesh(rimBeadGeo, goldEdgeMat);
    rimBead.position.y = 0.008;
    discGroup.add(rimBead);

    // --- LP FACE (TOP, +Y): Grooved 24k Gold LP + Authentic NASA "Sounds of Earth" Label ---
    const grooveSurfaceGeo = new THREE.RingGeometry(
      GROOVE_SURFACE_INNER,
      GROOVE_SURFACE_OUTER + 0.04,
      192,
      6
    );
    grooveSurfaceGeo.rotateX(-Math.PI / 2);
    assignPlanarDiscUVs(grooveSurfaceGeo, GROOVE_SURFACE_OUTER);

    const grooveGoldMat = new THREE.MeshPhysicalMaterial({
      map: initialMaps.albedoMap,
      roughnessMap: initialMaps.roughnessMap,
      normalMap: initialMaps.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      metalness: 0.95,
      roughness: 0.98, // Multiplied directly against roughnessMap values (0.08 lands .. 0.30 grooves)
      anisotropy: 0.92,
      anisotropyMap: circularAnisoMap,
      clearcoat: 0.14,
      clearcoatRoughness: 0.18
    });

    const applyGrooveSideMaps = (side: "music" | "sounds") => {
      if (displayedRecordSide === side) return;
      displayedRecordSide = side;
      const nextMaps = side === "sounds" ? soundsMaps : musicMaps;
      grooveGoldMat.map = nextMaps.albedoMap;
      grooveGoldMat.roughnessMap = nextMaps.roughnessMap;
      grooveGoldMat.normalMap = nextMaps.normalMap;
      grooveGoldMat.needsUpdate = true;
    };

    const grooveSurfaceMesh = new THREE.Mesh(grooveSurfaceGeo, grooveGoldMat);
    grooveSurfaceMesh.position.y = 0.035;
    grooveSurfaceMesh.receiveShadow = true;
    discGroup.add(grooveSurfaceMesh);

    // Authentic NASA Center Label & Mirror-Black Run-out Ring (r = 0.074 .. 1.16)
    const texLoader = new THREE.TextureLoader();
    const centerLabelTex = texLoader.load("textures/center-label.jpg");
    centerLabelTex.colorSpace = THREE.SRGBColorSpace;
    centerLabelTex.anisotropy = 8;

    const centerLabelRadius = 1.16;
    const centerLabelGeo = new THREE.RingGeometry(SPINDLE_HOLE_RADIUS, centerLabelRadius, 128);
    centerLabelGeo.rotateX(-Math.PI / 2);
    // Scale UVs by 0.922 so r = 1.16 lands cleanly on the outer edge of the black mirror run-out ring
    const lblPos = centerLabelGeo.attributes.position;
    const lblUv = centerLabelGeo.attributes.uv;
    const uvScale = 0.461 / centerLabelRadius;
    for (let i = 0; i < lblPos.count; i++) {
      const vx = lblPos.getX(i);
      const vz = lblPos.getZ(i);
      lblUv.setXY(i, 0.5 + vx * uvScale, 0.5 - vz * uvScale);
    }
    lblUv.needsUpdate = true;

    const centerLabelMat = new THREE.MeshPhysicalMaterial({
      map: centerLabelTex,
      roughness: 0.26,
      metalness: 0.36,
      clearcoat: 0.78,
      clearcoatRoughness: 0.14
    });
    const centerLabelMesh = new THREE.Mesh(centerLabelGeo, centerLabelMat);
    centerLabelMesh.position.y = 0.0365;
    discGroup.add(centerLabelMesh);

    // Optical Concentric Groove Band Highlight Rings (Active + Hovered) on Side A
    // Renders a whisper-thin luminous band over whichever of the 19 concentric LP tracks is active/hovered
    const makeBandHighlightGroup = (fillOpacity: number, borderOpacity: number) => {
      const grp = new THREE.Group();
      grp.position.y = 0.039;
      const fillMat = new THREE.MeshBasicMaterial({
        color: "#FFF6D6",
        transparent: true,
        opacity: fillOpacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const borderMat = new THREE.MeshBasicMaterial({
        color: "#FFFDF7",
        transparent: true,
        opacity: borderOpacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const fillMesh = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.1, 128), fillMat);
      fillMesh.rotateX(-Math.PI / 2);
      const innerLine = new THREE.Mesh(new THREE.RingGeometry(1.995, 2.005, 128), borderMat);
      innerLine.rotateX(-Math.PI / 2);
      const outerLine = new THREE.Mesh(new THREE.RingGeometry(2.095, 2.105, 128), borderMat);
      outerLine.rotateX(-Math.PI / 2);
      grp.add(fillMesh, innerLine, outerLine);
      return { grp, fillMesh, innerLine, outerLine, fillMat, borderMat };
    };

    const activeBandHighlight = makeBandHighlightGroup(0.24, 0.72);
    const hoverBandHighlight = makeBandHighlightGroup(0.18, 0.55);
    discGroup.add(activeBandHighlight.grp, hoverBandHighlight.grp);

    let lastActiveHighlightKey = "";
    let lastHoverHighlightKey = "";

    const updateRingHighlight = (
      target: ReturnType<typeof makeBandHighlightGroup>,
      sound: GoldenSound | null,
      cacheKey: string,
      prevKey: string
    ): string => {
      if (!sound) {
        target.grp.visible = false;
        return "";
      }
      target.grp.visible = true;
      if (cacheKey === prevKey) return prevKey;

      const ringMeta = RING_CHAPTERS[sound.ring];
      target.fillMat.color.set(ringMeta.highlightHex).lerp(new THREE.Color("#FFF2C2"), 0.55);
      target.borderMat.color.set(ringMeta.pillBg).lerp(new THREE.Color("#FFFFFF"), 0.5);

      target.fillMesh.geometry.dispose();
      target.fillMesh.geometry = new THREE.RingGeometry(sound.rInner, sound.rOuter, 144);
      target.innerLine.geometry.dispose();
      target.innerLine.geometry = new THREE.RingGeometry(
        sound.rInner - 0.0045,
        sound.rInner + 0.0045,
        144
      );
      target.outerLine.geometry.dispose();
      target.outerLine.geometry = new THREE.RingGeometry(
        sound.rOuter - 0.0045,
        sound.rOuter + 0.0045,
        144
      );
      return cacheKey;
    };

    // --- SIDE B (BOTTOM, -Y -> Flips upright via Rx(PI)*Rx(PI)=I): Engraved Gold Cover Plate ---
    const coverSideGroup = new THREE.Group();
    coverSideGroup.position.y = -0.036;
    coverSideGroup.rotation.x = Math.PI;
    discGroup.add(coverSideGroup);

    const {
      albedoMap: coverAlbedo,
      bumpMap: coverBump,
      roughnessMap: coverRough,
      metalnessMap: coverMetal,
      emissiveMap: coverEmissive,
      setHighlightedDiagram
    } = createCoverPlateTextures();

    const coverFaceGeo = new THREE.RingGeometry(SPINDLE_HOLE_RADIUS, DISC_RADIUS - 0.01, 160, 4);
    coverFaceGeo.rotateX(-Math.PI / 2);
    assignPlanarDiscUVs(coverFaceGeo, DISC_RADIUS);

    const coverFaceMat = new THREE.MeshPhysicalMaterial({
      map: coverAlbedo,
      roughnessMap: coverRough,
      metalnessMap: coverMetal,
      bumpMap: coverBump,
      bumpScale: 0.024,
      emissive: new THREE.Color("#FFE699"),
      emissiveMap: coverEmissive,
      emissiveIntensity: 0.52,
      metalness: 1.0,
      roughness: 0.96,
      anisotropy: 0.78,
      anisotropyMap: diagonalAnisoMap,
      clearcoat: 0.12,
      clearcoatRoughness: 0.22
    });
    const coverFaceMesh = new THREE.Mesh(coverFaceGeo, coverFaceMat);
    coverSideGroup.add(coverFaceMesh);

    // Subtle 4-corner L-shaped museum registration ticks around active/hovered Cover Diagram
    const coverCornerMat = new THREE.LineBasicMaterial({
      color: "#FFF6D1",
      transparent: true,
      opacity: 0.78
    });
    const coverCornerGeo = new THREE.BufferGeometry();
    coverCornerGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(8 * 2 * 3), 3)
    );
    const coverCornerLines = new THREE.LineSegments(coverCornerGeo, coverCornerMat);
    coverCornerLines.position.y = 0.0035;
    coverCornerLines.visible = false;
    coverSideGroup.add(coverCornerLines);
    let prevCoverDiagId = "__init__";

    const positionCoverHighlight = (diag: CoverDiagramRegion | null) => {
      const nextId = diag?.id ?? "none";
      if (nextId === prevCoverDiagId) return;
      prevCoverDiagId = nextId;

      setHighlightedDiagram(diag);
      if (!diag) {
        coverCornerLines.visible = false;
        return;
      }
      coverCornerLines.visible = true;
      const pad = 0.06;
      const x0 = diag.uMin * DISC_RADIUS - pad;
      const x1 = diag.uMax * DISC_RADIUS + pad;
      const z0 = diag.vMin * DISC_RADIUS - pad;
      const z1 = diag.vMax * DISC_RADIUS + pad;
      const tLen = Math.min(0.14, (x1 - x0) * 0.2, (z1 - z0) * 0.2);

      const segs = [
        // Top-left L
        x0, 0, z0, x0 + tLen, 0, z0,
        x0, 0, z0, x0, 0, z0 + tLen,
        // Top-right L
        x1, 0, z0, x1 - tLen, 0, z0,
        x1, 0, z0, x1, 0, z0 + tLen,
        // Bottom-right L
        x1, 0, z1, x1 - tLen, 0, z1,
        x1, 0, z1, x1, 0, z1 - tLen,
        // Bottom-left L
        x0, 0, z1, x0 + tLen, 0, z1,
        x0, 0, z1, x0, 0, z1 - tLen
      ];
      const attr = coverCornerGeo.attributes.position as THREE.BufferAttribute;
      (attr.array as Float32Array).set(segs);
      attr.needsUpdate = true;
    };

    // Invisible analytical raycast target disc moving with discGroup
    const pickDiscMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, 0.09, 72),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pickDiscMesh.userData = { kind: "disc" };
    discGroup.add(pickDiscMesh);

    const pickTargets: THREE.Object3D[] = [pickDiscMesh, fixedSpindle];

    // =========================================================================
    // 3. Precision Articulated Tonearm & NASA Voyager Stylus Cartridge
    // =========================================================================
    const pivotPos = new THREE.Vector3(3.52, 0, -2.58);
    const armDistD = Math.hypot(pivotPos.x, pivotPos.z);
    const armLenL = 3.58;
    const angleToCenter = Math.atan2(-pivotPos.z, -pivotPos.x);

    const tonearmBase = new THREE.Group();
    tonearmBase.position.copy(pivotPos);
    plinthGroup.add(tonearmBase);

    const satinTitaniumMat = new THREE.MeshStandardMaterial({
      color: "#DDD8CE",
      roughness: 0.28,
      metalness: 0.78
    });
    const darkAnodizedMat = new THREE.MeshStandardMaterial({
      color: "#23211E",
      roughness: 0.34,
      metalness: 0.68
    });

    const towerCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.27, 0.34, 40),
      darkAnodizedMat
    );
    towerCol.position.y = 0.11;
    towerCol.castShadow = true;
    tonearmBase.add(towerCol);

    const gimbalRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.14, 32),
      satinTitaniumMat
    );
    gimbalRing.position.y = 0.32;
    tonearmBase.add(gimbalRing);

    const armYawGroup = new THREE.Group();
    armYawGroup.position.y = 0.34;
    tonearmBase.add(armYawGroup);

    const armPitchGroup = new THREE.Group();
    armYawGroup.add(armPitchGroup);

    const tubeGeo = new THREE.CylinderGeometry(0.022, 0.025, armLenL + 0.58, 24);
    tubeGeo.rotateZ(Math.PI / 2);
    const tubeMesh = new THREE.Mesh(tubeGeo, satinTitaniumMat);
    tubeMesh.position.x = (armLenL - 0.58) * 0.5;
    tubeMesh.castShadow = true;
    armPitchGroup.add(tubeMesh);

    const counterWeight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.24, 32),
      darkAnodizedMat
    );
    counterWeight.rotation.z = Math.PI / 2;
    counterWeight.position.x = -0.45;
    armPitchGroup.add(counterWeight);

    // NASA-supplied faceted gold cartridge shell + finger-lift cue lever + diamond stylus
    const headshellMat = goldEdgeMat.clone();
    const headshell = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.048, 0.145),
      headshellMat
    );
    headshell.position.set(armLenL - 0.03, 0.012, 0);
    headshell.castShadow = true;
    armPitchGroup.add(headshell);

    // Tactile audiophile finger-lift cueing bar extending outward from right side of headshell
    const fingerLiftBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.13, 14),
      headshellMat
    );
    fingerLiftBar.rotation.x = Math.PI / 2;
    fingerLiftBar.rotation.y = 0.25;
    fingerLiftBar.position.set(armLenL - 0.05, 0.026, 0.11);
    armPitchGroup.add(fingerLiftBar);

    const cartridgeBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.068, 0.11),
      darkAnodizedMat
    );
    cartridgeBody.position.set(armLenL - 0.015, -0.038, 0);
    armPitchGroup.add(cartridgeBody);

    const stylusTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.095, 16),
      goldEdgeMat
    );
    stylusTip.rotation.x = Math.PI;
    stylusTip.position.set(armLenL + 0.02, -0.095, 0);
    armPitchGroup.add(stylusTip);

    // Generous invisible touch/mouse grab colliders around cartridge headshell & tonearm tube
    const headshellGrabMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    headshellGrabMesh.position.set(armLenL - 0.04, -0.01, -0.03);
    headshellGrabMesh.userData = { kind: "tonearm" };
    armPitchGroup.add(headshellGrabMesh);

    const armTubeGrabGeo = new THREE.CylinderGeometry(0.21, 0.21, armLenL * 0.84, 12);
    armTubeGrabGeo.rotateZ(Math.PI / 2);
    const armTubeGrabMesh = new THREE.Mesh(
      armTubeGrabGeo,
      new THREE.MeshBasicMaterial({ visible: false })
    );
    armTubeGrabMesh.position.set(armLenL * 0.44, 0.01, 0);
    armTubeGrabMesh.userData = { kind: "tonearm" };
    armPitchGroup.add(armTubeGrabMesh);

    const tonearmPickTargets: THREE.Object3D[] = [headshellGrabMesh, armTubeGrabMesh];

    const computeYawForRadius = (targetR: number): number => {
      const clampedR = Math.max(0.95, Math.min(4.12, targetR));
      const cosAlpha =
        (armDistD * armDistD + armLenL * armLenL - clampedR * clampedR) /
        (2 * armDistD * armLenL);
      const alpha = Math.acos(Math.max(-0.99, Math.min(0.99, cosAlpha)));
      const worldPhi = angleToCenter - alpha;
      return -worldPhi;
    };

    // Sculpted tonearm rest post & U-cradle positioned directly under parked arm (r = 4.06)
    const parkRadius = 4.06;
    const parkYaw = computeYawForRadius(parkRadius);
    const restAlignGroup = new THREE.Group();
    restAlignGroup.rotation.y = parkYaw;
    tonearmBase.add(restAlignGroup);

    const armRestGroup = new THREE.Group();
    armRestGroup.position.set(2.25, 0, 0);
    restAlignGroup.add(armRestGroup);

    const restStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.042, 0.38, 20),
      darkAnodizedMat
    );
    restStem.position.y = 0.16;
    armRestGroup.add(restStem);

    const restCradleGeo = new THREE.TorusGeometry(0.052, 0.013, 12, 24, Math.PI);
    restCradleGeo.rotateZ(Math.PI);
    restCradleGeo.rotateY(Math.PI / 2);
    const restCradle = new THREE.Mesh(restCradleGeo, satinTitaniumMat);
    restCradle.position.y = 0.395;
    armRestGroup.add(restCradle);

    let currentArmYaw = parkYaw;
    let currentArmPitch = 0.045;
    armYawGroup.rotation.y = currentArmYaw;
    armPitchGroup.rotation.z = currentArmPitch;

    // =========================================================================
    // 4. Camera Presets & Responsive Framing
    // =========================================================================
    let presetAnimating = false;
    let userOrbited = false;
    const presetTargetPos = new THREE.Vector3();
    const presetTargetLook = new THREE.Vector3(0, -0.12, 0);

    const applyCameraPreset = (preset: CameraPreset, immediate = false) => {
      userOrbited = false;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const aspect = w / h;
      const isPortrait = aspect < 0.92;
      const tanHalfFovY = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      const tanHalfFovX = Math.max(0.11, aspect * tanHalfFovY);

      if (isPortrait) {
        // Exact horizontal FOV framing for mobile portrait so the full turntable bezel + 24k Gold Record
        // sits cleanly inside the screen margins between the compact top bar and bottom thumb dock.
        if (preset === "overhead") {
          const dist = Math.min(44, 4.48 / tanHalfFovX);
          presetTargetLook.set(0, -0.12, 0.72);
          presetTargetPos.set(0, dist * 0.998, 0.72 + dist * 0.048);
        } else if (preset === "closeup") {
          const dist = Math.min(34, 3.05 / tanHalfFovX);
          presetTargetLook.set(0.55, -0.1, 0.45);
          presetTargetPos.set(0.55 + dist * 0.24, dist * 0.76, 0.45 + dist * 0.6);
        } else {
          // Gallery 25° tilt on portrait: preserves rich 3D rim/tonearm depth & twin gold flares
          // without foreshortening the concentric grooves into a tiny flat strip.
          const dist = Math.min(44, 4.54 / tanHalfFovX);
          const polar = 0.43; // ~24.6° from zenith
          presetTargetLook.set(0, -0.22, 0.68);
          presetTargetPos.set(
            0,
            -0.22 + dist * Math.cos(polar),
            0.68 + dist * Math.sin(polar)
          );
        }
      } else {
        const fitScale =
          aspect < 1.18 ? Math.min(1.35, 1.18 / Math.max(0.85, aspect)) : 1;
        presetTargetLook.set(0, -0.12, 0);
        if (preset === "overhead") {
          presetTargetPos.set(0, 14.4 * fitScale, 0.68 * fitScale);
        } else if (preset === "closeup") {
          presetTargetPos.set(1.95 * fitScale, 4.35 * fitScale, 5.25 * fitScale);
        } else {
          presetTargetPos.set(0, 9.05 * fitScale, 8.75 * fitScale);
        }
      }

      if (immediate) {
        camera.position.copy(presetTargetPos);
        controls.target.copy(presetTargetLook);
        controls.update();
        presetAnimating = false;
      } else {
        presetAnimating = true;
      }
    };

    applyCameraPreset(propsRef.current.cameraPreset, true);
    applyCameraRef.current = (preset) => applyCameraPreset(preset, false);

    const cancelPresetOnUserDrag = () => {
      presetAnimating = false;
      userOrbited = true;
    };
    controls.addEventListener("start", cancelPresetOnUserDrag);

    // =========================================================================
    // 5. Real-Life Needle Cueing, Direct-Drive Platter Scrubbing & Raycasting
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const groovePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.036);
    const planeHitPoint = new THREE.Vector3();

    const activePointers = new Set<number>();
    type DragMode = "none" | "needle" | "platter-pending" | "platter-active";
    let dragMode: DragMode = "none";
    let activeDragPointerId = -1;
    let hoveredDiagramId: string | null = null;
    let isHoveringTonearm = false;

    let downX = 0;
    let downY = 0;
    let lastMoveX = 0;
    let lastMoveY = 0;
    let downTime = 0;
    let pointerIsTouch = false;

    // Physical needle cueing state (when dragging headshell/tonearm)
    let needleDragRadius = parkRadius;
    let needleCuedSound: GoldenSound | null = null;
    let needleCuedRatio = 0;

    // Physical direct-drive platter state (16⅔ RPM = NOMINAL_OMEGA rad/s)
    let platterOmega = propsRef.current.isPlaying ? NOMINAL_OMEGA : 0;
    let prevPlatterPointerAngle = 0;
    let lastPointerMoveClock = performance.now();
    let fingerTargetOmega = 0;

    // Automatic cueing lift & damped touchdown bounce when jumping across bands
    let prevTrackedBandId = propsRef.current.activeId;
    let autoCueLiftTimer = 0;
    let stylusDropBounce = 0;

    type PickResult =
      | { kind: "tonearm" }
      | { kind: "center" }
      | { kind: "sound"; sound: GoldenSound; r: number }
      | { kind: "diagram"; diagram: CoverDiagramRegion; sound: GoldenSound };

    const findSoundForRadius = (r: number, side: "music" | "sounds"): GoldenSound | null => {
      if (r < GROOVE_SURFACE_INNER - 0.04 || r > GROOVE_SURFACE_OUTER + 0.05) return null;
      const sideBands = side === "sounds" ? EARTH_SOUNDS : MUSIC_SOUNDS;
      let best: GoldenSound | null = null;
      let bestDist = Infinity;
      for (const s of sideBands) {
        if (r >= s.rInner && r <= s.rOuter) return s;
        const mid = (s.rInner + s.rOuter) * 0.5;
        const d = Math.abs(r - mid);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      return best;
    };

    const findCoverDiagramAt = (u: number, v: number): CoverDiagramRegion | null => {
      for (const d of COVER_DIAGRAMS) {
        if (u >= d.uMin && u <= d.uMax && v >= d.vMin && v <= d.vMax) {
          return d;
        }
      }
      let best: CoverDiagramRegion | null = null;
      let bestDist = 0.22;
      for (const d of COVER_DIAGRAMS) {
        const cu = (d.uMin + d.uMax) * 0.5;
        const cv = (d.vMin + d.vMax) * 0.5;
        const dist = Math.hypot(u - cu, v - cv);
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      return best;
    };

    const setRayFromClientXY = (clientX: number, clientY: number): boolean => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      return true;
    };

    const projectPointerToGroovePlane = (clientX: number, clientY: number): THREE.Vector3 | null => {
      if (!setRayFromClientXY(clientX, clientY)) return null;
      return raycaster.ray.intersectPlane(groovePlane, planeHitPoint);
    };

    const pickAtClientXY = (clientX: number, clientY: number): PickResult | null => {
      if (!setRayFromClientXY(clientX, clientY)) return null;
      const mode = propsRef.current.plateMode;

      // 1. Prioritize grabbing the physical tonearm / cartridge headshell on LP sides
      if (mode !== "cover") {
        const armHits = raycaster.intersectObjects(tonearmPickTargets, false);
        if (armHits.length > 0) {
          return { kind: "tonearm" };
        }
      }

      const hits = raycaster.intersectObjects(pickTargets, false);
      if (hits.length === 0) return null;

      const hit = hits[0];
      if ((hit.object.userData as { kind?: string }).kind === "center") {
        return { kind: "center" };
      }

      if (mode !== "cover") {
        const localPt = discGroup.worldToLocal(hit.point.clone());
        const r = Math.hypot(localPt.x, localPt.z);
        if (r <= centerLabelRadius) return { kind: "center" };
        const sound = findSoundForRadius(r, mode);
        if (sound) return { kind: "sound", sound, r };
        return null;
      } else {
        const coverPt = coverSideGroup.worldToLocal(hit.point.clone());
        const r = Math.hypot(coverPt.x, coverPt.z);
        if (r <= 0.22) return { kind: "center" };
        const u = coverPt.x / DISC_RADIUS;
        const v = coverPt.z / DISC_RADIUS;
        const diag = findCoverDiagramAt(u, v);
        if (diag) {
          const sound =
            GOLDEN_SOUNDS.find((s) => s.id === diag.soundId) ?? GOLDEN_SOUNDS[0];
          return { kind: "diagram", diagram: diag, sound };
        }
        return null;
      }
    };

    const updateNeedleCueFromClientXY = (clientX: number, clientY: number, isTouch: boolean) => {
      const pt = projectPointerToGroovePlane(clientX, clientY);
      if (!pt) return;
      const rect = container.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      // Measure radial distance from spindle so user can drag needle anywhere from inner label to rest post
      const rawR = Math.hypot(pt.x, pt.z);
      needleDragRadius = THREE.MathUtils.clamp(rawR, 1.12, 4.08);

      const curSide: "music" | "sounds" =
        propsRef.current.plateMode === "sounds" ? "sounds" : "music";

      if (needleDragRadius > 3.66) {
        needleCuedSound = null;
        needleCuedRatio = 0;
        propsRef.current.onHoverSector(null);
        setPointerTip({ kind: "needle-park", x: relX, y: relY, isTouch });
      } else {
        const clampedGrooveR = THREE.MathUtils.clamp(
          needleDragRadius,
          GROOVE_SURFACE_INNER,
          GROOVE_SURFACE_OUTER
        );
        const sound = findSoundForRadius(clampedGrooveR, curSide);
        if (sound) {
          const span = Math.max(0.004, sound.rOuter - sound.rInner);
          const ratio = THREE.MathUtils.clamp((sound.rOuter - clampedGrooveR) / span, 0, 0.97);
          needleCuedSound = sound;
          needleCuedRatio = ratio;
          propsRef.current.onHoverSector(sound.id);
          setPointerTip({
            kind: "needle-cue",
            sound,
            cueSec: ratio * sound.durationSec,
            x: relX,
            y: relY,
            isTouch
          });
        }
      }
    };

    const updatePlatterScrubTip = (clientX: number, clientY: number, isTouch: boolean) => {
      const rect = container.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const ratio = platterOmega / NOMINAL_OMEGA;
      const rpm = Math.abs(ratio * (16 + 2 / 3));
      let label = "Platter Hold · Braking";
      if (ratio > 1.08) {
        label = `Forward Spin · +${ratio.toFixed(1)}×`;
      } else if (ratio >= 0.12) {
        label = `Slip-Cue · ${ratio.toFixed(2)}×`;
      } else if (ratio < -0.06) {
        label = `Reverse Scrub · ${ratio.toFixed(1)}×`;
      }
      setPointerTip({
        kind: "platter-scrub",
        label,
        rpmLabel: `${rpm.toFixed(1)} RPM`,
        x: relX,
        y: relY,
        isTouch
      });
    };

    // Capture-phase pointerdown intercepts needle & platter touches BEFORE OrbitControls
    const handlePointerDownCapture = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      activePointers.add(e.pointerId);

      // Two-finger pinch/orbit on touch always hands control cleanly to OrbitControls
      if (activePointers.size >= 2) {
        if (dragMode === "needle") {
          audioEngine.setStylusLifted(false);
        }
        dragMode = "none";
        activeDragPointerId = -1;
        controls.enabled = true;
        setPointerTip(null);
        return;
      }

      downX = e.clientX;
      downY = e.clientY;
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      downTime = performance.now();
      lastPointerMoveClock = downTime;
      pointerIsTouch = e.pointerType === "touch";

      const hit = pickAtClientXY(e.clientX, e.clientY);
      if (!hit) {
        dragMode = "none";
        controls.enabled = true;
        return;
      }

      if (hit.kind === "tonearm") {
        // Physically grab & lift the tonearm headshell
        dragMode = "needle";
        activeDragPointerId = e.pointerId;
        controls.enabled = false;
        renderer.domElement.style.cursor = "grabbing";
        audioEngine.setStylusLifted(true);
        updateNeedleCueFromClientXY(e.clientX, e.clientY, pointerIsTouch);
        e.stopPropagation();
        return;
      }

      if (propsRef.current.plateMode !== "cover" && (hit.kind === "sound" || hit.kind === "center")) {
        // Touching the gold LP platter: quick release = tap band; hold/drag = physical platter brake/spin!
        const pt = projectPointerToGroovePlane(e.clientX, e.clientY);
        if (pt) {
          prevPlatterPointerAngle = Math.atan2(pt.z, pt.x);
        }
        dragMode = "platter-pending";
        activeDragPointerId = e.pointerId;
        fingerTargetOmega = 0;
        controls.enabled = false;
        e.stopPropagation();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;

      if (dragMode === "needle" && e.pointerId === activeDragPointerId) {
        updateNeedleCueFromClientXY(e.clientX, e.clientY, e.pointerType === "touch");
        return;
      }

      if (
        (dragMode === "platter-pending" || dragMode === "platter-active") &&
        e.pointerId === activeDragPointerId
      ) {
        const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
        const now = performance.now();
        if (dragMode === "platter-pending" && moveDist > (e.pointerType === "touch" ? 10 : 6)) {
          dragMode = "platter-active";
          renderer.domElement.style.cursor = "grabbing";
        }

        if (dragMode === "platter-active") {
          const pt = projectPointerToGroovePlane(e.clientX, e.clientY);
          if (pt && Math.hypot(pt.x, pt.z) > 0.14) {
            const angle = Math.atan2(pt.z, pt.x);
            let dAngle = angle - prevPlatterPointerAngle;
            if (dAngle > Math.PI) dAngle -= Math.PI * 2;
            if (dAngle < -Math.PI) dAngle += Math.PI * 2;
            prevPlatterPointerAngle = angle;

            // Direct 1:1 angular lock between finger & 24k gold platter
            discGroup.rotation.y -= dAngle;
            const moveDt = Math.max(0.004, (now - lastPointerMoveClock) / 1000);
            const instOmega = THREE.MathUtils.clamp(dAngle / moveDt, -5.5, 5.5);
            fingerTargetOmega = fingerTargetOmega * 0.35 + instOmega * 0.65;
            platterOmega = fingerTargetOmega;
            lastPointerMoveClock = now;
            updatePlatterScrubTip(e.clientX, e.clientY, e.pointerType === "touch");
          }
        }
        return;
      }

      // Passive hover on desktop mouse
      if (e.pointerType === "touch") return;
      const hit = pickAtClientXY(e.clientX, e.clientY);
      const rect = container.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      isHoveringTonearm = Boolean(hit && hit.kind === "tonearm");

      if (hit && hit.kind === "tonearm") {
        hoveredDiagramId = null;
        renderer.domElement.style.cursor = "grab";
        propsRef.current.onHoverSector(null);
        setPointerTip({ kind: "tonearm-hint", x: relX, y: relY });
      } else if (hit && hit.kind === "sound") {
        hoveredDiagramId = null;
        renderer.domElement.style.cursor = "pointer";
        propsRef.current.onHoverSector(hit.sound.id);
        setPointerTip({ kind: "sound", sound: hit.sound, x: relX, y: relY });
      } else if (hit && hit.kind === "diagram") {
        hoveredDiagramId = hit.diagram.id;
        renderer.domElement.style.cursor = "pointer";
        propsRef.current.onHoverSector(hit.sound.id);
        setPointerTip({
          kind: "diagram",
          diagram: hit.diagram,
          sound: hit.sound,
          x: relX,
          y: relY
        });
      } else if (hit && hit.kind === "center") {
        hoveredDiagramId = null;
        renderer.domElement.style.cursor = "pointer";
        propsRef.current.onHoverSector(null);
        setPointerTip(null);
      } else {
        hoveredDiagramId = null;
        renderer.domElement.style.cursor = "grab";
        propsRef.current.onHoverSector(null);
        setPointerTip(null);
      }
    };

    const handlePointerLeave = () => {
      if (dragMode !== "none") return;
      isHoveringTonearm = false;
      hoveredDiagramId = null;
      renderer.domElement.style.cursor = "grab";
      propsRef.current.onHoverSector(null);
      setPointerTip(null);
    };

    const finishPointerGesture = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (e.pointerId !== activeDragPointerId && dragMode !== "none") {
        return;
      }

      const finishedMode = dragMode;
      dragMode = "none";
      activeDragPointerId = -1;
      controls.enabled = true;
      renderer.domElement.style.cursor = "grab";

      if (finishedMode === "needle") {
        if (needleDragRadius > 3.66 || !needleCuedSound) {
          propsRef.current.onParkStylus();
        } else {
          stylusDropBounce = -0.024;
          propsRef.current.onDropStylus(needleCuedSound.id, needleCuedRatio);
        }
        if (e.pointerType === "touch") {
          propsRef.current.onHoverSector(null);
          setPointerTip(null);
        }
        return;
      }

      if (finishedMode === "platter-active") {
        fingerTargetOmega = 0;
        if (e.pointerType === "touch") {
          setPointerTip(null);
        }
        return;
      }

      // Normal crisp click / tap (either platter-pending released quickly, or Cover diagram tap)
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      const elapsed = performance.now() - downTime;
      const maxDist = e.pointerType === "touch" ? 18 : 9;
      const maxElapsed = e.pointerType === "touch" ? 650 : 550;
      if (dist > maxDist || elapsed > maxElapsed) return;

      const hit = pickAtClientXY(e.clientX, e.clientY);
      if (!hit) return;
      if (hit.kind === "center") {
        propsRef.current.onToggleCenterPlay();
      } else if (hit.kind === "diagram") {
        propsRef.current.onSelectDiagram(hit.diagram);
      } else if (hit.kind === "sound") {
        autoCueLiftTimer = 0.24;
        stylusDropBounce = -0.018;
        propsRef.current.onSelectSector(hit.sound.id);
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", handlePointerDownCapture, { capture: true });
    window.addEventListener("pointermove", handlePointerMove);
    dom.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerup", finishPointerGesture);
    window.addEventListener("pointercancel", finishPointerGesture);

    const ro = new ResizeObserver(() => {
      const w = Math.max(240, container.clientWidth);
      const h = Math.max(240, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (!userOrbited) {
        applyCameraPreset(propsRef.current.cameraPreset, true);
      }
    });
    ro.observe(container);

    // =========================================================================
    // 6. 60fps Direct-Drive Platter Inertia, Stylus Cueing, and 3D Flip Loop
    // =========================================================================
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const specBuf = new Float32Array(24);
    let flipLinear = propsRef.current.plateMode === "cover" ? 1 : 0;
    let sideSwapProgress = 1;
    let pendingSwapTarget: "music" | "sounds" | null = null;
    let rafId = 0;
    let prevClock = performance.now();

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const wallDt = Math.min(0.25, (now - prevClock) / 1000);
      const dt = Math.min(0.05, wallDt);
      prevClock = now;

      const {
        activeId: curActiveId,
        hoveredId: curHoveredId,
        isPlaying: curPlaying,
        stylusParked: curParked,
        progress: curProgress,
        plateMode: curMode,
        activeDiagramId: curDiagramId,
        spinLocked: curSpinLocked
      } = propsRef.current;

      // Lift tonearm cleanly during automatic band-to-band jumps
      if (curActiveId !== prevTrackedBandId) {
        prevTrackedBandId = curActiveId;
        if (dragMode !== "needle") {
          autoCueLiftTimer = 0.25;
        }
      }
      if (autoCueLiftTimer > 0) {
        autoCueLiftTimer = Math.max(0, autoCueLiftTimer - dt);
      }
      stylusDropBounce *= Math.pow(0.04, dt);

      // Subtle glow on headshell when hovered or actively held
      const headshellActive = dragMode === "needle" || isHoveringTonearm;
      headshellMat.emissive.setHex(headshellActive ? 0x5c4212 : 0x000000);

      // Promote stationary finger press (> 145ms on spinning record) to physical platter brake!
      if (dragMode === "platter-pending" && now - downTime > 145 && curPlaying) {
        dragMode = "platter-active";
        fingerTargetOmega = 0;
        renderer.domElement.style.cursor = "grabbing";
        updatePlatterScrubTip(lastMoveX, lastMoveY, pointerIsTouch);
      }

      // Decay finger angular velocity to 0 if finger pauses mid-scrub on the record
      if (dragMode === "platter-active" && now - lastPointerMoveClock > 48) {
        fingerTargetOmega *= Math.pow(0.002, dt);
        platterOmega += (fingerTargetOmega - platterOmega) * Math.min(1, dt * 18);
        updatePlatterScrubTip(lastMoveX, lastMoveY, pointerIsTouch);
      }

      // Handle Side 1 (27 World Music) <-> Side 2 (21 Greetings & Earth Sounds) LP side change
      if (curMode !== "cover") {
        if (curMode !== displayedRecordSide && pendingSwapTarget !== curMode) {
          if (reducedMotion || flipLinear > 0.4) {
            applyGrooveSideMaps(curMode);
            sideSwapProgress = 1;
            pendingSwapTarget = null;
          } else {
            pendingSwapTarget = curMode;
            sideSwapProgress = 0;
          }
        }
      }

      if (sideSwapProgress < 1 && pendingSwapTarget) {
        sideSwapProgress = Math.min(1, sideSwapProgress + wallDt / 0.44);
        if (sideSwapProgress >= 0.5 && displayedRecordSide !== pendingSwapTarget) {
          applyGrooveSideMaps(pendingSwapTarget);
        }
        if (sideSwapProgress >= 1) {
          pendingSwapTarget = null;
        }
      }
      const isSwappingSide = sideSwapProgress < 0.999;
      const swapPulse = isSwappingSide ? Math.sin(sideSwapProgress * Math.PI) : 0;

      // Deterministic 0.55s smoothstep 180-degree 3D flip (Record 0 <-> Cover Plate PI)
      const targetLinear = curMode === "cover" ? 1 : 0;
      if (flipLinear !== targetLinear) {
        const step = reducedMotion ? 1 : wallDt / 0.55;
        if (targetLinear > flipLinear) {
          flipLinear = Math.min(1, flipLinear + step);
        } else {
          flipLinear = Math.max(0, flipLinear - step);
        }
      }
      const easedFlip = flipLinear * flipLinear * (3 - 2 * flipLinear);
      const currentFlipAngle = easedFlip * Math.PI;
      const flipSin = Math.sin(currentFlipAngle);
      flipGroup.rotation.x = currentFlipAngle;
      flipGroup.rotation.z = swapPulse * 0.14;
      flipGroup.position.y = flipSin * 1.08 + swapPulse * 0.34;
      plinthGroup.position.y = -flipSin * 2.95;

      const isFlipping = flipLinear > 0.001 && flipLinear < 0.999;

      // Direct-Drive Platter Rotational Physics (16⅔ RPM motor torque + rotational inertia)
      if (curMode === "cover") {
        const rem = ((discGroup.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const shortest = rem > Math.PI ? rem - Math.PI * 2 : rem;
        discGroup.rotation.y -= shortest * (reducedMotion ? 1 : Math.min(1, dt * 8.5));
        platterOmega = 0;
        audioEngine.updatePlatterMotion(curPlaying ? 1 : 0, false, dt);
      } else {
        if (dragMode !== "platter-active") {
          const targetMotorOmega =
            isSwappingSide
              ? 3.4
              : curPlaying && !curSpinLocked && !isFlipping
                ? NOMINAL_OMEGA
                : 0;
          // Motor torque spin-up (~0.38s) vs heavy copper platter spin-down coast (~0.75s)
          const accelRate = targetMotorOmega > platterOmega ? 5.6 : 2.9;
          platterOmega += (targetMotorOmega - platterOmega) * Math.min(1, dt * accelRate);
          if (Math.abs(platterOmega) < 0.002 && targetMotorOmega === 0) {
            platterOmega = 0;
          }
          if (!reducedMotion && !isFlipping) {
            discGroup.rotation.y -= platterOmega * dt;
          }
        }
        const speedRatio = platterOmega / NOMINAL_OMEGA;
        audioEngine.updatePlatterMotion(speedRatio, dragMode === "platter-active", dt);
      }

      // Real-time audio spectrum for groove luminance & stylus cantilever micro-vibration
      const energy = audioEngine.readSpectrum(specBuf, now * 0.001);

      // Update concentric LP groove highlights for the currently displayed LP side
      const activeCandidate =
        curMode !== "cover" && !curParked
          ? (GOLDEN_SOUNDS.find((s) => s.id === curActiveId) ?? null)
          : null;
      const activeSound =
        activeCandidate && activeCandidate.side === displayedRecordSide
          ? activeCandidate
          : null;

      const hoverCandidate =
        curMode !== "cover" && curHoveredId && curHoveredId !== curActiveId
          ? (GOLDEN_SOUNDS.find((s) => s.id === curHoveredId) ?? null)
          : null;
      const hoverSound =
        hoverCandidate && hoverCandidate.side === displayedRecordSide
          ? hoverCandidate
          : null;

      lastActiveHighlightKey = updateRingHighlight(
        activeBandHighlight,
        activeSound,
        activeSound?.id ?? "",
        lastActiveHighlightKey
      );
      activeBandHighlight.fillMat.opacity = curPlaying ? 0.22 + energy * 0.16 : 0.16;

      lastHoverHighlightKey = updateRingHighlight(
        hoverBandHighlight,
        hoverSound,
        hoverSound?.id ?? "",
        lastHoverHighlightKey
      );

      // Update Cover Plate etched diagram reticle
      if (curMode === "cover" && !isFlipping) {
        const diagId = hoveredDiagramId ?? curDiagramId;
        const diag = diagId
          ? (COVER_DIAGRAMS.find((d) => d.id === diagId) ?? null)
          : null;
        positionCoverHighlight(diag);
      } else {
        positionCoverHighlight(null);
      }

      // Articulate Physical Tonearm & Cartridge Stylus
      let desiredRadius = parkRadius;
      let desiredPitch = 0.042; // Resting in U-cradle
      let trackingEngaged = false;

      if (dragMode === "needle") {
        desiredRadius = needleDragRadius;
        desiredPitch = 0.082; // Lifted cleanly by user's hand
      } else if (curMode !== "cover" && !isFlipping && !isSwappingSide && activeSound && !curParked) {
        desiredRadius =
          activeSound.rOuter -
          (activeSound.rOuter - activeSound.rInner) * (0.08 + 0.84 * curProgress);
        if (autoCueLiftTimer > 0) {
          desiredPitch = 0.068; // Cueing lever up while swinging across grooves
        } else if (curPlaying) {
          desiredPitch = -0.009 + stylusDropBounce;
          trackingEngaged = true;
        } else {
          desiredPitch = 0.032; // Cued just above active groove when paused
        }
      }

      const yawLerp = dragMode === "needle" ? Math.min(1, dt * 26) : Math.min(1, dt * 7.5);
      const pitchLerp = dragMode === "needle" ? Math.min(1, dt * 18) : Math.min(1, dt * 10);

      // Subtle 16⅔ RPM spindle eccentricity sway + real-time audio groove micro-vibration
      const runoutSway = trackingEngaged ? Math.sin(discGroup.rotation.y) * 0.0014 : 0;
      const grooveMicroVib =
        trackingEngaged && !reducedMotion
          ? energy * 0.0024 * Math.sin(now * 0.085)
          : 0;

      const desiredYaw = computeYawForRadius(desiredRadius) + runoutSway;
      currentArmYaw += (desiredYaw - currentArmYaw) * yawLerp;
      currentArmPitch += (desiredPitch - currentArmPitch) * pitchLerp;
      armYawGroup.rotation.y = currentArmYaw;
      armPitchGroup.rotation.z = currentArmPitch + grooveMicroVib;

      if (presetAnimating) {
        camera.position.lerp(presetTargetPos, Math.min(1, dt * 5.5));
        controls.target.lerp(presetTargetLook, Math.min(1, dt * 5.5));
        if (camera.position.distanceTo(presetTargetPos) < 0.03) {
          presetAnimating = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.removeEventListener("start", cancelPresetOnUserDrag);
      dom.removeEventListener("pointerdown", handlePointerDownCapture, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove);
      dom.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerup", finishPointerGesture);
      window.removeEventListener("pointercancel", finishPointerGesture);
      controls.dispose();
      contactShadowTex.dispose();
      studioEnv.dispose();
      circularAnisoMap.dispose();
      diagonalAnisoMap.dispose();
      musicMaps.albedoMap.dispose();
      musicMaps.roughnessMap.dispose();
      musicMaps.normalMap.dispose();
      soundsMaps.albedoMap.dispose();
      soundsMaps.roughnessMap.dispose();
      soundsMaps.normalMap.dispose();
      centerLabelTex.dispose();
      coverAlbedo.dispose();
      coverBump.dispose();
      coverRough.dispose();
      coverMetal.dispose();
      coverEmissive.dispose();
      headshellMat.dispose();
      renderer.dispose();
      if (dom.parentNode === container) {
        container.removeChild(dom);
      }
    };
  }, []);

  // Trigger smooth camera preset glide whenever cameraPreset prop changes
  useEffect(() => {
    applyCameraRef.current?.(cameraPreset);
  }, [cameraPreset]);

  return (
    <div className="plate-canvas-stage" ref={mountRef}>
      {pointerTip && pointerTip.kind === "sound" && (
        <div
          className="plate-hover-chip"
          style={{
            transform: `translate3d(${Math.round(pointerTip.x + 14)}px, ${Math.round(
              Math.max(12, pointerTip.y - 42)
            )}px, 0)`
          }}
        >
          <span
            className="plate-hover-badge"
            style={{
              backgroundColor: RING_CHAPTERS[pointerTip.sound.ring].pillBg,
              color: RING_CHAPTERS[pointerTip.sound.ring].pillInk
            }}
          >
            {pointerTip.sound.code} · {pointerTip.sound.country}
          </span>
          <span className="plate-hover-title">{pointerTip.sound.title}</span>
          <span className="plate-hover-dur">{pointerTip.sound.durationLabel}</span>
        </div>
      )}

      {pointerTip && pointerTip.kind === "tonearm-hint" && (
        <div
          className="plate-hover-chip"
          style={{
            transform: `translate3d(${Math.round(
              Math.max(12, pointerTip.x - 170)
            )}px, ${Math.round(Math.max(12, pointerTip.y - 42))}px, 0)`
          }}
        >
          <span
            className="plate-hover-badge"
            style={{ backgroundColor: "#F8EED8", color: "#7B5316" }}
          >
            Stylus
          </span>
          <span className="plate-hover-title">Drag needle onto any groove</span>
        </div>
      )}

      {pointerTip && pointerTip.kind === "needle-cue" && (
        <div
          className="plate-hover-chip is-active-gesture"
          style={{
            transform: `translate3d(${Math.round(
              Math.max(12, pointerTip.x - (pointerTip.isTouch ? 110 : -14))
            )}px, ${Math.round(
              Math.max(12, pointerTip.y - (pointerTip.isTouch ? 68 : 44))
            )}px, 0)`
          }}
        >
          <span
            className="plate-hover-badge"
            style={{
              backgroundColor: RING_CHAPTERS[pointerTip.sound.ring].pillBg,
              color: RING_CHAPTERS[pointerTip.sound.ring].pillInk
            }}
          >
            Drop · {pointerTip.sound.code} {pointerTip.sound.country}
          </span>
          <span className="plate-hover-title">{pointerTip.sound.title}</span>
          <span className="plate-hover-dur">@ {formatCueTime(pointerTip.cueSec)}</span>
        </div>
      )}

      {pointerTip && pointerTip.kind === "needle-park" && (
        <div
          className="plate-hover-chip is-active-gesture"
          style={{
            transform: `translate3d(${Math.round(
              Math.max(12, pointerTip.x - 130)
            )}px, ${Math.round(
              Math.max(12, pointerTip.y - (pointerTip.isTouch ? 68 : 44))
            )}px, 0)`
          }}
        >
          <span
            className="plate-hover-badge"
            style={{ backgroundColor: "#F8EED8", color: "#7B5316" }}
          >
            Rest Cradle
          </span>
          <span className="plate-hover-title">Release to park needle</span>
        </div>
      )}

      {pointerTip && pointerTip.kind === "platter-scrub" && (
        <div
          className="plate-hover-chip is-active-gesture"
          style={{
            transform: `translate3d(${Math.round(
              Math.max(12, pointerTip.x - (pointerTip.isTouch ? 95 : -14))
            )}px, ${Math.round(
              Math.max(12, pointerTip.y - (pointerTip.isTouch ? 68 : 42))
            )}px, 0)`
          }}
        >
          <span
            className="plate-hover-badge"
            style={{ backgroundColor: "#F8EED8", color: "#7B5316" }}
          >
            {pointerTip.rpmLabel}
          </span>
          <span className="plate-hover-title">{pointerTip.label}</span>
        </div>
      )}

      {pointerTip && pointerTip.kind === "diagram" && (
        <div
          className="plate-hover-chip"
          style={{
            transform: `translate3d(${Math.round(pointerTip.x + 14)}px, ${Math.round(
              Math.max(12, pointerTip.y - 46)
            )}px, 0)`
          }}
        >
          <span
            className="plate-hover-badge"
            style={{
              backgroundColor: "#F8EED8",
              color: "#7B5316"
            }}
          >
            Diagram {pointerTip.diagram.code}
          </span>
          <span className="plate-hover-title">{pointerTip.diagram.title}</span>
          <span className="plate-hover-dur">
            → {pointerTip.sound.country} · {pointerTip.sound.title}
          </span>
        </div>
      )}
    </div>
  );
}
