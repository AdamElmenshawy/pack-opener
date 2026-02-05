// src/components/Card.jsx
import { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

function LoadingCard() {
  return (
    <mesh>
      <boxGeometry args={[2.5, 3.5, 0.05]} />
      <meshPhysicalMaterial 
        color="#ffffff" 
        emissive="#6a4aff" 
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

function CardContent({ frontUrl, backUrl, frontMaterialRef, backMaterialRef }) {
  // MANDATORY CORS FIX - Required for S3 images
  const [frontTexture, backTexture] = useTexture(
    [frontUrl, backUrl],
    (textures) => {
      textures.forEach((texture) => {
        if (texture?.image) {
          texture.image.crossOrigin = 'anonymous';
        }
      });
      console.log('✓ Textures loaded with CORS fix');
    }
  );
  
  return (
    <RoundedBox args={[2.5, 3.5, 0.05]} radius={0.1} smoothness={4}>
      {/* Side materials */}
      <meshPhysicalMaterial attach="material-0" color="#0a0a0a" />
      <meshPhysicalMaterial attach="material-1" color="#0a0a0a" />
      <meshPhysicalMaterial attach="material-2" color="#0a0a0a" />
      <meshPhysicalMaterial attach="material-3" color="#0a0a0a" />
      
      {/* Front face */}
      <meshPhysicalMaterial
        ref={frontMaterialRef}
        attach="material-4"
        map={frontTexture}
        metalness={1}
        roughness={0.1}
        envMapIntensity={1.5}
        clearcoat={1}
        iridescence={1}
        iridescenceIOR={1.5}
        transparent
        opacity={1}
      />
      
      {/* Back face */}
      <meshPhysicalMaterial
        ref={backMaterialRef}
        attach="material-5"
        map={backTexture}
        metalness={1}
        roughness={0.1}
        envMapIntensity={1.5}
        clearcoat={1}
        iridescence={1}
        iridescenceIOR={1.5}
        transparent
        opacity={1}
      />
    </RoundedBox>
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
  onHoverOut 
}) {
  const groupRef = useRef();
  const frontMaterialRef = useRef();
  const backMaterialRef = useRef();
  
  const targetPosition = useRef(new THREE.Vector3(...position));
  const targetRotation = useRef(new THREE.Euler(...rotation));
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  
  const isFocused = focusedIndex === index;
  const isDimmed = focusedIndex !== null && focusedIndex !== index;

  useFrame(() => {
    if (!groupRef.current) return;

    if (isFocused) {
      targetPosition.current.set(position[0], position[1], 2);
      targetRotation.current.set(0, 0, 0);
      targetScale.current.set(1.3, 1.3, 1.3);
    } else {
      targetPosition.current.set(position[0], position[1], position[2]);
      targetRotation.current.set(rotation[0], rotation[1], rotation[2]);
      targetScale.current.set(1, 1, 1);
    }

    groupRef.current.position.lerp(targetPosition.current, 0.06);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotation.current.x, 0.06);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation.current.y, 0.06);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotation.current.z, 0.06);
    groupRef.current.scale.lerp(targetScale.current, 0.06);

    if (frontMaterialRef.current && backMaterialRef.current) {
      const targetOpacity = isDimmed ? 0.4 : 1.0;
      if (frontMaterialRef.current.opacity !== undefined) {
        frontMaterialRef.current.opacity = THREE.MathUtils.lerp(frontMaterialRef.current.opacity, targetOpacity, 0.06);
      }
      if (backMaterialRef.current.opacity !== undefined) {
        backMaterialRef.current.opacity = THREE.MathUtils.lerp(backMaterialRef.current.opacity, targetOpacity, 0.06);
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(index);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHoverOut();
        document.body.style.cursor = 'default';
      }}
    >
      <Suspense fallback={<LoadingCard />}>
        <CardContent 
          frontUrl={frontUrl} 
          backUrl={backUrl}
          frontMaterialRef={frontMaterialRef}
          backMaterialRef={backMaterialRef}
        />
      </Suspense>
    </group>
  );
}