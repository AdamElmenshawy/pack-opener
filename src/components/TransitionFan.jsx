import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import Card from './Card';
import { getCollageTransform } from './collageLayout';
import { HAND_BASE_Z, getHandTransform } from './handLayout';

const COLLAGE_BASE_SCALE = 0.74;
const COLLAGE_Y_OFFSET = -0.15;

export default function TransitionFan({
  cards,
  sourceCards,
  blend,
  sparkleIntensity
}) {
  const { viewport, camera } = useThree();
  if (!cards || cards.length === 0) return null;

  const sourceOrder = sourceCards && sourceCards.length > 0 ? sourceCards : cards;
  const indexById = new Map(sourceOrder.map((card, i) => [card.card_id, i]));
  const layoutViewport = viewport.getCurrentViewport
    ? viewport.getCurrentViewport(camera, [0, 0, HAND_BASE_Z])
    : viewport;

  return (
    <group position={[0, 0, 0]}>
      {cards.map((card, index) => {
        const sourceIndex = indexById.get(card.card_id) ?? index;
        const from = getCollageTransform(sourceIndex, sourceOrder.length, sourceOrder.length);
        const to = getHandTransform(index, cards.length, layoutViewport.width, layoutViewport.height, null);
        const baseScale = THREE.MathUtils.lerp(COLLAGE_BASE_SCALE, 1, blend);

        const position = [
          THREE.MathUtils.lerp(from.position[0], to.position[0], blend),
          THREE.MathUtils.lerp(from.position[1] + COLLAGE_Y_OFFSET, to.position[1], blend),
          THREE.MathUtils.lerp(from.position[2], to.position[2], blend)
        ];
        const rotation = [
          THREE.MathUtils.lerp(from.rotation[0], to.rotation[0], blend),
          THREE.MathUtils.lerp(from.rotation[1], to.rotation[1], blend),
          THREE.MathUtils.lerp(from.rotation[2], to.rotation[2], blend)
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
            baseScale={baseScale}
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
