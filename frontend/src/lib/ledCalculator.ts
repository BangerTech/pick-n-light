export type StripOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export function totalLedCount(
  rows: number,
  columns: number,
  ledsPerSlot: number,
  _bottomRowLarge: boolean,
  ledGap = 0
): number {
  const ledsPerRow = columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap;
  return rows * ledsPerRow;
}

export function calculateSlotsClient(
  rows: number,
  columns: number,
  ledsPerSlot: number,
  bottomRowLarge: boolean,
  ledGap = 0,
  serpentine = false,
  stripOrigin: StripOrigin = 'top-left'
): { row: number; col: number; ledStart: number; ledCount: number; isLarge: boolean }[] {
  const slots: { row: number; col: number; ledStart: number; ledCount: number; isLarge: boolean }[] = [];
  const step = ledsPerSlot + ledGap;
  const ledsPerRow = columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap;

  const stacksDown = stripOrigin.startsWith('top');
  const firstRowReversed = stripOrigin.endsWith('right');

  for (let logicalRow = 0; logicalRow < rows; logicalRow++) {
    const isLargeRow = bottomRowLarge && logicalRow === rows - 1;

    const physicalRowIdx = stacksDown ? logicalRow : rows - 1 - logicalRow;
    const rowStart = physicalRowIdx * ledsPerRow;

    const reversed = serpentine
      ? (physicalRowIdx % 2 === 0 ? firstRowReversed : !firstRowReversed)
      : firstRowReversed;

    if (isLargeRow) {
      slots.push({ row: logicalRow, col: 0, ledStart: rowStart, ledCount: ledsPerRow, isLarge: true });
      continue;
    }

    for (let logicalCol = 0; logicalCol < columns; logicalCol++) {
      const physicalCol = reversed ? columns - 1 - logicalCol : logicalCol;
      const ledStart = rowStart + physicalCol * step;
      slots.push({ row: logicalRow, col: logicalCol, ledStart, ledCount: ledsPerSlot, isLarge: false });
    }
  }

  return slots;
}
