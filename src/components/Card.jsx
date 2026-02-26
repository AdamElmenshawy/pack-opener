// src/components/Card.jsx
import { memo, useMemo, useRef } from 'react';
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
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

let sharedAlphaMap = null;

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
  onCursorChange = () => {}
}) {
  const groupRef = useRef();
  const frontMaterialRef = useRef();
  const backMaterialRef = useRef();
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
  
  const targetPosition = useRef(new THREE.Vector3(...position));
  const targetRotation = useRef(new THREE.Euler(...rotation));
  const targetScale = useRef(new THREE.Vector3(baseScale, baseScale, baseScale));
  
  const isFocused = focusedIndex === index;
  const isDimmed = enableDimming && focusedIndex !== null && focusedIndex !== index;
  const updateTiltFromWorldPoint = (worldPoint) => {
    if (!groupRef.current) return;
    const localPoint = groupRef.current.worldToLocal(worldPoint.clone());
    hoverTiltRef.current.x = THREE.MathUtils.clamp(localPoint.x / 0.7, -1, 1);
    hoverTiltRef.current.y = THREE.MathUtils.clamp(localPoint.y / 0.95, -1, 1);
  };

  useFrame((_, delta) => {
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
    prev.onCursorChange === next.onCursorChange
  );
}

export default memo(Card, areCardPropsEqual);
