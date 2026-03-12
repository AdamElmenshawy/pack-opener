// src/components/Card.jsx
import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const CARD_WIDTH = 2.5;
const CARD_HEIGHT = 3.5;
const CARD_DEPTH = 0.05;
const CARD_SHELL_INSET = 0.04;
const POSITION_SMOOTHING = 14;
const ROTATION_SMOOTHING = 14;
const SCALE_SMOOTHING_IN = 14;
const SCALE_SMOOTHING_OUT = 8;
const OPACITY_SMOOTHING = 12;
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
const sharedFinishTextures = {};
let sharedSparkleTexture = null;

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
  const _ = intensity;
  return 1;
}

function paintSparkleTexture(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  const lineAnchors = [0.18, 0.5, 0.82];
  const lineStartY = -size * 0.2;
  const lineEndY = size * 1.2;
  const slope = size * 0.78;

  lineAnchors.forEach((anchor) => {
    const startX = size * anchor;
    const endX = startX - slope;
    const bandGrad = ctx.createLinearGradient(startX, lineStartY, endX, lineEndY);
    bandGrad.addColorStop(0, 'rgba(255,255,255,0)');
    bandGrad.addColorStop(0.2, 'hsla(18,100%,70%,0.5)');
    bandGrad.addColorStop(0.35, 'hsla(58,100%,72%,0.58)');
    bandGrad.addColorStop(0.5, 'hsla(185,100%,84%,0.9)');
    bandGrad.addColorStop(0.65, 'hsla(238,100%,78%,0.6)');
    bandGrad.addColorStop(0.8, 'hsla(292,100%,76%,0.5)');
    bandGrad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.lineCap = 'round';
    ctx.strokeStyle = bandGrad;
    ctx.lineWidth = size * 0.085;
    ctx.beginPath();
    ctx.moveTo(startX, lineStartY);
    ctx.lineTo(endX, lineEndY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.018;
    ctx.beginPath();
    ctx.moveTo(startX, lineStartY);
    ctx.lineTo(endX, lineEndY);
    ctx.stroke();
  });
}

function makeSparkleTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  paintSparkleTexture(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function getSparkleTexture() {
  if (!sharedSparkleTexture) {
    sharedSparkleTexture = makeSparkleTexture(512);
  }
  return sharedSparkleTexture;
}

function CardContentWithTexture({
  frontTexture,
  backTexture,
  alphaMap,
  frontMaterialRef,
  backMaterialRef
}) {
  return (
    <group>
      <mesh>
        <RoundedBox
          args={[CARD_WIDTH - CARD_SHELL_INSET, CARD_HEIGHT - CARD_SHELL_INSET, CARD_DEPTH]}
          radius={0.12}
          smoothness={6}
        >
          <meshStandardMaterial color="#101010" />
        </RoundedBox>
      </mesh>
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial
          ref={frontMaterialRef}
          map={frontTexture}
          alphaMap={alphaMap || null}
          transparent
          alphaTest={0.03}
          toneMapped={false}
          side={THREE.FrontSide}
          opacity={1}
        />
      </mesh>
      <mesh position={[0, 0, -0.028]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshStandardMaterial
          ref={backMaterialRef}
          map={backTexture}
          alphaMap={alphaMap || null}
          transparent
          alphaTest={0.03}
          toneMapped={false}
          side={THREE.FrontSide}
          opacity={1}
        />
      </mesh>
    </group>
  );
}

function CardContentFallback({ alphaMap = null }) {
  return (
    <mesh>
      <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
      <meshStandardMaterial
        color="#4b4b4b"
        emissive="#222222"
        alphaMap={alphaMap || null}
        transparent
        alphaTest={0.03}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function PricePanel({ marketPrice, instantBuyBackPrice }) {
  const marketValue = String(marketPrice ?? '').trim();
  const buyBackValue = String(instantBuyBackPrice ?? '').trim();

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
          color: '#fff',
          fontSize: '11px',
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
  onHover, 
  onHoverOut,
  enableDragTilt = true,
  enableFocusLift = true,
  enableDimming = true,
  interactive = true,
  baseScale = 1,
  onCardTap = null,
  showPricePanel = false,
  marketPrice = '',
  instantBuyBackPrice = '',
  finishType = 'normal',
  finishEffectSettings = DEFAULT_FINISH_EFFECT_SETTINGS,
  sparkleIntensity = DEFAULT_SPARKLE_INTENSITY,
  onCursorChange = () => {}
}) {
  const groupRef = useRef();
  const frontMaterialRef = useRef();
  const backMaterialRef = useRef();
  const finishMaterialRef = useRef();
  const sparkleMaterialRef = useRef();
  const hoverTiltRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const hasValidUrls = Boolean(frontUrl) && Boolean(backUrl);
  const alphaMap = useMemo(() => getRoundedAlphaMap(), []);
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
  const sparkleTexture = useMemo(() => {
    const baseTexture = getSparkleTexture();
    if (!baseTexture) return null;
    const texture = baseTexture.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.center.set(0.5, 0.5);
    texture.rotation = 0;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => {
    return () => {
      sparkleTexture?.dispose?.();
    };
  }, [sparkleTexture]);
  
  const targetPosition = useRef(new THREE.Vector3(...position));
  const targetRotation = useRef(new THREE.Euler(...rotation));
  const targetScale = useRef(new THREE.Vector3(baseScale, baseScale, baseScale));
  
  const isFocused = focusedIndex === index;
  const isDimmed = enableDimming && focusedIndex !== null && focusedIndex !== index;
  const shouldRenderFinishEffect = isFinishEffectEnabled(finishType, finishEffectSettings);
  const sparkleOpacityScale = getSparkleOpacityScale(sparkleIntensity);
  const sparkleMotionScale = getSparkleMotionScale(sparkleIntensity);
  const sparkleVisibility = getSparkleVisibility(sparkleIntensity);
  const sparkleRepeat = getSparkleRepeat(sparkleIntensity);
  const updateTiltFromWorldPoint = (worldPoint) => {
    if (!groupRef.current) return;
    const localPoint = groupRef.current.worldToLocal(worldPoint.clone());
    hoverTiltRef.current.x = THREE.MathUtils.clamp(localPoint.x / 0.7, -1, 1);
    hoverTiltRef.current.y = THREE.MathUtils.clamp(localPoint.y / 0.95, -1, 1);
  };

  useFrame((_state, delta) => {
    if (!groupRef.current) return;

    // Update targets based on focus state
    if (isFocused) {
      if (enableFocusLift) {
        targetPosition.current.set(position[0], position[1], 2);
        targetScale.current.set(baseScale * 1.3, baseScale * 1.3, baseScale * 1.3);
      } else {
        targetPosition.current.set(position[0], position[1], position[2]);
        targetScale.current.set(baseScale, baseScale, baseScale);
      }

      if (isDraggingRef.current && enableDragTilt) {
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
    } else {
      targetPosition.current.set(position[0], position[1], position[2]);
      targetRotation.current.set(rotation[0], rotation[1], rotation[2]);
      targetScale.current.set(baseScale, baseScale, baseScale);
    }

    // Smooth interpolation
    const positionDamp = getDampFactor(POSITION_SMOOTHING, delta);
    const rotationDamp = getDampFactor(ROTATION_SMOOTHING, delta);
    groupRef.current.position.lerp(targetPosition.current, positionDamp);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x, 
      targetRotation.current.x, 
      rotationDamp
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y, 
      targetRotation.current.y, 
      rotationDamp
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z, 
      targetRotation.current.z, 
      rotationDamp
    );
    const isZoomingOut = groupRef.current.scale.x > targetScale.current.x;
    const scaleDamp = getDampFactor(
      isZoomingOut ? SCALE_SMOOTHING_OUT : SCALE_SMOOTHING_IN,
      delta
    );
    groupRef.current.scale.lerp(targetScale.current, scaleDamp);

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
      const baseOpacity = getFinishBaseOpacity(finishType) * 0.22;
      const focusBoost = isFocused ? 0.02 : 0;
      const targetOpacity = shouldRenderFinishEffect
        ? (baseOpacity + focusBoost) * sparkleOpacityScale
        : 0;
      finishMaterialRef.current.opacity = THREE.MathUtils.lerp(
        finishMaterialRef.current.opacity ?? 0,
        targetOpacity,
        getDampFactor(OPACITY_SMOOTHING, delta)
      );

      const sparkleMap = finishMaterialRef.current.map;
      if (sparkleMap) {
        // Keep the base finish texture stable; the animated foil sweep is handled by the band layer.
        sparkleMap.offset.set(0, 0);
        sparkleMap.rotation = 0;
        sparkleMap.needsUpdate = true;
      }
    }

    if (sparkleMaterialRef.current) {
      const tiltX = groupRef.current.rotation.y;
      const tiltY = groupRef.current.rotation.x;
      const targetSparkleOpacity = shouldRenderFinishEffect
        ? sparkleVisibility + (isFocused ? 0.12 : 0)
        : 0;
      sparkleMaterialRef.current.opacity = THREE.MathUtils.lerp(
        sparkleMaterialRef.current.opacity ?? 0,
        targetSparkleOpacity,
        getDampFactor(OPACITY_SMOOTHING, delta)
      );

      const sparkleMap = sparkleMaterialRef.current.map;
      if (sparkleMap) {
        const targetOffsetX = tiltX * 0.14 * sparkleMotionScale;
        const targetOffsetY = 0;
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
        sparkleMap.repeat.set(sparkleRepeat, sparkleRepeat);
        sparkleMap.needsUpdate = true;
      }

      const hue = 0.58 + tiltX * 0.08;
      const saturation = 0.9;
      const lightness = 0.82 + sparkleVisibility * 0.08;
      sparkleMaterialRef.current.color.setHSL(hue, saturation, lightness);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      raycast={interactive ? undefined : () => null}
      onPointerEnter={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        onHover(index);
        onCursorChange('pointer');
      }}
      onPointerDown={(e) => {
        if (!interactive) return;
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
        if (!interactive || !enableDragTilt || !isDraggingRef.current) return;
        e.stopPropagation();
        updateTiltFromWorldPoint(e.point);
      }}
      onPointerUp={(e) => {
        if (!interactive || !isPointerDownRef.current) return;
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
        if (!interactive) return;
        isPointerDownRef.current = false;
        if (isDraggingRef.current) return;
        hoverTiltRef.current.x = 0;
        hoverTiltRef.current.y = 0;
        onHoverOut();
        onCursorChange('default');
      }}
    >
      {!hasValidUrls ? (
        <CardContentFallback />
      ) : frontTexture && backTexture ? (
        <CardContentWithTexture 
          frontTexture={frontTexture} 
          backTexture={backTexture}
          alphaMap={alphaMap}
          frontMaterialRef={frontMaterialRef}
          backMaterialRef={backMaterialRef}
        />
      ) : (
        <CardContentFallback alphaMap={alphaMap} />
      )}
      <mesh position={[0, 0, 0.0305]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshBasicMaterial
          ref={finishMaterialRef}
          map={finishTexture || null}
          alphaMap={alphaMap || null}
          transparent
          alphaTest={0.03}
          depthWrite={false}
          toneMapped={false}
          side={THREE.FrontSide}
          blending={THREE.NormalBlending}
          opacity={0}
        />
      </mesh>
      <mesh position={[0, 0, 0.0312]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
        <meshBasicMaterial
          ref={sparkleMaterialRef}
          map={sparkleTexture || null}
          alphaMap={alphaMap || null}
          color="#bfefff"
          transparent
          alphaTest={0.03}
          depthWrite={false}
          toneMapped={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
          opacity={0}
        />
      </mesh>
      {showPricePanel && (
        <PricePanel
          marketPrice={marketPrice}
          instantBuyBackPrice={instantBuyBackPrice}
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
    prev.enableDragTilt === next.enableDragTilt &&
    prev.enableFocusLift === next.enableFocusLift &&
    prev.enableDimming === next.enableDimming &&
    prev.interactive === next.interactive &&
    prev.baseScale === next.baseScale &&
    prev.onCardTap === next.onCardTap &&
    prev.showPricePanel === next.showPricePanel &&
    prev.marketPrice === next.marketPrice &&
    prev.instantBuyBackPrice === next.instantBuyBackPrice &&
    prev.finishType === next.finishType &&
    prev.finishEffectSettings === next.finishEffectSettings &&
    prev.sparkleIntensity === next.sparkleIntensity &&
    prev.onCursorChange === next.onCursorChange
  );
}

export default memo(Card, areCardPropsEqual);
