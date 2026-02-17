// src/components/PackComponent.jsx
import { useMemo, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';

export default function PackComponent({ 
  topRef, 
  bottomRef, 
  topMaterialRef, 
  bottomMaterialRef, 
  onPackAnimationComplete 
}) {
  const isAnimating = useRef(false);
  const packTexture = useTexture('/gradient_pack-removebg-preview.png');
  const PACK_TOTAL_HEIGHT = 6;
  const PACK_WIDTH = 3.95;
  const TOP_RATIO = 0.18;
  const TOP_HEIGHT = PACK_TOTAL_HEIGHT * TOP_RATIO;
  const BOTTOM_HEIGHT = PACK_TOTAL_HEIGHT - TOP_HEIGHT;
  const TOP_CENTER_Y = PACK_TOTAL_HEIGHT / 2 - TOP_HEIGHT / 2;
  const BOTTOM_CENTER_Y = -PACK_TOTAL_HEIGHT / 2 + BOTTOM_HEIGHT / 2;
  const X_REPEAT = 0.62;
  const X_OFFSET = (1 - X_REPEAT) / 2;

  const { topTexture, bottomTexture } = useMemo(() => {
    const makeSlice = (offsetY, repeatY) => {
      const texture = packTexture.clone();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(X_REPEAT, repeatY);
      texture.offset.set(X_OFFSET, offsetY);
      texture.needsUpdate = true;
      return texture;
    };

    return {
      topTexture: makeSlice(1 - TOP_RATIO, TOP_RATIO),
      bottomTexture: makeSlice(0, 1 - TOP_RATIO)
    };
  }, [packTexture]);

  const handlePackClick = (e) => {
    e.stopPropagation();
    
    if (isAnimating.current || !topRef.current || !bottomRef.current) {
      return;
    }
    
    console.log('Pack clicked - starting animation');
    isAnimating.current = true;

    // GSAP Timeline for synchronized animation
    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating.current = false;
        onPackAnimationComplete();
      }
    });

    // Animate top half up
    tl.to(topRef.current.position, {
      y: 10,
      duration: 0.8,
      ease: 'power2.in'
    }, 0);

    // Animate bottom half down
    tl.to(bottomRef.current.position, {
      y: -10,
      duration: 0.8,
      ease: 'power2.in'
    }, 0);

    // Fade both pieces simultaneously
    tl.to([topMaterialRef.current, bottomMaterialRef.current], {
      opacity: 0,
      duration: 0.6,
      ease: 'power2.inOut'
    }, 0.2);
  };

  return (
    <group 
      position={[0, 0, 0]}
      scale={[1.5, 1.5, 1.5]}
      onClick={handlePackClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Top Half */}
      <mesh ref={topRef} position={[0, TOP_CENTER_Y, 0]}>
        <planeGeometry args={[PACK_WIDTH, TOP_HEIGHT]} />
        <meshStandardMaterial
          ref={topMaterialRef}
          map={topTexture}
          transparent
          alphaTest={0.03}
          metalness={0.08}
          roughness={0.8}
          toneMapped={false}
          side={THREE.DoubleSide}
          opacity={1}
        />
      </mesh>

      {/* Bottom Half */}
      <mesh ref={bottomRef} position={[0, BOTTOM_CENTER_Y, 0]}>
        <planeGeometry args={[PACK_WIDTH, BOTTOM_HEIGHT]} />
        <meshStandardMaterial
          ref={bottomMaterialRef}
          map={bottomTexture}
          transparent
          alphaTest={0.03}
          metalness={0.08}
          roughness={0.8}
          toneMapped={false}
          side={THREE.DoubleSide}
          opacity={1}
        />
      </mesh>

    </group>
  );
}
