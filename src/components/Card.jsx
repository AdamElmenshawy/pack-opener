// src/components/Card.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const CARD_WIDTH = 2.5;
const CARD_HEIGHT = 3.5;
const CARD_DEPTH = 0.05;
const CARD_SHELL_INSET = 0.04;

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
  texture.needsUpdate = true;
  return texture;
}

function LoadingCard({ alphaMap }) {
  return (
    <mesh>
      <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
      <meshStandardMaterial
        color="#2a2a2a"
        alphaMap={alphaMap || null}
        transparent
        alphaTest={0.03}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
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

function CardContentFallback({ alphaMap }) {
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

export default function Card({ 
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
  onCardTap = null
}) {
  const groupRef = useRef();
  const frontMaterialRef = useRef();
  const backMaterialRef = useRef();
  const hoverTiltRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const hasValidUrls = Boolean(frontUrl) && Boolean(backUrl);
  const alphaMap = useMemo(() => makeRoundedAlphaMap(256, 24), []);
  const [frontTexture, setFrontTexture] = useState(null);
  const [backTexture, setBackTexture] = useState(null);
  const [isLoadingTextures, setIsLoadingTextures] = useState(true);

  useEffect(() => {
    return () => {
      alphaMap?.dispose();
    };
  }, [alphaMap]);

  useEffect(() => {
    let cancelled = false;
    let loadedFront = null;
    let loadedBack = null;

    const loadTexture = (url) =>
      new Promise((resolve) => {
        if (!url) {
          resolve(null);
          return;
        }
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            resolve(texture);
          },
          undefined,
          () => resolve(null)
        );
      });

    setFrontTexture(null);
    setBackTexture(null);
    setIsLoadingTextures(Boolean(hasValidUrls));

    if (!hasValidUrls) {
      return undefined;
    }

    Promise.all([loadTexture(frontUrl), loadTexture(backUrl)]).then(([front, back]) => {
      if (cancelled) {
        front?.dispose();
        back?.dispose();
        return;
      }
      loadedFront = front;
      loadedBack = back;
      setFrontTexture(front);
      setBackTexture(back);
      setIsLoadingTextures(false);
    });

    return () => {
      cancelled = true;
      loadedFront?.dispose();
      loadedBack?.dispose();
    };
  }, [frontUrl, backUrl, hasValidUrls]);
  
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

  useFrame(() => {
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
    groupRef.current.position.lerp(targetPosition.current, 0.08);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x, 
      targetRotation.current.x, 
      0.08
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y, 
      targetRotation.current.y, 
      0.08
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z, 
      targetRotation.current.z, 
      0.08
    );
    const isZoomingOut = groupRef.current.scale.x > targetScale.current.x;
    groupRef.current.scale.lerp(targetScale.current, isZoomingOut ? 0.05 : 0.08);

    // Opacity dimming for non-focused cards
    if (frontMaterialRef.current && backMaterialRef.current) {
      const targetOpacity = isDimmed ? 0.5 : 1.0;
      if (frontMaterialRef.current.opacity !== undefined) {
        frontMaterialRef.current.opacity = THREE.MathUtils.lerp(
          frontMaterialRef.current.opacity, 
          targetOpacity, 
          0.08
        );
      }
      if (backMaterialRef.current.opacity !== undefined) {
        backMaterialRef.current.opacity = THREE.MathUtils.lerp(
          backMaterialRef.current.opacity, 
          targetOpacity, 
          0.08
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
        document.body.style.cursor = 'pointer';
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
        document.body.style.cursor = 'grabbing';
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
        document.body.style.cursor = 'pointer';
      }}
      onPointerLeave={() => {
        if (!interactive) return;
        isPointerDownRef.current = false;
        if (isDraggingRef.current) return;
        hoverTiltRef.current.x = 0;
        hoverTiltRef.current.y = 0;
        onHoverOut();
        document.body.style.cursor = 'default';
      }}
    >
      {!hasValidUrls ? (
        <CardContentFallback />
      ) : isLoadingTextures ? (
        <LoadingCard alphaMap={alphaMap} />
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
    </group>
  );
}
