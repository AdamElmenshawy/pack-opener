// src/components/Card.jsx
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, useTexture } from '@react-three/drei';
import * as THREE from 'three';

function LoadingCard() {
  return (
    <mesh>
      <boxGeometry args={[2.5, 3.5, 0.05]} />
      <meshStandardMaterial color="#1a1a1a" />
    </mesh>
  );
}

function CardContentWithTexture({ frontTexture, backTexture, frontMaterialRef, backMaterialRef }) {
  return (
    <RoundedBox args={[2.5, 3.5, 0.05]} radius={0.1} smoothness={4}>
      {/* Side materials - dark edges */}
      <meshStandardMaterial attach="material-0" color="#0a0a0a" transparent={true} />
      <meshStandardMaterial attach="material-1" color="#0a0a0a" transparent={true} />
      <meshStandardMaterial attach="material-2" color="#0a0a0a" transparent={true} />
      <meshStandardMaterial attach="material-3" color="#0a0a0a" transparent={true} />
      
      {/* Front face */}
      <meshStandardMaterial
        ref={frontMaterialRef}
        attach="material-4"
        map={frontTexture}
        transparent={true}
        toneMapped={false}
        opacity={1}
      />
      
      {/* Back face */}
      <meshStandardMaterial
        ref={backMaterialRef}
        attach="material-5"
        map={backTexture}
        transparent={true}
        toneMapped={false}
        opacity={1}
      />
    </RoundedBox>
  );
}

function CardContentFallback() {
  return (
    <RoundedBox args={[2.5, 3.5, 0.05]} radius={0.1} smoothness={4}>
      <meshStandardMaterial color="#222" />
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
  const hasValidUrls = Boolean(frontUrl) && Boolean(backUrl);
  const [textureFailed, setTextureFailed] = useState(false);
  const blankTexture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  const fUrl = frontUrl || blankTexture;
  const bUrl = backUrl || blankTexture;
  const [front, back] = useTexture([fUrl, bUrl], (textures) => {
    textures.forEach(t => {
      t.image.crossOrigin = "anonymous";
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
  });

  useEffect(() => {
    if (!hasValidUrls) {
      setTextureFailed(true);
      return;
    }
    setTextureFailed(false);
  }, [frontUrl, backUrl, hasValidUrls]);
  
  const targetPosition = useRef(new THREE.Vector3(...position));
  const targetRotation = useRef(new THREE.Euler(...rotation));
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  
  const isFocused = focusedIndex === index;
  const isDimmed = focusedIndex !== null && focusedIndex !== index;

  useFrame(() => {
    if (!groupRef.current) return;

    // Update targets based on focus state
    if (isFocused) {
      targetPosition.current.set(position[0], position[1], 2);
      targetRotation.current.set(0, 0, 0);
      targetScale.current.set(1.3, 1.3, 1.3);
    } else {
      targetPosition.current.set(position[0], position[1], position[2]);
      targetRotation.current.set(rotation[0], rotation[1], rotation[2]);
      targetScale.current.set(1, 1, 1);
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
    groupRef.current.scale.lerp(targetScale.current, 0.08);

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
      {!hasValidUrls || textureFailed ? (
        <CardContentFallback />
      ) : front && back ? (
        <CardContentWithTexture 
          frontTexture={front} 
          backTexture={back}
          frontMaterialRef={frontMaterialRef}
          backMaterialRef={backMaterialRef}
        />
      ) : (
        <LoadingCard />
      )}
    </group>
  );
}
