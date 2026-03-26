// src/components/CardHand.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import Card from './Card';
import { HAND_BASE_Z, getHandRowCounts, getHandTransform } from './handLayout';

const HAND_SELECTION_PADDING_X = 2.2;
const HAND_SELECTION_PADDING_Y = 2.4;
const HAND_SELECTION_PLANE_Z = -1.1;
const FOCUS_CLEAR_DELAY_MS = 140;
const HOVER_RESUME_DELAY_MS = 220;

export default function CardHand({
  cards,
  onCursorChange = () => {},
  sparkleIntensity
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const { viewport, camera } = useThree();

  const elevatedCards = cards || [];
  const totalCards = elevatedCards.length;
  const { rowCount } = useMemo(() => getHandRowCounts(totalCards), [totalCards]);
  const hoverTimerRef = useRef(null);
  const pendingFocusIndexRef = useRef(null);
  const isInsideFocusedCardRef = useRef(false);
  const hoverResumeAtRef = useRef(0);
  const layoutViewport = useMemo(
    () => (viewport.getCurrentViewport
      ? viewport.getCurrentViewport(camera, [0, 0, HAND_BASE_Z])
      : viewport),
    [camera, viewport]
  );

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearHoverTimer();
    };
  }, [clearHoverTimer]);

  const scheduleFocusClear = useCallback(() => {
    if (selectedIndex !== null) {
      clearHoverTimer();
      return;
    }
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      if (isInsideFocusedCardRef.current) return;
      pendingFocusIndexRef.current = null;
      setHoveredIndex(null);
      setSelectedIndex(null);
      onCursorChange('default');
    }, FOCUS_CLEAR_DELAY_MS);
  }, [clearHoverTimer, onCursorChange, selectedIndex]);

  const getPriceValue = (card, keys) => {
    for (const key of keys) {
      if (card?.[key] !== undefined && card?.[key] !== null && card?.[key] !== '') {
        return String(card[key]);
      }
    }
    return '';
  };

  const cardTransforms = useMemo(
    () => elevatedCards.map((_, index) => (
      getHandTransform(index, totalCards, layoutViewport.width, layoutViewport.height, selectedIndex)
    )),
    [elevatedCards, layoutViewport.height, layoutViewport.width, selectedIndex, totalCards]
  );
  const highlightedIndex = selectedIndex ?? hoveredIndex;

  const selectionBounds = useMemo(() => {
    const xs = cardTransforms.map((transform) => transform.position[0]);
    const ys = cardTransforms.map((transform) => transform.position[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: Math.max(5.5, maxX - minX + HAND_SELECTION_PADDING_X),
      height: Math.max(5, maxY - minY + HAND_SELECTION_PADDING_Y)
    };
  }, [cardTransforms]);

  const findNearestCardIndex = useCallback((worldPoint) => {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    cardTransforms.forEach((transform, index) => {
      const dx = worldPoint.x - transform.position[0];
      const dy = worldPoint.y - transform.position[1];
      const distance = dx * dx + dy * dy * 1.35;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }, [cardTransforms]);

  const handleSelectionMove = useCallback((event) => {
    event.stopPropagation();
    if (Date.now() < hoverResumeAtRef.current) {
      return;
    }
    isInsideFocusedCardRef.current = false;
    const nextIndex = findNearestCardIndex(event.point);
    pendingFocusIndexRef.current = nextIndex;
    clearHoverTimer();
    setHoveredIndex(nextIndex);
    onCursorChange('pointer');
  }, [clearHoverTimer, findNearestCardIndex, onCursorChange]);

  const handleSelectionClick = useCallback((event) => {
    event.stopPropagation();
    if (selectedIndex !== null) {
      clearHoverTimer();
      pendingFocusIndexRef.current = null;
      hoverResumeAtRef.current = Date.now() + HOVER_RESUME_DELAY_MS;
      setHoveredIndex(null);
      setSelectedIndex(null);
      onCursorChange('pointer');
      return;
    }
    const nextIndex = pendingFocusIndexRef.current ?? findNearestCardIndex(event.point);
    clearHoverTimer();
    setHoveredIndex(nextIndex);
    setSelectedIndex(nextIndex);
    onCursorChange('pointer');
  }, [clearHoverTimer, findNearestCardIndex, onCursorChange, selectedIndex]);

  const handleCardTap = useCallback((index) => {
    clearHoverTimer();
    setHoveredIndex(index);
    setSelectedIndex((currentIndex) => (currentIndex === index ? null : index));
    onCursorChange('pointer');
  }, [clearHoverTimer, onCursorChange]);

  const handleFocusedCardPointerEnter = useCallback(() => {
    isInsideFocusedCardRef.current = true;
    clearHoverTimer();
    onCursorChange('pointer');
  }, [clearHoverTimer, onCursorChange]);

  const handleFocusedCardPointerLeave = useCallback(() => {
    isInsideFocusedCardRef.current = false;
    if (selectedIndex === null) {
      scheduleFocusClear();
    }
  }, [scheduleFocusClear, selectedIndex]);

  if (totalCards === 0) return null;

  return (
    <group position={[0, 0, 0]}>
      <mesh
        position={[selectionBounds.centerX, selectionBounds.centerY, HAND_SELECTION_PLANE_Z]}
        onPointerEnter={(event) => {
          handleSelectionMove(event);
        }}
        onPointerMove={handleSelectionMove}
        onPointerDown={handleSelectionClick}
        onPointerLeave={() => {
          scheduleFocusClear();
        }}
      >
        <planeGeometry args={[selectionBounds.width, selectionBounds.height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {elevatedCards.map((card, index) => {
        const transform = cardTransforms[index];
        return (
          <Card
            key={card.card_id}
            frontUrl={card.url_front_preprocessed}
            backUrl={card.url_back_preprocessed}
            position={transform.position}
            rotation={transform.rotation}
            renderOrder={transform.renderOrder}
            index={index}
            focusedIndex={selectedIndex}
            hovered={selectedIndex === null && hoveredIndex === index}
            onHover={() => {}}
            onHoverOut={() => {}}
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
            showPricePanel
            priceLabelVariant="gallery"
            priceLabelMuted={highlightedIndex !== null && highlightedIndex !== index}
            priceLabelEmphasized={highlightedIndex !== null && highlightedIndex === index}
            marketPrice={getPriceValue(card, ['market_price', 'marketPrice', 'price_market'])}
            instantBuyBackPrice={getPriceValue(card, [
              'instant_buy_back_price',
              'instantBuyBackPrice',
              'buy_back_price',
              'buyBackPrice'
            ])}
            onCardTap={handleCardTap}
            interactive={selectedIndex === index}
            interactionMode="bounded"
            onCursorChange={onCursorChange}
            onBoundedPointerEnter={handleFocusedCardPointerEnter}
            onBoundedPointerLeave={handleFocusedCardPointerLeave}
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

      {selectedIndex !== null && (
        <spotLight
          position={[
            cardTransforms[selectedIndex].position[0],
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
