// src/components/Experience.jsx
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import CardHand from './CardHand';
import PackComponent from './PackComponent';
import StackDeck from './StackDeck';
import TransitionFan from './TransitionFan';

export default function Experience({ 
  cards, 
  stackCards,
  collageCards,
  movingCard,
  movingToIndex,
  stackAnimProgress,
  stackAnimating,
  phaseBlend,
  status, 
  isPackVisible, 
  texturesLoaded, 
  topRef, 
  bottomRef, 
  topMaterialRef, 
  bottomMaterialRef, 
  onPackAnimationComplete,
  onCycleTopCard,
  onCursorChange,
  packTextureUrl,
  sparkleIntensity
}) {
  const isPhaseTransition = status === 'transitioning';
  const rawBlend = isPhaseTransition ? phaseBlend : status === 'revealed' ? 1 : 0;
  const blend = rawBlend * rawBlend * (3 - 2 * rawBlend);
  const hasVisibleTransitionBlend = blend > 0.0001;
  const showStack = (status === 'stacked' || (isPhaseTransition && !hasVisibleTransitionBlend)) && texturesLoaded;
  const showTransition = isPhaseTransition && hasVisibleTransitionBlend && texturesLoaded;
  const showHand = status === 'revealed' && texturesLoaded;

  return (
    <Canvas 
      camera={{ position: [0, 0, 10], fov: 60 }}
      dpr={[1, 1.5]}
      frameloop="always"
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: 0,
        toneMappingExposure: 1.0
      }}
      performance={{ min: 0.6 }}
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
            onCursorChange={onCursorChange}
            packTextureUrl={packTextureUrl}
          />
        )}
        
        {/* Card Hand Display */}
        {showStack && (
          <StackDeck
            cards={stackCards}
            collageCards={collageCards}
            onCycleTopCard={onCycleTopCard}
            movingCard={movingCard}
            movingToIndex={movingToIndex}
            stackAnimProgress={stackAnimProgress}
            isAnimating={stackAnimating}
            onCursorChange={onCursorChange}
            sparkleIntensity={sparkleIntensity}
          />
        )}

        {showTransition && (
          <TransitionFan
            cards={cards}
            sourceCards={collageCards}
            blend={blend}
            sparkleIntensity={sparkleIntensity}
          />
        )}

        {/* Card Hand Display */}
        {showHand && (
          <Suspense fallback={null}>
            <CardHand
              cards={cards}
              onCursorChange={onCursorChange}
              sparkleIntensity={sparkleIntensity}
            />
          </Suspense>
        )}
        
      </Suspense>
    </Canvas>
  );
}
