const COLLAGE_MAX_COLUMNS = 4;
const COLLAGE_COLUMN_SPACING = 1.6;
const COLLAGE_ROW_SPACING = 0.78;

function buildRowCounts(total) {
  const safeTotal = Math.max(1, total);
  const rowCount = Math.ceil(safeTotal / COLLAGE_MAX_COLUMNS);
  const baseCount = Math.floor(safeTotal / rowCount);
  const remainder = safeTotal % rowCount;

  return Array.from({ length: rowCount }, (_, index) => (
    baseCount + (index < remainder ? 1 : 0)
  ));
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

export function getCollageTransform(index, actualCount, slotCount = actualCount) {
  const safeActualCount = Math.max(1, actualCount);
  const safeSlotCount = Math.max(1, slotCount);
  const rowCounts = buildRowCounts(safeSlotCount);
  const { row, columnIndex, rowCount } = getRowAndColumn(index, rowCounts);
  const visibleRowCounts = buildRowCounts(safeActualCount);
  const visibleRowCount = visibleRowCounts[row] || rowCount;
  const rowCenter = (visibleRowCount - 1) / 2;
  const rowSpacingFactor = 1 - row * 0.08;
  const x =
    (columnIndex - rowCenter) * COLLAGE_COLUMN_SPACING * Math.max(0.7, rowSpacingFactor);
  const totalRows = visibleRowCounts.length;
  const verticalCenterOffset = ((totalRows - 1) * COLLAGE_ROW_SPACING) / 2;
  const y =
    2.34 - verticalCenterOffset - row * COLLAGE_ROW_SPACING + Math.cos((index + 1) * 0.9) * 0.05;
  const z = 0.9 - row * 0.05 - row * 0.03;
  const rotationZ = (columnIndex - rowCenter) * 0.06;

  return {
    position: [x, y, z],
    rotation: [0, 0, rotationZ]
  };
}
