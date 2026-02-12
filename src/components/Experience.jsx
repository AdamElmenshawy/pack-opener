// src/components/Experience.jsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import CardHand from './CardHand';
import PackComponent from './PackComponent';

export default function Experience({ 
  cards, 
  status, 
  isPackVisible, 
  texturesLoaded, 
  topRef, 
  bottomRef, 
  topMaterialRef, 
  bottomMaterialRef, 
  onPackAnimationComplete 
}) {
  return (
    <Canvas 
      camera={{ position: [0, 0, 10], fov: 60 }}
      gl={{ toneMapping: 0, toneMappingExposure: 1.0 }}
      scene={{ background: new THREE.Color('#000000') }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.5} />
        
        {/* Pack Display */}
        {isPackVisible && texturesLoaded && (
          <PackComponent 
            topRef={topRef}
            bottomRef={bottomRef}
            topMaterialRef={topMaterialRef}
            bottomMaterialRef={bottomMaterialRef}
            onPackAnimationComplete={onPackAnimationComplete}
          />
        )}
        
        {/* Card Hand Display */}
        {status === 'revealed' && texturesLoaded && (
          <Suspense fallback={null}>
            <CardHand cards={cards} />
          </Suspense>
        )}
        
        {/* Orbit Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          enableZoom={true}
          minDistance={5}
          maxDistance={15}
          maxPolarAngle={Math.PI / 2}
          enabled={status === 'revealed'}
        />
        
      </Suspense>
    </Canvas>
  );
}
