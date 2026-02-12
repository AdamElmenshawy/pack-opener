// src/components/CardHand.jsx
import { useState } from 'react';
import Card from './Card';

export default function CardHand({ cards }) {
  const [focusedIndex, setFocusedIndex] = useState(null);
  
  // Horizontal arc fan layout
  const getArcPosition = (index, total) => {
    const radius = 11;
    const arcSpan = Math.PI / 3.2; // slightly wider fan
    const denominator = Math.max(total - 1, 1);
    const angle = (index / denominator - 0.5) * arcSpan;
    
    const x = Math.sin(angle) * radius;
    const z = -Math.cos(angle) * radius + radius - 3.5;
    const y = Math.cos(angle * 2) * 0.5 - 0.3;
    
    return [x, y, z];
  };
  
  // Cards tilt inward
  const getArcRotation = (index, total) => {
    const arcSpan = Math.PI / 3.2;
    const denominator = Math.max(total - 1, 1);
    const angle = (index / denominator - 0.5) * arcSpan;
    
    return [0, -angle * 0.85, 0];
  };

  return (
    <group position={[0, 0, 0]}>
      {cards.map((card, index) => (
        <Card
          key={card.card_id}
          frontUrl={card.url_front_preprocessed}
          backUrl={card.url_back_preprocessed}
          position={getArcPosition(index, cards.length)}
          rotation={getArcRotation(index, cards.length)}
          index={index}
          focusedIndex={focusedIndex}
          onHover={setFocusedIndex}
          onHoverOut={() => setFocusedIndex(null)}
        />
      ))}
      
      {/* Cinematic rim lights */}
      <spotLight
        position={[0, 2, -8]}
        angle={Math.PI / 2}
        penumbra={1}
        intensity={6}
        color="#ff9966"
        distance={30}
      />
      
      <spotLight
        position={[-12, 4, -2]}
        angle={Math.PI / 3}
        penumbra={1}
        intensity={3.5}
        color="#ff5a9f"
        distance={25}
      />
      
      <spotLight
        position={[12, 4, -2]}
        angle={Math.PI / 3}
        penumbra={1}
        intensity={3.5}
        color="#5aff9f"
        distance={25}
      />
      
      {/* Dynamic spotlight on focused card */}
      {focusedIndex !== null && (
        <spotLight
          position={[
            getArcPosition(focusedIndex, cards.length)[0],
            6,
            7
          ]}
          angle={0.5}
          penumbra={1}
          intensity={7}
          color="#ffffff"
        />
      )}
    </group>
  );
}
