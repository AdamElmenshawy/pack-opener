// src/components/Experience.jsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
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
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 4, 5]} intensity={1.4} />
        <pointLight position={[-3, -1, 4]} intensity={0.7} />
        
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
        
      </Suspense>
    </Canvas>
  );
}
