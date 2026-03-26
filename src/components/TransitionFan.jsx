import * as THREE from 'three';
import Card from './Card';
import { getCollageTransform } from './collageLayout';

const getFanPosition = (index, total) => {
  const radius = 11;
  const arcSpan = Math.PI / 3.2;
  const denominator = Math.max(total - 1, 1);
  const angle = (index / denominator - 0.5) * arcSpan;
  return [
    Math.sin(angle) * radius,
    Math.cos(angle * 2) * 0.5 - 0.3,
    -Math.cos(angle) * radius + radius - 3.5
  ];
};

const getFanRotation = (index, total) => {
  const arcSpan = Math.PI / 3.2;
  const denominator = Math.max(total - 1, 1);
  const angle = (index / denominator - 0.5) * arcSpan;
  return [0, -angle * 0.85, 0];
};

export default function TransitionFan({
  cards,
  sourceCards,
  blend,
  sparkleIntensity
}) {
  if (!cards || cards.length === 0) return null;

  const sourceOrder = sourceCards && sourceCards.length > 0 ? sourceCards : cards;
  const indexById = new Map(sourceOrder.map((card, i) => [card.card_id, i]));

  return (
    <group position={[0, 0, 0]}>
      {cards.map((card, index) => {
        const sourceIndex = indexById.get(card.card_id) ?? index;
        const from = getCollageTransform(sourceIndex, sourceOrder.length, sourceOrder.length);
        const toPos = getFanPosition(index, cards.length);
        const toRot = getFanRotation(index, cards.length);

        const position = [
          THREE.MathUtils.lerp(from.position[0], toPos[0], blend),
          THREE.MathUtils.lerp(from.position[1], toPos[1], blend),
          THREE.MathUtils.lerp(from.position[2], toPos[2], blend)
        ];
        const rotation = [
          THREE.MathUtils.lerp(from.rotation[0], toRot[0], blend),
          THREE.MathUtils.lerp(from.rotation[1], toRot[1], blend),
          THREE.MathUtils.lerp(from.rotation[2], toRot[2], blend)
        ];

        return (
          <Card
            key={`transition-${card.card_id}`}
            frontUrl={card.url_front_preprocessed || card.url_front_original}
            backUrl={card.url_back_preprocessed || card.url_back_original}
            position={position}
            rotation={rotation}
            index={index}
            focusedIndex={null}
            onHover={() => {}}
            onHoverOut={() => {}}
            enableDragTilt={false}
            enableFocusLift={false}
            enableDimming={false}
            interactive={false}
            baseScale={1}
            onCardTap={null}
            finishType={card.finish_type || 'normal'}
            sparkleIntensity={sparkleIntensity}
            sparklePalette={card.vfxSparklePalette}
            sparklePaletteKey={card.vfxSparklePaletteKey}
            diagonalPalette={card.vfxDiagonalPalette}
            diagonalPaletteKey={card.vfxDiagonalPaletteKey}
            hasExplicitPalette={card.vfxHasExplicitPalette}
            sparkleVfxFactor={card.vfxSparkleFactor}
            diagonalCoverage={card.vfxDiagonalCoverage}
            rarity={card.rarity}
            sparkleSettings={card.sparkleSettings}
            shimmerSettings={card.shimmerSettings}
            priceLabelSettings={card.priceLabelSettings}
          />
        );
      })}
    </group>
  );
}
