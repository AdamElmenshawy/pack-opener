import Card from './Card';
import * as THREE from 'three';
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

const STACK_X_STEP = 0.045;
const STACK_Y_STEP = 0.016;
const STACK_Z_STEP = 0.045;
const LIST_SPACING = 1.18;
const STACK_DROPPED_Y = -1.7;
const STACK_BASE_SCALE = 1.32;
const LIST_BASE_SCALE = 0.74;

export default function StackDeck({
  cards,
  collageCards = [],
  onCycleTopCard,
  movingCard = null,
  movingToIndex = -1,
  stackAnimProgress = 0,
  isAnimating = false
}) {
  const stackGroupRef = useRef();
  const [focusedCollageIndex, setFocusedCollageIndex] = useState(null);
  const tiltTargetRef = useRef({ x: 0, y: 0 });
  const dragStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0
  });

  const safeCards = cards || [];
  const safeCollageCards = collageCards || [];
  const hasDeckCards = safeCards.length > 0;
  const hasAnyCards = hasDeckCards || safeCollageCards.length > 0 || movingCard;
  if (!hasAnyCards) return null;

  const lastIndex = Math.max(safeCards.length - 1, 0);
  const getBasePosition = (stackIndex) => [
    stackIndex * STACK_X_STEP,
    stackIndex * STACK_Y_STEP,
    -stackIndex * STACK_Z_STEP
  ];
  const getListTransform = (index, total) => {
    const center = (Math.max(total, 1) - 1) / 2;
    return {
      position: [
        (index - center) * LIST_SPACING,
        2.32 + Math.cos((index + 1) * 0.9) * 0.06,
        0.85 - index * 0.02
      ],
      rotation: [0, 0, (index - center) * 0.05]
    };
  };

  const resetTilt = () => {
    tiltTargetRef.current.x = 0;
    tiltTargetRef.current.y = 0;
  };

  const updateTiltFromWorldPoint = (worldPoint) => {
    if (!stackGroupRef.current) return;
    const localPoint = stackGroupRef.current.worldToLocal(worldPoint.clone());
    const normalizedX = THREE.MathUtils.clamp(localPoint.x / 1.15, -1, 1);
    const normalizedY = THREE.MathUtils.clamp(localPoint.y / 1.55, -1, 1);
    tiltTargetRef.current.x = -normalizedY * 0.38;
    tiltTargetRef.current.y = normalizedX * 0.58;
  };

  useFrame(() => {
    if (!stackGroupRef.current) return;
    stackGroupRef.current.rotation.x = THREE.MathUtils.lerp(
      stackGroupRef.current.rotation.x,
      tiltTargetRef.current.x,
      0.1
    );
    stackGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      stackGroupRef.current.rotation.y,
      tiltTargetRef.current.y,
      0.1
    );
  });

  return (
    <group position={[0, -0.15, 0]}>
      {safeCollageCards.map((card, index) => {
        const transform = getListTransform(index, safeCollageCards.length + (movingCard ? 1 : 0));
        return (
          <Card
            key={`collage-${card.card_id}`}
            frontUrl={card.url_front_preprocessed || card.url_front_original}
            backUrl={card.url_back_preprocessed || card.url_back_original}
            position={transform.position}
            rotation={transform.rotation}
            index={index}
            focusedIndex={focusedCollageIndex}
            onHover={setFocusedCollageIndex}
            onHoverOut={() => setFocusedCollageIndex(null)}
            enableDragTilt
            enableFocusLift
            enableDimming={false}
            interactive={!isAnimating}
            baseScale={LIST_BASE_SCALE}
            onCardTap={null}
          />
        );
      })}

      {hasDeckCards && (
        <mesh
          position={[
            lastIndex * STACK_X_STEP * 0.5,
            safeCollageCards.length > 0 || movingCard ? STACK_DROPPED_Y : 0.25,
            0.4
          ]}
          onPointerEnter={() => {
            if (!isAnimating) document.body.style.cursor = 'pointer';
          }}
          onPointerDown={(e) => {
            if (isAnimating) return;
            e.stopPropagation();
            dragStateRef.current.active = true;
            dragStateRef.current.moved = false;
            dragStateRef.current.startX = e.clientX || 0;
            dragStateRef.current.startY = e.clientY || 0;
            updateTiltFromWorldPoint(e.point);
            e.target.setPointerCapture?.(e.pointerId);
            document.body.style.cursor = 'grabbing';
          }}
          onPointerMove={(e) => {
            if (!dragStateRef.current.active || isAnimating) return;
            e.stopPropagation();
            const dx = Math.abs((e.clientX || 0) - dragStateRef.current.startX);
            const dy = Math.abs((e.clientY || 0) - dragStateRef.current.startY);
            if (dx > 4 || dy > 4) {
              dragStateRef.current.moved = true;
            }
            updateTiltFromWorldPoint(e.point);
          }}
          onPointerUp={(e) => {
            if (!dragStateRef.current.active) return;
            e.stopPropagation();
            const wasClick = !dragStateRef.current.moved;
            dragStateRef.current.active = false;
            e.target.releasePointerCapture?.(e.pointerId);
            resetTilt();
            document.body.style.cursor = 'pointer';
            if (wasClick && !isAnimating && typeof onCycleTopCard === 'function') {
              onCycleTopCard();
            }
          }}
          onPointerLeave={() => {
            if (dragStateRef.current.active) return;
            resetTilt();
            document.body.style.cursor = 'default';
          }}
        >
          <planeGeometry args={[4.2, 5.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <group
        ref={stackGroupRef}
        position={[0, safeCollageCards.length > 0 || movingCard ? STACK_DROPPED_Y : 0, 0]}
      >
        {[...safeCards].reverse().map((card, reverseIndex) => {
          const stackIndex = safeCards.length - 1 - reverseIndex;
          if (movingCard && card.card_id === movingCard.card_id) {
            return null;
          }
          return (
            <Card
              key={`stack-${card.card_id}`}
              frontUrl={card.url_front_preprocessed || card.url_front_original}
              backUrl={card.url_back_preprocessed || card.url_back_original}
              position={getBasePosition(stackIndex)}
              rotation={[0, 0, 0]}
              index={stackIndex}
              focusedIndex={null}
              onHover={() => {}}
              onHoverOut={() => {}}
              enableDragTilt={false}
              enableFocusLift={false}
              enableDimming={false}
              interactive={false}
              baseScale={STACK_BASE_SCALE}
              onCardTap={null}
            />
          );
        })}
      </group>

      {movingCard && (() => {
        const t = stackAnimProgress;
        const easedT = t * t * (3 - 2 * t);
        const target = getListTransform(
          Math.max(movingToIndex, 0),
          safeCollageCards.length + 1
        );
        const liftArc = Math.sin(Math.PI * t);
        const forwardPush = Math.sin(Math.PI * t) * 0.22;
        const position = [
          THREE.MathUtils.lerp(0, target.position[0], easedT),
          THREE.MathUtils.lerp(0, target.position[1], easedT) + liftArc * 0.9,
          THREE.MathUtils.lerp(0, target.position[2], easedT) + forwardPush
        ];
        const rotation = [
          THREE.MathUtils.lerp(0, target.rotation[0], easedT),
          THREE.MathUtils.lerp(0, target.rotation[1], easedT),
          THREE.MathUtils.lerp(0, target.rotation[2], easedT)
        ];
        const movingScale = THREE.MathUtils.lerp(STACK_BASE_SCALE, LIST_BASE_SCALE, easedT);
        return (
          <Card
            key={`moving-${movingCard.card_id}`}
            frontUrl={movingCard.url_front_preprocessed || movingCard.url_front_original}
            backUrl={movingCard.url_back_preprocessed || movingCard.url_back_original}
            position={position}
            rotation={rotation}
            index={-1}
            focusedIndex={null}
            onHover={() => {}}
            onHoverOut={() => {}}
            enableDragTilt={false}
            enableFocusLift={false}
            enableDimming={false}
            interactive={false}
            baseScale={movingScale}
            onCardTap={null}
          />
        );
      })()}
    </group>
  );
}
