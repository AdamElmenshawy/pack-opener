// src/components/Experience.jsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
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
  onPackClick 
}) {
  return (
    <Canvas 
      camera={{ position: [0, 0, 8], fov: 60 }}
      gl={{ 
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace
      }}
    >
      <Suspense fallback={null}>
        {/* Studio Environment - MANDATORY for metallic materials to look silver */}
        <Environment preset="studio" />
        
        {/* Clean Lighting - NO FLASH */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        
        {/* Contact Shadows */}
        <ContactShadows 
          position={[0, -2.5, 0]}
          opacity={0.5} 
          scale={10} 
          blur={2.5}
          far={1.6}
        />
        
        {/* Show Pack */}
        {isPackVisible && texturesLoaded && (
          <PackComponent 
            topRef={topRef}
            bottomRef={bottomRef}
            topMaterialRef={topMaterialRef}
            bottomMaterialRef={bottomMaterialRef}
            onPackClick={onPackClick}
          />
        )}
        
        {/* Show Cards */}
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
          minDistance={4}
          maxDistance={15}
          enabled={status === 'revealed'}
        />
        
        {/* Bloom */}
        <EffectComposer>
          <Bloom
            intensity={0.8}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.9}
            mipmapBlur
            height={300}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}