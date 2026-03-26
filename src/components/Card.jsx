// src/components/Card.jsx
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const CARD_WIDTH = 2.5;
const CARD_HEIGHT = 3.5;
const CARD_DEPTH = 0.0018;
const CARD_SHELL_INSET = 0.02;
const CARD_FACE_OFFSET = 0.00102;
const CARD_FINISH_OFFSET = 0.00124;
const CARD_DIAGONAL_OFFSET = 0.00142;
const CARD_SPARKLE_OFFSET = 0.0016;
const CARD_SPARKLE_PLANE_SCALE_X = 1.26;
const CARD_SPARKLE_PLANE_SCALE_Y = 1.34;
const SHELL_OPACITY = 0.12;
const POSITION_SMOOTHING = 14;
const ROTATION_SMOOTHING = 14;
const SCALE_SMOOTHING_IN = 14;
const SCALE_SMOOTHING_OUT = 8;
const OPACITY_SMOOTHING = 12;
const FOCUS_INTERACTION_PLANE_SCALE = 1.95;
const HOVER_PREVIEW_FACTOR = 0.66;
const DETAIL_ROTATION_X_RANGE = 0.52;
const DETAIL_ROTATION_Y_RANGE = Math.PI * 0.9;
const DETAIL_ROTATION_Z_RANGE = 0.1;
const DETAIL_INPUT_WIDTH = 1.15;
const DETAIL_INPUT_HEIGHT = 1.45;
const BASE_INPUT_WIDTH = 0.7;
const BASE_INPUT_HEIGHT = 0.95;
const REFERENCE_SCREEN_WIDTH = 1440;
const REFERENCE_SCREEN_HEIGHT = 900;
const FINISH_TEXTURE_SIZE = 512;
const ART_REGION = {
  x: 0.108,
  y: 0.118,
  w: 0.784,
  h: 0.424,
  radius: 0.014
};
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
const DEFAULT_FINISH_EFFECT_SETTINGS = Object.freeze({
  normal: true,
  holo: true,
  reverseHolo: true
});
const DEFAULT_SPARKLE_INTENSITY = 6;

let sharedAlphaMap = null;
let sharedSparkleAuraMask = null;
const sharedFinishTextures = {};
const SPARKLE_TEXTURE_CACHE = new Map();
const DIAGONAL_TEXTURE_CACHE = new Map();
const DEFAULT_SPARKLE_PALETTE = ['#bfefff', '#6ea4ff', '#ffeaa4'];
const RARITY_TINTS = {
  chase: '#fff9d0',
  legendary: '#ffd8f0',
  epic: '#c9b7ff',
  rare: '#9ef6ff',
  common: '#bfefff'
};

const DEFAULT_SPARKLE_SETTINGS = {
  enabled: true,
  opacity: 1,
  intensity: 1,
  size: 0.5,
  speed: 0.5,
  quantity: 0.65
};

const DEFAULT_SHIMMER_SETTINGS = {
  enabled: true,
  opacity: 0.55,
  intensity: 0.6,
  size: 0.35,
  speed: 0.5
};

const DEFAULT_PRICE_LABEL_SETTINGS = {
  enabled: true,
  fontSize: '11px',
  fontColor: '#ffffff'
};

const PALETTE_SAMPLE_SIZE = 40;
const PALETTE_MAX_COLORS = 3;
const PALETTE_QUANTIZATION_STEP = 16;
const PALETTE_MIN_ALPHA = 32;
const PALETTE_SKIP_WHITE = 248;
const PALETTE_SKIP_BLACK = 10;

function quantizeChannel(value) {
  return Math.max(
    0,
    Math.min(255, Math.round(value / PALETTE_QUANTIZATION_STEP) * PALETTE_QUANTIZATION_STEP)
  );
}

function colorKeyToHex(key = '') {
  const parts = key.split(',').map((part) => Number(part) || 0);
  const [r, g, b] = parts;
  const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  return `#${hex}`;
}

function shouldSkipColor(r, g, b) {
  const average = (r + g + b) / 3;
  return average >= PALETTE_SKIP_WHITE || average <= PALETTE_SKIP_BLACK;
}

