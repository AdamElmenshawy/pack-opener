import * as THREE from 'three';

export const MAX_CARDS_PER_ROW = 10;
const ROW_DEPTH_OFFSET = 0.16;
export const HAND_BASE_Z = -1.2;
const MIN_ROW_SPACING_X = 1.45;
const MAX_ROW_SPACING_X = 2.7;
const CARD_WORLD_WIDTH = 2.5;
const VIEWPORT_SIDE_PADDING = 0.8;
const VIEWPORT_TOP_BOTTOM_PADDING = 1.9;
const DETAIL_SPREAD_BOOST = 1.12;
const DETAIL_ROW_PUSH_X = 0.45;

export function getHandRowCounts(totalCards) {
  const safeTotal = Math.max(0, totalCards);
  const rowCount = safeTotal > MAX_CARDS_PER_ROW ? 2 : 1;
  const topRowCount = rowCount === 1 ? safeTotal : Math.ceil(safeTotal / 2);
  const bottomRowCount = rowCount === 1 ? 0 : safeTotal - topRowCount;

  return {
    rowCount,
    topRowCount,
    bottomRowCount
  };
}

function getRowSpacing(count, layoutWidth) {
  if (count <= 1) return 0;
  const usableWidth = Math.max(8, layoutWidth - VIEWPORT_SIDE_PADDING * 2);
  const fittedSpacing = (usableWidth - CARD_WORLD_WIDTH) / Math.max(count - 1, 1);
  return THREE.MathUtils.clamp(fittedSpacing, MIN_ROW_SPACING_X, MAX_ROW_SPACING_X);
}

function getRowOffsetY(rowCount, layoutHeight) {
  if (rowCount === 1) return 0;
  const usableHeight = Math.max(6, layoutHeight - VIEWPORT_TOP_BOTTOM_PADDING);
  return THREE.MathUtils.clamp(usableHeight * 0.24, 1.8, 2.9);
}

export function getHandTransform(index, totalCards, layoutWidth, layoutHeight, selectedIndex = null) {
  const { rowCount, topRowCount, bottomRowCount } = getHandRowCounts(totalCards);
  const isSelected = selectedIndex === index;
  const isBottomRow = rowCount > 1 && index >= topRowCount;
  const rowIndex = isBottomRow ? 1 : 0;
  const rowTotal = isBottomRow ? bottomRowCount : topRowCount;
  const indexInRow = isBottomRow ? index - topRowCount : index;
  const baseSpacing = getRowSpacing(rowTotal, layoutWidth);
  const spacing = baseSpacing * (selectedIndex !== null ? DETAIL_SPREAD_BOOST : 1);
  const centeredIndex = indexInRow - (rowTotal - 1) / 2;
  const normalizedX = rowTotal > 1 ? centeredIndex / ((rowTotal - 1) / 2 || 1) : 0;
  const rowOffsetY = getRowOffsetY(rowCount, layoutHeight);

  let positionX = centeredIndex * spacing;
  if (selectedIndex !== null && selectedIndex !== index) {
    positionX += Math.sign(normalizedX || centeredIndex || (index < selectedIndex ? -1 : 1)) * DETAIL_ROW_PUSH_X;
  }

  const positionY = rowCount === 1
    ? -Math.abs(normalizedX) * 0.16
    : (rowIndex === 0 ? rowOffsetY : -rowOffsetY) - Math.abs(normalizedX) * 0.14;
  const positionZ = HAND_BASE_Z + rowIndex * ROW_DEPTH_OFFSET - Math.abs(normalizedX) * 0.04;
  const rotationY = normalizedX * -0.12;
  const rotationZ = normalizedX * -0.025;

  if (isSelected) {
    return {
      position: [0, 0, HAND_BASE_Z + 0.3],
      rotation: [0, 0, 0],
      renderOrder: 999
    };
  }

  return {
    position: [positionX, positionY, positionZ],
    rotation: [0, rotationY, rotationZ],
    renderOrder: rowIndex * MAX_CARDS_PER_ROW + indexInRow
  };
}
