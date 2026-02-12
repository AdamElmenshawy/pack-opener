// src/components/PackComponent.jsx
import { useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import gsap from 'gsap';

export default function PackComponent({ 
  topRef, 
  bottomRef, 
  topMaterialRef, 
  bottomMaterialRef, 
  onPackAnimationComplete 
}) {
  const isAnimating = useRef(false);

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
      <mesh ref={topRef} position={[0, 1.5, 0]}>
        <RoundedBox args={[2.5, 3, 0.12]} radius={0.1} smoothness={4}>
          <meshStandardMaterial
            ref={topMaterialRef}
            color="#c0c0c0"
            metalness={1}
            roughness={0.1}
            transparent
            opacity={1}
          />
        </RoundedBox>
      </mesh>

      {/* Bottom Half */}
      <mesh ref={bottomRef} position={[0, -1.5, 0]}>
        <RoundedBox args={[2.5, 3, 0.12]} radius={0.1} smoothness={4}>
          <meshStandardMaterial
            ref={bottomMaterialRef}
            color="#c0c0c0"
            metalness={1}
            roughness={0.1}
            transparent
            opacity={1}
          />
        </RoundedBox>
      </mesh>

    </group>
  );
}
