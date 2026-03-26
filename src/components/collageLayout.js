const COLLAGE_INLINE_CARD_LIMIT = 10;
const COLLAGE_INLINE_COLUMN_SPACING = 1.86;
const COLLAGE_SECOND_ROW_SPACING = 1.86;
const COLLAGE_ROW_SPACING = 0.78;
const COLLAGE_LAYER_Z_STEP = 0.035;
const COLLAGE_BASE_Y = 2.72;

function buildRowCounts(total) {
  const safeTotal = Math.max(1, total);
  if (safeTotal <= COLLAGE_INLINE_CARD_LIMIT) {
    return [safeTotal];
  }
  return [COLLAGE_INLINE_CARD_LIMIT, Math.max(1, safeTotal - COLLAGE_INLINE_CARD_LIMIT)];
}

function getRowAndColumn(index, rowCounts) {
  let remainingIndex = index;

  for (let row = 0; row < rowCounts.length; row += 1) {
    const rowCount = rowCounts[row];
    if (remainingIndex < rowCount) {
      return {
        row,
        columnIndex: remainingIndex,
        rowCount
      };
    }
    remainingIndex -= rowCount;
  }

  const lastRow = rowCounts.length - 1;
  return {
    row: lastRow,
    columnIndex: Math.max(0, rowCounts[lastRow] - 1),
    rowCount: rowCounts[lastRow]
  };
}

function getColumnSpacing(count) {
  const safeCount = Math.max(1, count);
  if (safeCount <= COLLAGE_INLINE_CARD_LIMIT) return COLLAGE_INLINE_COLUMN_SPACING;
  return COLLAGE_SECOND_ROW_SPACING;
}

export function getCollageTransform(index, actualCount, slotCount = actualCount) {
  const safeActualCount = Math.max(1, actualCount);
  const safeSlotCount = Math.max(1, slotCount);
  const rowCounts = buildRowCounts(safeSlotCount);
  const { row, columnIndex, rowCount } = getRowAndColumn(index, rowCounts);
  const visibleRowCounts = buildRowCounts(safeActualCount);
  const visibleRowCount = visibleRowCounts[row] || rowCount;
  const rowCenter = (visibleRowCount - 1) / 2;
  const rowSpacingFactor = 1 - row * 0.08;
  const columnSpacing = getColumnSpacing(visibleRowCount);
  const x =
    (columnIndex - rowCenter) * columnSpacing * Math.max(0.7, rowSpacingFactor);
  const totalRows = visibleRowCounts.length;
  const verticalCenterOffset = ((totalRows - 1) * COLLAGE_ROW_SPACING) / 2;
  const singleRowArcLift = visibleRowCounts.length === 1
    ? Math.cos((columnIndex - rowCenter) * 0.55) * 0.08
    : 0;
  const y =
    COLLAGE_BASE_Y -
    verticalCenterOffset -
    row * COLLAGE_ROW_SPACING +
    Math.cos((index + 1) * 0.9) * 0.05 +
    singleRowArcLift;
  const z = 0.9 - row * 0.05 - row * 0.03 + index * COLLAGE_LAYER_Z_STEP;
  const rotationZ = (columnIndex - rowCenter) * (visibleRowCount <= COLLAGE_INLINE_CARD_LIMIT ? 0.035 : 0.06);

  return {
    position: [x, y, z],
    rotation: [0, 0, rotationZ]
  };
}
