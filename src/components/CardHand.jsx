// src/components/CardHand.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';

const BASE_RADIUS = 11;
const BASE_ARC_SPAN = Math.PI / 3.2;
const MAX_CARDS_PER_ROW = 8;
const ROW_SPACER_Y = 0.6;
const ROW_DEPTH_OFFSET = 0.08;
const MAX_ARC_SPAN = Math.PI / 1.6;

export default function CardHand({
  cards,
  onCursorChange = () => {},
  sparkleIntensity
}) {
  const [focusedIndex, setFocusedIndex] = useState(null);

  const elevatedCards = cards || [];
  const totalCards = elevatedCards.length;
  const cardsPerRow = Math.min(MAX_CARDS_PER_ROW, Math.max(1, totalCards));
  const rowCount = Math.max(1, Math.ceil(totalCards / cardsPerRow));
  const hoverTimerRef = useRef(null);
  const pendingFocusIndexRef = useRef(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const scheduleFocus = useCallback(
    (index) => {
      if (pendingFocusIndexRef.current === index) return;
      pendingFocusIndexRef.current = index;
      clearHoverTimer();
      hoverTimerRef.current = setTimeout(() => {
        setFocusedIndex(pendingFocusIndexRef.current);
        hoverTimerRef.current = null;
      }, 80);
    },
    [clearHoverTimer]
  );

  const handleCardLeave = useCallback(() => {
    clearHoverTimer();
    pendingFocusIndexRef.current = null;
    setFocusedIndex(null);
  }, [clearHoverTimer]);

  useEffect(() => {
    return () => {
      clearHoverTimer();
    };
  }, [clearHoverTimer]);

  const getPriceValue = (card, keys) => {
    for (const key of keys) {
      if (card?.[key] !== undefined && card?.[key] !== null && card?.[key] !== '') {
        return String(card[key]);
      }
    }
    return '';
  };

  const arcParams = useMemo(() => {
    const extraCards = Math.max(0, totalCards - (MAX_CARDS_PER_ROW * 2));
    return {
      radius: BASE_RADIUS + extraCards * 0.25,
      arcSpan: Math.min(MAX_ARC_SPAN, BASE_ARC_SPAN + extraCards * 0.04)
    };
  }, [totalCards]);

  const getPositionAndRotation = (index) => {
    const rowIndex = Math.min(rowCount - 1, Math.floor(index / cardsPerRow));
    const rowStart = rowIndex * cardsPerRow;
    const rowTotal = Math.min(totalCards - rowStart, cardsPerRow);
    const indexInRow = index - rowStart;
    const denominator = Math.max(rowTotal - 1, 1);
    const angle = (indexInRow / denominator - 0.5) * arcParams.arcSpan;

    const radius = arcParams.radius;
    const positionX = Math.sin(angle) * radius;
    const positionZ = -Math.cos(angle) * radius + radius - 3.5 + rowIndex * ROW_DEPTH_OFFSET;
    const rowOffsetY = (rowIndex - (rowCount - 1) / 2) * ROW_SPACER_Y;
    const positionY = rowOffsetY + Math.cos(angle * 2) * 0.5 - 0.3;

    const rotationY = -angle * 0.85;

    return {
      position: [positionX, positionY, positionZ],
      rotation: [0, rotationY, 0],
      renderOrder: rowIndex * cardsPerRow + indexInRow
    };
  };

  if (totalCards === 0) return null;

  return (
    <group position={[0, 0, 0]}>
      {elevatedCards.map((card, index) => {
        const transform = getPositionAndRotation(index);
        return (
          <Card
            key={card.card_id}
            frontUrl={card.url_front_preprocessed}
            backUrl={card.url_back_preprocessed}
            position={transform.position}
            rotation={transform.rotation}
            renderOrder={transform.renderOrder}
            index={index}
            focusedIndex={focusedIndex}
            onHover={() => scheduleFocus(index)}
            onHoverOut={handleCardLeave}
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
            showPricePanel={focusedIndex === index}
            marketPrice={getPriceValue(card, ['market_price', 'marketPrice', 'price_market'])}
            instantBuyBackPrice={getPriceValue(card, [
              'instant_buy_back_price',
              'instantBuyBackPrice',
              'buy_back_price',
              'buyBackPrice'
            ])}
            onCursorChange={onCursorChange}
          />
        );
      })}

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

      {focusedIndex !== null && (
        <spotLight
          position={[
            getPositionAndRotation(focusedIndex).position[0],
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