function buildPaletteFromImageData(data = [], fallbackPalette = []) {
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < PALETTE_MIN_ALPHA) continue;
    const r = quantizeChannel(data[i]);
    const g = quantizeChannel(data[i + 1]);
    const b = quantizeChannel(data[i + 2]);
    if (shouldSkipColor(r, g, b)) continue;
    const key = `${r},${g},${b}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  if (counts.size === 0) {
    return fallbackPalette.slice(0, PALETTE_MAX_COLORS);
  }

  const sorted = Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([key]) => colorKeyToHex(key))
    .filter((value, index, array) => array.indexOf(value) === index);

  if (sorted.length === 0) {
    return fallbackPalette.slice(0, PALETTE_MAX_COLORS);
  }

  return sorted.slice(0, PALETTE_MAX_COLORS);
}

function useDerivedPaletteFromImage(imageUrl, fallbackPalette, dependencyKey) {
  const fallbackKey = Array.isArray(fallbackPalette) ? fallbackPalette.join('|') : '';
  const [derivedPalette, setDerivedPalette] = useState([]);

  useEffect(() => {
    if (!imageUrl || typeof document === 'undefined') {
      setDerivedPalette([]);
      return undefined;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = PALETTE_SAMPLE_SIZE;
      canvas.height = PALETTE_SAMPLE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setDerivedPalette([]);
        cleanup();
        return;
      }

      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.warn('Palette sampling failed:', error);
        setDerivedPalette([]);
        cleanup();
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const palette = buildPaletteFromImageData(imageData, fallbackPalette);
      if (!cancelled) {
        setDerivedPalette(palette);
      }
    };

    img.onerror = () => {
      if (!cancelled) {
        setDerivedPalette([]);
      }
      cleanup();
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [imageUrl, dependencyKey, fallbackKey]);

  return derivedPalette;
}

function makeRoundedAlphaMap(size = 256, radius = 24) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getRoundedAlphaMap() {
  if (!sharedAlphaMap) {
    sharedAlphaMap = makeRoundedAlphaMap(256, 24);
  }
  return sharedAlphaMap;
}

function makeSparkleAuraMask(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const insetX = size * ((CARD_SPARKLE_PLANE_SCALE_X - 1) / (CARD_SPARKLE_PLANE_SCALE_X * 2));
  const insetY = size * ((CARD_SPARKLE_PLANE_SCALE_Y - 1) / (CARD_SPARKLE_PLANE_SCALE_Y * 2));
  const innerWidth = size - insetX * 2;
  const innerHeight = size - insetY * 2;
  const radius = Math.min(innerWidth, innerHeight) * 0.048;

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(insetX + radius, insetY);
  ctx.lineTo(insetX + innerWidth - radius, insetY);
  ctx.quadraticCurveTo(insetX + innerWidth, insetY, insetX + innerWidth, insetY + radius);
  ctx.lineTo(insetX + innerWidth, insetY + innerHeight - radius);
  ctx.quadraticCurveTo(
    insetX + innerWidth,
    insetY + innerHeight,
    insetX + innerWidth - radius,
    insetY + innerHeight
  );
  ctx.lineTo(insetX + radius, insetY + innerHeight);
  ctx.quadraticCurveTo(insetX, insetY + innerHeight, insetX, insetY + innerHeight - radius);
  ctx.lineTo(insetX, insetY + radius);
  ctx.quadraticCurveTo(insetX, insetY, insetX + radius, insetY);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getSparkleAuraMask() {
  if (!sharedSparkleAuraMask) {
    sharedSparkleAuraMask = makeSparkleAuraMask(256);
  }
  return sharedSparkleAuraMask;
}

function pathRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function paintHoloPrismPattern(ctx, size) {
  const rainbow = ctx.createLinearGradient(0, 0, size, size);
  rainbow.addColorStop(0, 'rgba(255, 92, 194, 0.46)');
  rainbow.addColorStop(0.2, 'rgba(122, 200, 255, 0.42)');
  rainbow.addColorStop(0.42, 'rgba(134, 255, 236, 0.38)');
  rainbow.addColorStop(0.62, 'rgba(183, 143, 255, 0.42)');
  rainbow.addColorStop(0.84, 'rgba(112, 221, 255, 0.36)');
  rainbow.addColorStop(1, 'rgba(255, 223, 116, 0.4)');
  ctx.fillStyle = rainbow;
  ctx.fillRect(0, 0, size, size);

  for (let i = -1; i < 14; i += 1) {
    const stripe = ctx.createLinearGradient(
      i * (size / 7),
      0,
      i * (size / 7) + size * 0.42,
      size
    );
    stripe.addColorStop(0, 'rgba(255,255,255,0)');
    stripe.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    stripe.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.4;
  for (let y = 0; y < size + 54; y += 54) {
    for (let x = 0; x < size + 54; x += 54) {
      const cx = x + (Math.floor(y / 54) % 2 ? 27 : 0);
      const cy = y;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx + 16, cy);
      ctx.lineTo(cx, cy + 16);
      ctx.lineTo(cx - 16, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function paintReverseHoloPattern(ctx, size) {
  const base = ctx.createLinearGradient(0, size, size, 0);
  base.addColorStop(0, 'rgba(35, 170, 244, 0.26)');
  base.addColorStop(0.5, 'rgba(120, 226, 255, 0.22)');
  base.addColorStop(1, 'rgba(45, 150, 255, 0.3)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let y = -14; y < size + 14; y += 20) {
    ctx.fillStyle = y % 40 === 0
      ? 'rgba(255,255,255,0.1)'
      : 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, y, size, 6);
  }

  for (let i = 0; i < 36; i += 1) {
    const cx = ((i * 83 + 29) % size);
    const cy = ((i * 121 + 71) % size);
    const radius = 9 + ((i * 7) % 22);
    ctx.strokeStyle = i % 2 === 0
      ? 'rgba(255,255,255,0.13)'
      : 'rgba(98, 231, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const shimmer = ctx.createLinearGradient(0, 0, size, 0);
  shimmer.addColorStop(0, 'rgba(255,255,255,0)');
  shimmer.addColorStop(0.45, 'rgba(255,255,255,0.1)');
  shimmer.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  shimmer.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(0, 0, size, size);
}

function paintNormalGlossPattern(ctx, size) {
  const gloss = ctx.createLinearGradient(0, 0, size, 0);
  gloss.addColorStop(0, 'rgba(255,255,255,0.06)');
  gloss.addColorStop(0.5, 'rgba(255,255,255,0.24)');
  gloss.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, size, size);
}

function makeFinishTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = FINISH_TEXTURE_SIZE;
  canvas.height = FINISH_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const size = FINISH_TEXTURE_SIZE;
  ctx.clearRect(0, 0, size, size);

  const artX = Math.round(size * ART_REGION.x);
  const artY = Math.round(size * ART_REGION.y);
  const artW = Math.round(size * ART_REGION.w);
  const artH = Math.round(size * ART_REGION.h);
  const artRadius = Math.round(size * ART_REGION.radius);

  if (type === 'holo') {
    ctx.save();
    pathRoundedRect(ctx, artX, artY, artW, artH, artRadius);
    ctx.clip();
    paintHoloPrismPattern(ctx, size);
    ctx.restore();
  } else if (type === 'reverse_holo') {
    paintReverseHoloPattern(ctx, size);
    // Art box stays mostly unfoiled for reverse holo cards.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    pathRoundedRect(ctx, artX, artY, artW, artH, artRadius);
    ctx.fill();
    ctx.restore();
  } else {
    paintNormalGlossPattern(ctx, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (type === 'holo') {
    texture.repeat.set(1, 1);
  } else if (type === 'reverse_holo') {
    texture.repeat.set(1, 1);
  } else {
    texture.repeat.set(1.05, 1);
  }
  texture.needsUpdate = true;
  return texture;
}

function getFinishTexture(type) {
  if (!sharedFinishTextures[type]) {
    sharedFinishTextures[type] = makeFinishTexture(type);
  }
  return sharedFinishTextures[type];
}

function isFinishEffectEnabled(type, settings) {
  if (type === 'holo') return settings.holo !== false;
  if (type === 'reverse_holo') return settings.reverseHolo !== false;
  return settings.normal !== false;
}

function getFinishBaseOpacity(type) {
  if (type === 'holo') return 0.34;
  if (type === 'reverse_holo') return 0.24;
  return 0.15;
}

function normalizeSparkleIntensity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SPARKLE_INTENSITY;
  return THREE.MathUtils.clamp(Math.round(numeric), 1, 10);
}

function getSparkleOpacityScale(intensity) {
  return THREE.MathUtils.lerp(0.3, 1.0, (normalizeSparkleIntensity(intensity) - 1) / 9);
}

function getSparkleMotionScale(intensity) {
  return THREE.MathUtils.lerp(0.7, 1.5, (normalizeSparkleIntensity(intensity) - 1) / 9);
}

function getSparkleVisibility(intensity) {
  return THREE.MathUtils.lerp(0.16, 0.72, (normalizeSparkleIntensity(intensity) - 1) / 9);
}

function getSparkleRepeat(intensity) {
  const normalized = normalizeSparkleIntensity(intensity);
  return THREE.MathUtils.lerp(1.05, 1.35, (normalized - 1) / 9);
}

function clamp01(value) {
  if (typeof value !== 'number') return 0;
  return Math.max(0, Math.min(1, value));
}

function colorToRgba(value, alpha) {
  let color;
  try {
    color = new THREE.Color(value);
  } catch {
    color = new THREE.Color('#ffffff');
  }
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r},${g},${b},${safeAlpha})`;
}

