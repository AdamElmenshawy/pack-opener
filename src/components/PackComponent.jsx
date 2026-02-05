// src/components/PackComponent.jsx
import { useRef } from 'react';
import { RoundedBox } from '@react-three/drei';

export default function PackComponent({ topRef, bottomRef, topMaterialRef, bottomMaterialRef, onPackClick }) {
  return (
    <group 
      position={[0, 0, 0]}
      scale={[1.5, 1.5, 1.5]}
      onClick={onPackClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Top Half - Premium Physical Material */}
      <mesh ref={topRef} position={[0, 1.5, 0]}>
        <RoundedBox args={[2.5, 3, 0.12]} radius={0.1} smoothness={4}>
          <meshPhysicalMaterial
            ref={topMaterialRef}
            color="#dcdcdc"
            metalness={1}
            roughness={0.15}
            envMapIntensity={1.5}
            clearcoat={0.8}
            reflectivity={1}
            transparent
            opacity={1}
          />
        </RoundedBox>
      </mesh>

      {/* Bottom Half - Premium Physical Material */}
      <mesh ref={bottomRef} position={[0, -1.5, 0]}>
        <RoundedBox args={[2.5, 3, 0.12]} radius={0.1} smoothness={4}>
          <meshPhysicalMaterial
            ref={bottomMaterialRef}
            color="#dcdcdc"
            metalness={1}
            roughness={0.15}
            envMapIntensity={1.5}
            clearcoat={0.8}
            reflectivity={1}
            transparent
            opacity={1}
          />
        </RoundedBox>
      </mesh>

      {/* Holographic accent */}
      <mesh position={[0, 0.3, 0.07]}>
        <planeGeometry args={[2, 0.8]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={1}
          roughness={0.05}
          iridescence={1}
          iridescenceIOR={1.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Brand logo */}
      <mesh position={[0, -0.5, 0.07]}>
        <planeGeometry args={[1.8, 0.5]} />
        <meshPhysicalMaterial
          color="#5a6aff"
          emissive="#4a5aff"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}