function drawTwinkleStar(ctx, x, y, outerRadius, innerRadius, rotation = 0) {
  const points = 4;
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotation + (Math.PI * index) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function drawShineFlare(ctx, x, y, length, width, rotation, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const flare = ctx.createLinearGradient(-length, 0, length, 0);
  flare.addColorStop(0, colorToRgba(color, 0));
  flare.addColorStop(0.5, colorToRgba(color, alpha));
  flare.addColorStop(1, colorToRgba(color, 0));
  ctx.fillStyle = flare;
  ctx.beginPath();
  ctx.moveTo(-length, 0);
  ctx.quadraticCurveTo(-length * 0.25, -width, 0, 0);
  ctx.quadraticCurveTo(length * 0.25, width, length, 0);
  ctx.quadraticCurveTo(length * 0.25, -width, 0, 0);
  ctx.quadraticCurveTo(-length * 0.25, width, -length, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintDiagonalLineTexture(
  ctx,
  size,
  palette,
  coverage,
  sizeFactor = 0.5
) {
  ctx.clearRect(0, 0, size, size);
  const coverageFactor = clamp01(coverage);
  if (coverageFactor <= 0) return;

  const normalizedSize = clamp01(sizeFactor);
  const normalizedPalette =
    palette && palette.length > 0 ? palette : DEFAULT_SPARKLE_PALETTE;
  const primaryColor = normalizedPalette[0] || '#ffffff';
  const secondaryColor = normalizedPalette[1] || primaryColor;
  const highlightColor = normalizedPalette[2] || secondaryColor;
  const lineCount = Math.max(1, Math.round(coverageFactor * 6));
  const lineStartY = -size * 0.35;
  const lineEndY = size * 1.35;
  const slope = size;
  const anchors = Array.from({ length: lineCount }, (_, index) => (index + 0.5) / lineCount);
  const widthScale = 0.032 + coverageFactor * 0.05 * (0.7 + normalizedSize * 0.9);

  anchors.forEach((anchor) => {
    const startX = size * anchor;
    const endX = startX - slope;
    const bandGrad = ctx.createLinearGradient(startX, lineStartY, endX, lineEndY);
    bandGrad.addColorStop(0, colorToRgba(primaryColor, 0));
    bandGrad.addColorStop(0.2, colorToRgba(secondaryColor, 0.16 + coverageFactor * 0.22));
    bandGrad.addColorStop(0.5, colorToRgba(highlightColor, 0.52 + coverageFactor * 0.18));
    bandGrad.addColorStop(0.8, colorToRgba(secondaryColor, 0.14 + coverageFactor * 0.18));
    bandGrad.addColorStop(1, colorToRgba(primaryColor, 0));

    ctx.lineCap = 'round';
    ctx.strokeStyle = bandGrad;
    ctx.lineWidth = size * widthScale;
    ctx.beginPath();
    ctx.moveTo(startX, lineStartY);
    ctx.lineTo(endX, lineEndY);
    ctx.stroke();

    ctx.strokeStyle = colorToRgba('#ffffff', 0.2 + coverageFactor * 0.3);
    ctx.lineWidth = size * (0.008 + normalizedSize * 0.01);
    ctx.beginPath();
    ctx.moveTo(startX, lineStartY);
    ctx.lineTo(endX, lineEndY);
    ctx.stroke();
  });
}

function paintSparkleTexture(
  ctx,
  size,
  palette,
  quantityFactor = 0.65,
  sizeFactor = 0.5
) {
  ctx.clearRect(0, 0, size, size);
  const normalizedSize = clamp01(sizeFactor);
  const normalizedQuantity = clamp01(quantityFactor);
  const densityScale = 0.7 + normalizedQuantity * 1.8;
  const normalizedPalette =
    palette && palette.length > 0 ? palette : DEFAULT_SPARKLE_PALETTE;
  const highlightColor = normalizedPalette[2] || normalizedPalette[1] || normalizedPalette[0] || '#ffffff';

  const sparkleCount = Math.max(
    10,
    Math.round((18 + normalizedQuantity * 44) * densityScale)
  );
  for (let index = 0; index < sparkleCount; index += 1) {
    const color = normalizedPalette[index % normalizedPalette.length] || highlightColor;
    const px = ((index * 73) % 1000) / 1000;
    const py = ((index * 197 + 131) % 1000) / 1000;
    const twinkle = 0.5 + (((index * 53) % 100) / 100) * 0.5;
    const x = px * size;
    const y = py * size;
    const radius = size * (0.004 + normalizedSize * 0.012 + (index % 3) * 0.0025);
    const glowRadius = radius * (2.4 + twinkle);
    const starRotation = ((index * 37) % 360) * (Math.PI / 180);

    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, colorToRgba(color, 0.95 * twinkle));
    glow.addColorStop(0.25, colorToRgba(color, 0.45 * twinkle));
    glow.addColorStop(1, colorToRgba(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colorToRgba(color, 0.82 * twinkle);
    drawTwinkleStar(ctx, x, y, radius * 2.1, radius * 0.55, starRotation);
    ctx.fill();

    ctx.fillStyle = colorToRgba('#ffffff', 0.96 * twinkle);
    drawTwinkleStar(ctx, x, y, radius * 1.15, radius * 0.28, starRotation + Math.PI / 4);
    ctx.fill();

    drawShineFlare(
      ctx,
      x,
      y,
      glowRadius * 0.95,
      radius * 0.95,
      starRotation + Math.PI / 8,
      '#ffffff',
      0.42 * twinkle
    );
    drawShineFlare(
      ctx,
      x,
      y,
      glowRadius * 0.7,
      radius * 0.55,
      starRotation + Math.PI / 2.8,
      color,
      0.35 * twinkle
    );

    ctx.strokeStyle = colorToRgba(color, 0.42 * twinkle);
    ctx.lineWidth = Math.max(0.8, radius * 0.22);
    ctx.beginPath();
    ctx.moveTo(x - glowRadius * 0.8, y);
    ctx.lineTo(x + glowRadius * 0.8, y);
    ctx.moveTo(x, y - glowRadius * 0.95);
    ctx.lineTo(x, y + glowRadius * 0.95);
    ctx.stroke();
  }
}

function makeSparkleTexture({
  size = 512,
  palette = DEFAULT_SPARKLE_PALETTE,
  quantityFactor = DEFAULT_SPARKLE_SETTINGS.quantity,
  sizeFactor = DEFAULT_SPARKLE_SETTINGS.size
}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  paintSparkleTexture(ctx, size, palette, quantityFactor, sizeFactor);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function getSparkleTextureForOptions({
  palette,
  quantityFactor = DEFAULT_SPARKLE_SETTINGS.quantity,
  sizeFactor = DEFAULT_SPARKLE_SETTINGS.size
}) {
  const normalizedPalette =
    palette && palette.length > 0 ? palette : DEFAULT_SPARKLE_PALETTE;
  const key = `${normalizedPalette.join('|')}|q${clamp01(quantityFactor).toFixed(
    3
  )}|s${clamp01(sizeFactor).toFixed(3)}`;
  if (SPARKLE_TEXTURE_CACHE.has(key)) {
    return SPARKLE_TEXTURE_CACHE.get(key);
  }
  const texture = makeSparkleTexture({
    palette: normalizedPalette,
    quantityFactor: clamp01(quantityFactor),
    sizeFactor: clamp01(sizeFactor)
  });
  if (texture) {
    SPARKLE_TEXTURE_CACHE.set(key, texture);
  }
  return texture;
}

function makeDiagonalTexture({
  size = 512,
  palette = DEFAULT_SPARKLE_PALETTE,
  diagonalCoverage = 1,
  sizeFactor = DEFAULT_SHIMMER_SETTINGS.size
}) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  paintDiagonalLineTexture(ctx, size, palette, diagonalCoverage, sizeFactor);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function getDiagonalTextureForOptions({
  palette,
  diagonalCoverage,
  sizeFactor = DEFAULT_SHIMMER_SETTINGS.size
}) {
  const normalizedPalette =
    palette && palette.length > 0 ? palette : DEFAULT_SPARKLE_PALETTE;
  const key = `${normalizedPalette.join('|')}|c${clamp01(diagonalCoverage).toFixed(
    3
  )}|s${clamp01(sizeFactor).toFixed(3)}`;
  if (DIAGONAL_TEXTURE_CACHE.has(key)) {
    return DIAGONAL_TEXTURE_CACHE.get(key);
  }
  const texture = makeDiagonalTexture({
    palette: normalizedPalette,
    diagonalCoverage: clamp01(diagonalCoverage),
    sizeFactor: clamp01(sizeFactor)
  });
  if (texture) {
    DIAGONAL_TEXTURE_CACHE.set(key, texture);
  }
  return texture;
}

function CardContentWithTexture({
  frontTexture,
  backTexture,
  alphaMap,
  frontMaterialRef,
  backMaterialRef,
  renderOrderBase = 0
}) {
  return (
    <group>
      <mesh renderOrder={renderOrderBase}>
        <RoundedBox
          args={[CARD_WIDTH - CARD_SHELL_INSET, CARD_HEIGHT - CARD_SHELL_INSET, CARD_DEPTH]}
          radius={0.085}
          smoothness={4}
        >
          <meshStandardMaterial color="#181818" transparent opacity={SHELL_OPACITY} />
        </RoundedBox>
      </mesh>
      <mesh position={[0, 0, CARD_FACE_OFFSET]} renderOrder={renderOrderBase + 2}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial
          ref={frontMaterialRef}
          map={frontTexture}
          alphaMap={alphaMap || null}
          transparent
          alphaTest={0.03}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
          toneMapped={false}
          side={THREE.FrontSide}
          opacity={1}
        />
      </mesh>
      <mesh
        position={[0, 0, -CARD_FACE_OFFSET]}
        rotation={[0, Math.PI, 0]}
        renderOrder={renderOrderBase + 1}
      >
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial
          ref={backMaterialRef}
          map={backTexture}
          alphaMap={alphaMap || null}
          transparent
          alphaTest={0.03}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
          toneMapped={false}
          side={THREE.FrontSide}
          opacity={1}
        />
      </mesh>
    </group>
  );
}

function CardContentFallback({ alphaMap = null, renderOrderBase = 0 }) {
  return (
    <mesh renderOrder={renderOrderBase + 2}>
      <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
      <meshStandardMaterial
        color="#4b4b4b"
        emissive="#222222"
        alphaMap={alphaMap || null}
        transparent
        alphaTest={0.03}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function PricePanel({
  marketPrice,
  instantBuyBackPrice,
  variant = 'detail',
  muted = false,
  emphasized = false,
  fontSize = DEFAULT_PRICE_LABEL_SETTINGS.fontSize,
  fontColor = DEFAULT_PRICE_LABEL_SETTINGS.fontColor
}) {
  const marketValue = String(marketPrice ?? '').trim();
  const buyBackValue = String(instantBuyBackPrice ?? '').trim();

  if (variant === 'gallery') {
    const primaryColor = muted ? 'rgba(150,150,150,0.34)' : '#72ff90';
    const secondaryColor = muted ? 'rgba(118,118,118,0.26)' : 'rgba(172,255,191,0.9)';
    const shadowColor = muted ? 'rgba(120,120,120,0.04)' : 'rgba(48,255,107,0.22)';
    return (
      <Html
        center
        position={[0, -CARD_HEIGHT / 2 - 0.34, 0.04]}
        style={{ pointerEvents: 'none', zIndex: 30 }}
      >
        <div
          style={{
            color: primaryColor,
            fontFamily: 'system-ui',
            textAlign: 'center',
            lineHeight: 1.05,
            textShadow: `0 0 14px ${shadowColor}`,
            opacity: muted ? 0.28 : 1,
            transform: emphasized ? 'scale(1.22)' : 'scale(1)',
            transformOrigin: 'center center'
          }}
        >
          <div
            style={{
              fontSize: emphasized ? '23px' : '18px',
              fontWeight: 800,
              letterSpacing: '0.01em'
            }}
          >
            {marketValue || buyBackValue || '\u00A0'}
          </div>
          {buyBackValue && buyBackValue !== marketValue && (
            <div
              style={{
                fontSize: '10px',
                color: secondaryColor,
                marginTop: '3px',
                whiteSpace: 'nowrap'
              }}
            >
              Buy Back {buyBackValue}
            </div>
          )}
        </div>
      </Html>
    );
  }

  return (
    <Html
      center
      position={[0, -CARD_HEIGHT / 2 - 0.46, 0.04]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          width: '170px',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '10px',
          padding: '8px 10px',
          background: 'rgba(0,0,0,0.58)',
          color: fontColor,
          fontSize,
          fontFamily: 'system-ui',
          lineHeight: 1.35
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Market Price</span>
          <span style={{ minWidth: '40px', textAlign: 'right' }}>{marketValue || '\u00A0'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Instant Buy Back</span>
          <span style={{ minWidth: '40px', textAlign: 'right' }}>{buyBackValue || '\u00A0'}</span>
        </div>
      </div>
    </Html>
  );
}

function getDampFactor(speed, delta) {
  return 1 - Math.exp(-speed * delta);
}

function vectorsEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  }
  return true;
}

function Card({
  frontUrl, 
  backUrl, 
  position, 
  rotation, 
  index, 
  focusedIndex, 
  hovered = false,
  onHover, 
  onHoverOut,
  enableDragTilt = true,
  enableFocusLift = true,
  enableDimming = true,
  interactive = true,
  interactionMode = 'drag',
  baseScale = 1,
  onCardTap = null,
  transformMode = 'smooth',
  showPricePanel = false,
  priceLabelVariant = 'detail',
  priceLabelMuted = false,
  priceLabelEmphasized = false,
  marketPrice = '',
  instantBuyBackPrice = '',
  finishType = 'normal',
  finishEffectSettings = DEFAULT_FINISH_EFFECT_SETTINGS,
  sparkleIntensity = DEFAULT_SPARKLE_INTENSITY,
  sparklePalette = DEFAULT_SPARKLE_PALETTE,
  sparklePaletteKey = DEFAULT_SPARKLE_PALETTE.join('|'),
  diagonalPalette = DEFAULT_SPARKLE_PALETTE,
  diagonalPaletteKey = DEFAULT_SPARKLE_PALETTE.join('|'),
  hasExplicitPalette = false,
  sparkleVfxFactor = null,
  diagonalCoverage = 1,
  rarity = 'common',
  sparkleSettings = DEFAULT_SPARKLE_SETTINGS,
  shimmerSettings = DEFAULT_SHIMMER_SETTINGS,
  priceLabelSettings = DEFAULT_PRICE_LABEL_SETTINGS,
  onCursorChange = () => {},
  onBoundedPointerEnter = () => {},
  onBoundedPointerLeave = () => {}
  ,
  renderOrder = 0
}) {
  const { size } = useThree();
  const groupRef = useRef();
  const cardVisualRef = useRef();
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.renderOrder = renderOrder;
    }
  }, [renderOrder]);
  const frontMaterialRef = useRef();
  const backMaterialRef = useRef();
  const finishMaterialRef = useRef();
  const diagonalMaterialRef = useRef();
  const sparkleMaterialRef = useRef();
  const hoverTiltRef = useRef({ x: 0, y: 0 });
  const detailTiltOriginRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const hasValidUrls = Boolean(frontUrl) && Boolean(backUrl);
  const alphaMap = useMemo(() => getRoundedAlphaMap(), []);
  const sparkleAuraMask = useMemo(() => getSparkleAuraMask(), []);
  const [frontTextureRaw, backTextureRaw] = useTexture([
    frontUrl || TRANSPARENT_PIXEL,
    backUrl || TRANSPARENT_PIXEL
  ]);
  const frontTexture = frontTextureRaw || null;
  const backTexture = backTextureRaw || null;
  const finishTexture = useMemo(() => {
    const baseTexture = getFinishTexture(finishType);
    if (!baseTexture) return null;
    const texture = baseTexture.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.center.set(0.5, 0.5);
    texture.rotation = 0;
    texture.needsUpdate = true;
    return texture;
  }, [finishType]);
  useEffect(() => {
    return () => {
      finishTexture?.dispose?.();
    };
  }, [finishTexture]);
  const normalizedCoverage = clamp01(diagonalCoverage);
  const resolvedSparkleSettings = {
    ...DEFAULT_SPARKLE_SETTINGS,
    ...sparkleSettings
  };
  const sparkleOpacitySetting = clamp01(resolvedSparkleSettings.opacity);
  const sparkleIntensitySetting = clamp01(resolvedSparkleSettings.intensity);
  const sparkleSizeSetting = clamp01(resolvedSparkleSettings.size);
  const sparkleSpeedSetting = clamp01(resolvedSparkleSettings.speed);
  const sparkleQuantitySetting = clamp01(resolvedSparkleSettings.quantity);
  const sparkleEnabled = resolvedSparkleSettings.enabled !== false;
  const resolvedShimmerSettings = {
    ...DEFAULT_SHIMMER_SETTINGS,
    ...shimmerSettings
  };
  const shimmerEnabledOverride = resolvedShimmerSettings.enabled !== false;
  const shimmerOpacitySetting = clamp01(resolvedShimmerSettings.opacity);
  const shimmerIntensitySetting = clamp01(resolvedShimmerSettings.intensity);
  const shimmerSizeSetting = clamp01(resolvedShimmerSettings.size);
  const shimmerSpeedSetting = clamp01(resolvedShimmerSettings.speed);
  const resolvedPriceLabelSettings = {
    ...DEFAULT_PRICE_LABEL_SETTINGS,
    ...priceLabelSettings
  };
  const basePalette =
    sparklePalette && sparklePalette.length > 0 ? sparklePalette : DEFAULT_SPARKLE_PALETTE;
  const fallbackPaletteKey =
    sparklePaletteKey || basePalette.join('|') || DEFAULT_SPARKLE_PALETTE.join('|');
  const diagonalBasePalette =
    diagonalPalette && diagonalPalette.length > 0 ? diagonalPalette : basePalette;
  const diagonalFallbackPaletteKey =
    diagonalPaletteKey || diagonalBasePalette.join('|') || fallbackPaletteKey;
  const derivedPalette = useDerivedPaletteFromImage(
    frontUrl,
    basePalette,
    fallbackPaletteKey
  );
  const effectivePalette =
    hasExplicitPalette
      ? basePalette
      : derivedPalette && derivedPalette.length > 0
        ? derivedPalette
        : basePalette;
  const effectivePaletteKey =
    hasExplicitPalette
      ? fallbackPaletteKey
      : derivedPalette && derivedPalette.length > 0
        ? derivedPalette.join('|')
        : fallbackPaletteKey;
  const effectiveDiagonalPalette = hasExplicitPalette ? diagonalBasePalette : effectivePalette;
  const effectiveDiagonalPaletteKey = hasExplicitPalette
    ? diagonalFallbackPaletteKey
    : effectivePaletteKey;
  const paletteBaseColor = useMemo(() => {
    const baseColor = new THREE.Color(effectivePalette[0] || DEFAULT_SPARKLE_PALETTE[0]);
    const rarityTint = new THREE.Color(RARITY_TINTS[rarity] || DEFAULT_SPARKLE_PALETTE[0]);
    return baseColor.lerp(rarityTint, 0.25);
  }, [effectivePaletteKey, rarity]);
  const sparkleOptionsKey = [
    effectivePaletteKey,
    `q${sparkleQuantitySetting.toFixed(3)}`,
    `s${sparkleSizeSetting.toFixed(3)}`
  ].join('|');
  const diagonalOptionsKey = [
    effectiveDiagonalPaletteKey,
    `c${normalizedCoverage.toFixed(3)}`,
    `s${shimmerSizeSetting.toFixed(3)}`
  ].join('|');
  const sparkleTexture = useMemo(() => {
    const baseTexture = getSparkleTextureForOptions({
      palette: effectivePalette,
      quantityFactor: sparkleQuantitySetting,
      sizeFactor: sparkleSizeSetting
    });
    if (!baseTexture) return null;
    const texture = baseTexture.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.center.set(0.5, 0.5);
    texture.rotation = 0;
    texture.needsUpdate = true;
    return texture;
  }, [sparkleOptionsKey]);
  useEffect(() => {
    return () => {
      sparkleTexture?.dispose?.();
    };
  }, [sparkleTexture]);
  const diagonalTexture = useMemo(() => {
    const baseTexture = getDiagonalTextureForOptions({
      palette: effectiveDiagonalPalette,
      diagonalCoverage: normalizedCoverage,
      sizeFactor: shimmerSizeSetting
    });
    if (!baseTexture) return null;
    const texture = baseTexture.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.center.set(0.5, 0.5);
    texture.rotation = 0;
    texture.needsUpdate = true;
    return texture;
  }, [diagonalOptionsKey]);
  useEffect(() => {
    return () => {
      diagonalTexture?.dispose?.();
    };
  }, [diagonalTexture]);
  
  const targetPosition = useRef(new THREE.Vector3(...position));
  const targetRotation = useRef(new THREE.Euler(...rotation));
  const targetScale = useRef(new THREE.Vector3(baseScale, baseScale, baseScale));
  
  const isFocused = focusedIndex === index;
  const isHovered = hovered && !isFocused;
  const isDimmed = enableDimming && focusedIndex !== null && focusedIndex !== index;
  const shouldRenderFinishEffect = isFinishEffectEnabled(finishType, finishEffectSettings);
  const cardSparkleIntensity = sparkleIntensity * THREE.MathUtils.lerp(0.85, 1.4, sparkleIntensitySetting);
  const sparkleOpacityScale = getSparkleOpacityScale(cardSparkleIntensity);
  const sparkleMotionScale = getSparkleMotionScale(cardSparkleIntensity);
  const sparkleVisibility = getSparkleVisibility(cardSparkleIntensity);
  const sparkleRepeat = getSparkleRepeat(cardSparkleIntensity);
  const sparkleEffectFactor = sparkleVfxFactor === null ? 1 : clamp01(sparkleVfxFactor);
  const shimmerActive = shouldRenderFinishEffect && shimmerEnabledOverride;
  const isBoundedInteraction = interactionMode === 'bounded';
  const useInstantTransform = transformMode === 'instant';
  const detailInputScale = useMemo(() => {
    const widthScale = size?.width ? size.width / REFERENCE_SCREEN_WIDTH : 1;
    const heightScale = size?.height ? size.height / REFERENCE_SCREEN_HEIGHT : 1;
    return THREE.MathUtils.clamp(Math.max(widthScale, heightScale), 1, 2.4);
  }, [size?.height, size?.width]);
  useEffect(() => {
    if (!isFocused || !isBoundedInteraction) {
      detailTiltOriginRef.current = null;
      hoverTiltRef.current.x = 0;
      hoverTiltRef.current.y = 0;
      return;
    }

    detailTiltOriginRef.current = null;
    hoverTiltRef.current.x = 0;
    hoverTiltRef.current.y = 0;
  }, [isFocused, isBoundedInteraction]);

  const updateTiltFromWorldPoint = (worldPoint) => {
    if (!groupRef.current) return;
    const localPoint = groupRef.current.worldToLocal(worldPoint.clone());
    if (isBoundedInteraction) {
      if (!detailTiltOriginRef.current) {
        detailTiltOriginRef.current = {
          x: localPoint.x,
          y: localPoint.y
        };
      }
      hoverTiltRef.current.x = THREE.MathUtils.clamp(
        (localPoint.x - detailTiltOriginRef.current.x) / (DETAIL_INPUT_WIDTH * detailInputScale),
        -1,
        1
      );
      hoverTiltRef.current.y = THREE.MathUtils.clamp(
        (localPoint.y - detailTiltOriginRef.current.y) / (DETAIL_INPUT_HEIGHT * detailInputScale),
        -1,
        1
      );
      return;
    }

    hoverTiltRef.current.x = THREE.MathUtils.clamp(localPoint.x / BASE_INPUT_WIDTH, -1, 1);
    hoverTiltRef.current.y = THREE.MathUtils.clamp(localPoint.y / BASE_INPUT_HEIGHT, -1, 1);
  };

  useFrame((state, delta) => {
    if (!groupRef.current || !cardVisualRef.current) return;

    // Update targets based on focus state
    if (isFocused) {
      if (enableFocusLift) {
        targetPosition.current.set(position[0], position[1], 2);
        targetScale.current.set(baseScale * 1.3, baseScale * 1.3, baseScale * 1.3);
      } else {
        targetPosition.current.set(position[0], position[1], position[2]);
        targetScale.current.set(baseScale, baseScale, baseScale);
      }

      if (isBoundedInteraction && enableDragTilt) {
        targetRotation.current.set(
          -hoverTiltRef.current.y * DETAIL_ROTATION_X_RANGE,
          hoverTiltRef.current.x * DETAIL_ROTATION_Y_RANGE,
          hoverTiltRef.current.x * DETAIL_ROTATION_Z_RANGE
        );
      } else if (isDraggingRef.current && enableDragTilt) {
        targetRotation.current.set(
          -hoverTiltRef.current.y * 0.55,
          hoverTiltRef.current.x * 1.65,
          0
        );
      } else if (enableFocusLift) {
        targetRotation.current.set(0, 0, 0);
      } else {
        targetRotation.current.set(rotation[0], rotation[1], rotation[2]);
      }
    } else if (isHovered && isBoundedInteraction) {
      const previewZ = enableFocusLift
        ? THREE.MathUtils.lerp(position[2], 2, HOVER_PREVIEW_FACTOR)
        : position[2] + 0.4;
      const previewScale = enableFocusLift
        ? THREE.MathUtils.lerp(baseScale, baseScale * 1.3, HOVER_PREVIEW_FACTOR)
        : baseScale * 1.12;
      targetPosition.current.set(position[0], position[1], previewZ);
      targetRotation.current.set(rotation[0], rotation[1], rotation[2]);
      targetScale.current.set(previewScale, previewScale, previewScale);
    } else {
      targetPosition.current.set(position[0], position[1], position[2]);
      targetRotation.current.set(rotation[0], rotation[1], rotation[2]);
      targetScale.current.set(baseScale, baseScale, baseScale);
    }

    // Smooth interpolation
    if (useInstantTransform) {
      groupRef.current.position.copy(targetPosition.current);
      cardVisualRef.current.rotation.set(
        targetRotation.current.x,
        targetRotation.current.y,
        targetRotation.current.z
      );
      groupRef.current.scale.copy(targetScale.current);
    } else {
      const positionDamp = getDampFactor(POSITION_SMOOTHING, delta);
      const rotationDamp = getDampFactor(ROTATION_SMOOTHING, delta);
      groupRef.current.position.lerp(targetPosition.current, positionDamp);
      cardVisualRef.current.rotation.x = THREE.MathUtils.lerp(
        cardVisualRef.current.rotation.x, 
        targetRotation.current.x, 
        rotationDamp
      );
      cardVisualRef.current.rotation.y = THREE.MathUtils.lerp(
        cardVisualRef.current.rotation.y, 
        targetRotation.current.y, 
        rotationDamp
      );
      cardVisualRef.current.rotation.z = THREE.MathUtils.lerp(
        cardVisualRef.current.rotation.z, 
        targetRotation.current.z, 
        rotationDamp
      );
      const isZoomingOut = groupRef.current.scale.x > targetScale.current.x;
      const scaleDamp = getDampFactor(
        isZoomingOut ? SCALE_SMOOTHING_OUT : SCALE_SMOOTHING_IN,
        delta
      );
      groupRef.current.scale.lerp(targetScale.current, scaleDamp);
    }

    // Opacity dimming for non-focused cards
    if (frontMaterialRef.current && backMaterialRef.current) {
      const targetOpacity = isDimmed ? 0.5 : 1.0;
      if (frontMaterialRef.current.opacity !== undefined) {
        frontMaterialRef.current.opacity = THREE.MathUtils.lerp(
          frontMaterialRef.current.opacity, 
          targetOpacity, 
          getDampFactor(OPACITY_SMOOTHING, delta)
        );
      }
      if (backMaterialRef.current.opacity !== undefined) {
        backMaterialRef.current.opacity = THREE.MathUtils.lerp(
          backMaterialRef.current.opacity, 
          targetOpacity, 
          getDampFactor(OPACITY_SMOOTHING, delta)
        );
      }
    }

    if (finishMaterialRef.current) {
      const shimmerBoost = shimmerActive
        ? 1 + shimmerIntensitySetting * 0.25
        : 0;
      const baseOpacity = shimmerActive
        ? getFinishBaseOpacity(finishType) * 0.22 * shimmerBoost
        : 0;
      const targetOpacity = shimmerActive ? baseOpacity * shimmerOpacitySetting : 0;
      finishMaterialRef.current.opacity = THREE.MathUtils.lerp(
        finishMaterialRef.current.opacity ?? 0,
        targetOpacity,
        getDampFactor(OPACITY_SMOOTHING, delta)
      );

      const finishMap = finishMaterialRef.current.map;
      if (finishMap) {
        const shimmerClock =
          state.clock.getElapsedTime() * THREE.MathUtils.lerp(0.003, 0.02, shimmerSpeedSetting);
        finishMap.offset.x = shimmerClock % 1;
        finishMap.offset.y = (shimmerClock * 0.6) % 1;
        finishMap.repeat.set(1 + shimmerSizeSetting * 0.8, 1 + shimmerSizeSetting * 0.6);
        finishMap.rotation = shimmerSpeedSetting * 0.08;
        finishMap.needsUpdate = true;
      }
    }

    if (diagonalMaterialRef.current) {
      const linesActive = shimmerActive && normalizedCoverage > 0;
      const targetLineOpacity = linesActive
        ? (0.12 + normalizedCoverage * 0.42) * shimmerOpacitySetting
        : 0;
      diagonalMaterialRef.current.opacity = THREE.MathUtils.lerp(
        diagonalMaterialRef.current.opacity ?? 0,
        targetLineOpacity,
        getDampFactor(OPACITY_SMOOTHING, delta)
      );

      const lineMap = diagonalMaterialRef.current.map;
      if (lineMap) {
        const lineClock =
          state.clock.getElapsedTime() * THREE.MathUtils.lerp(0.08, 0.22, shimmerSpeedSetting);
        const lineFall = lineClock % 1;
        lineMap.offset.x = 0;
        lineMap.offset.y = lineFall;
        lineMap.rotation = -0.12;
        lineMap.repeat.set(1 + shimmerSizeSetting * 0.45, 1 + shimmerSizeSetting * 0.45);
        lineMap.needsUpdate = true;
      }
    }

    if (sparkleMaterialRef.current) {
      const sparklesActive = sparkleEnabled && isFocused;
      const rawVisibility = sparklesActive
        ? sparkleVisibility * sparkleEffectFactor
        : 0;
      const adjustedVisibility =
        rawVisibility * sparkleOpacitySetting * (1.25 + shimmerIntensitySetting * 0.2);
      const focusBoost = isFocused ? 0.18 * sparkleOpacitySetting : 0;
      const targetSparkleOpacity = sparklesActive
        ? Math.max(adjustedVisibility, 0.18) + focusBoost
        : 0;
      sparkleMaterialRef.current.opacity = THREE.MathUtils.lerp(
        sparkleMaterialRef.current.opacity ?? 0,
        targetSparkleOpacity,
        getDampFactor(OPACITY_SMOOTHING, delta)
      );

      const sparkleMap = sparkleMaterialRef.current.map;
      if (sparkleMap) {
        const speedScale = THREE.MathUtils.lerp(0.75, 1.55, sparkleSpeedSetting);
        const effectiveMotionScale = sparklesActive
          ? Math.max(0.35, sparkleMotionScale * speedScale)
          : sparkleMotionScale;
        const finalRepeat =
          sparkleRepeat * (0.88 + sparkleSizeSetting * 0.16 + sparkleQuantitySetting * 0.06);
        const animationPhase = state.clock.getElapsedTime();
        const downwardFlow = animationPhase * 0.085 * effectiveMotionScale;
        const pulseRepeat = finalRepeat * (1 + Math.sin(animationPhase * 1.8) * 0.02);
        const targetOffsetX = 0;
        const targetOffsetY = -downwardFlow;
        const textureDamp = getDampFactor(8.6, delta);
        sparkleMap.offset.x = THREE.MathUtils.lerp(
          sparkleMap.offset.x,
          targetOffsetX,
          textureDamp
        );
        sparkleMap.offset.y = THREE.MathUtils.lerp(
          sparkleMap.offset.y,
          targetOffsetY,
          textureDamp
        );
        sparkleMap.rotation = THREE.MathUtils.lerp(
          sparkleMap.rotation || 0,
          0,
          textureDamp
        );
        sparkleMap.repeat.set(pulseRepeat, pulseRepeat);
        sparkleMap.needsUpdate = true;
      }

      const dynamicColor = paletteBaseColor.clone();
      const colorHsl = { h: 0, s: 0, l: 0 };
      dynamicColor.getHSL(colorHsl);
      const shimmerWave = Math.sin(state.clock.getElapsedTime() * 2.4) * 0.03;
      const dynamicHue = (colorHsl.h + Math.sin(state.clock.getElapsedTime() * 0.3) * 0.022 + 1) % 1;
      const dynamicSaturation = Math.min(1, colorHsl.s + 0.2);
      const dynamicLightness = clamp01(colorHsl.l + rawVisibility * 0.12 + 0.18 + shimmerWave);
      sparkleMaterialRef.current.color.setHSL(
        dynamicHue,
        dynamicSaturation,
        dynamicLightness
      );
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, 0, 0]}
      scale={[baseScale, baseScale, baseScale]}
      raycast={interactive ? undefined : () => null}
      onPointerEnter={(e) => {
        if (!interactive || isBoundedInteraction) return;
        e.stopPropagation();
        onHover(index);
        onCursorChange('pointer');
      }}
      onPointerDown={(e) => {
        if (!interactive || isBoundedInteraction) return;
        e.stopPropagation();
        onHover(index);
        isPointerDownRef.current = true;
        if (enableDragTilt) {
          isDraggingRef.current = true;
          updateTiltFromWorldPoint(e.point);
          e.target.setPointerCapture?.(e.pointerId);
        }
        onCursorChange('grabbing');
      }}
      onPointerMove={(e) => {
        if (!interactive || isBoundedInteraction || !enableDragTilt || !isDraggingRef.current) return;
        e.stopPropagation();
        updateTiltFromWorldPoint(e.point);
      }}
      onPointerUp={(e) => {
        if (!interactive || isBoundedInteraction || !isPointerDownRef.current) return;
        e.stopPropagation();
        if (typeof onCardTap === 'function') {
          onCardTap(index);
        }
        isPointerDownRef.current = false;
        isDraggingRef.current = false;
        hoverTiltRef.current.x = 0;
        hoverTiltRef.current.y = 0;
        if (enableDragTilt) {
          e.target.releasePointerCapture?.(e.pointerId);
        }
        onCursorChange('pointer');
      }}
      onPointerLeave={() => {
        if (!interactive || isBoundedInteraction) return;
        isPointerDownRef.current = false;
        if (isDraggingRef.current) return;
        hoverTiltRef.current.x = 0;
        hoverTiltRef.current.y = 0;
        onHoverOut();
        onCursorChange('default');
      }}
    >
      {isFocused && interactive && isBoundedInteraction && (
        <mesh
          position={[0, 0, 0.12]}
          onPointerEnter={() => {
            onBoundedPointerEnter();
            onCursorChange('pointer');
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onCardTap === 'function') {
              onCardTap(index);
            }
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            onBoundedPointerEnter();
            updateTiltFromWorldPoint(e.point);
            onCursorChange('pointer');
          }}
          onPointerLeave={() => {
            onBoundedPointerLeave();
            onCursorChange('default');
          }}
        >
          <planeGeometry
            args={[CARD_WIDTH * FOCUS_INTERACTION_PLANE_SCALE, CARD_HEIGHT * FOCUS_INTERACTION_PLANE_SCALE]}
          />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
      <group ref={cardVisualRef} rotation={rotation}>
        {!hasValidUrls ? (
          <CardContentFallback renderOrderBase={renderOrder * 10} />
        ) : frontTexture && backTexture ? (
          <CardContentWithTexture 
            frontTexture={frontTexture} 
            backTexture={backTexture}
            alphaMap={alphaMap}
            frontMaterialRef={frontMaterialRef}
            backMaterialRef={backMaterialRef}
            renderOrderBase={renderOrder * 10}
          />
        ) : (
          <CardContentFallback alphaMap={alphaMap} renderOrderBase={renderOrder * 10} />
        )}
        <mesh position={[0, 0, CARD_FINISH_OFFSET]} renderOrder={renderOrder * 10 + 3}>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshBasicMaterial
            ref={finishMaterialRef}
            map={finishTexture || null}
            alphaMap={alphaMap || null}
            transparent
            alphaTest={0.03}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-6}
            toneMapped={false}
            side={THREE.FrontSide}
            blending={THREE.NormalBlending}
            opacity={0}
          />
        </mesh>
        <mesh position={[0, 0, CARD_DIAGONAL_OFFSET]} renderOrder={renderOrder * 10 + 4}>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshBasicMaterial
            ref={diagonalMaterialRef}
            map={diagonalTexture || null}
            alphaMap={alphaMap || null}
            color="#ffffff"
            transparent
            alphaTest={0.005}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-8}
            toneMapped={false}
            side={THREE.FrontSide}
            blending={THREE.NormalBlending}
            opacity={0}
          />
        </mesh>
        <mesh position={[0, 0, CARD_SPARKLE_OFFSET]} renderOrder={renderOrder * 10 + 5}>
          <planeGeometry args={[CARD_WIDTH * CARD_SPARKLE_PLANE_SCALE_X, CARD_HEIGHT * CARD_SPARKLE_PLANE_SCALE_Y]} />
          <meshBasicMaterial
            ref={sparkleMaterialRef}
            map={sparkleTexture || null}
            alphaMap={sparkleAuraMask || null}
            color="#bfefff"
            transparent
            alphaTest={0.001}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-10}
            toneMapped={false}
            side={THREE.FrontSide}
            blending={THREE.AdditiveBlending}
            opacity={0}
          />
        </mesh>
      </group>
      {showPricePanel && resolvedPriceLabelSettings.enabled && (
        <PricePanel
          marketPrice={marketPrice}
          instantBuyBackPrice={instantBuyBackPrice}
          variant={priceLabelVariant}
          muted={priceLabelMuted}
          emphasized={priceLabelEmphasized}
          fontSize={resolvedPriceLabelSettings.fontSize}
          fontColor={resolvedPriceLabelSettings.fontColor}
        />
      )}
    </group>
  );
}

function areCardPropsEqual(prev, next) {
  return (
    prev.frontUrl === next.frontUrl &&
    prev.backUrl === next.backUrl &&
    vectorsEqual(prev.position, next.position) &&
    vectorsEqual(prev.rotation, next.rotation) &&
    prev.index === next.index &&
    prev.focusedIndex === next.focusedIndex &&
    prev.hovered === next.hovered &&
    prev.enableDragTilt === next.enableDragTilt &&
    prev.enableFocusLift === next.enableFocusLift &&
    prev.enableDimming === next.enableDimming &&
    prev.interactive === next.interactive &&
    prev.interactionMode === next.interactionMode &&
    prev.baseScale === next.baseScale &&
    prev.onCardTap === next.onCardTap &&
    prev.transformMode === next.transformMode &&
    prev.showPricePanel === next.showPricePanel &&
    prev.priceLabelVariant === next.priceLabelVariant &&
    prev.priceLabelMuted === next.priceLabelMuted &&
    prev.priceLabelEmphasized === next.priceLabelEmphasized &&
    prev.marketPrice === next.marketPrice &&
    prev.instantBuyBackPrice === next.instantBuyBackPrice &&
    prev.finishType === next.finishType &&
    prev.finishEffectSettings === next.finishEffectSettings &&
    prev.sparkleIntensity === next.sparkleIntensity &&
    prev.sparklePaletteKey === next.sparklePaletteKey &&
    prev.sparkleVfxFactor === next.sparkleVfxFactor &&
    prev.diagonalCoverage === next.diagonalCoverage &&
    prev.rarity === next.rarity &&
    prev.renderOrder === next.renderOrder &&
    prev.onCursorChange === next.onCursorChange &&
    prev.onBoundedPointerEnter === next.onBoundedPointerEnter &&
    prev.onBoundedPointerLeave === next.onBoundedPointerLeave
  );
}

export default memo(Card, areCardPropsEqual);
