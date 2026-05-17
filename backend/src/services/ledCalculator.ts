export interface SlotDefinition {
  row: number;
  col: number;
  ledStart: number;
  ledCount: number;
  isLarge: boolean;
}

export type StripOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Row layout (in physical strip order):
 *
 *   [rowPadding] [slot0] [ledGap] [slot1] [ledGap] … [slotN] [rowPadding]
 *
 * rowPadding = LEDs skipped at BOTH ends of every physical row.
 * Example: rowPadding=1, ledsPerSlot=4, columns=4, ledGap=0
 *   → 1 + 4+4+4+4 + 1 = 18 LEDs per row  ✓
 *
 * ledSkipFirst = global offset before the very first row (once, whole strip).
 * largeRowLeds = override LED count for the large bottom row active region
 *   (0 = same as a normal row's active region = columns*ledsPerSlot + (cols-1)*ledGap).
 *
 * stripOrigin / serpentine control the physical-to-logical column mapping.
 */
export function calculateSlots(
  rows: number,
  columns: number,
  ledsPerSlot: number,
  bottomRowLarge: boolean,
  ledGap = 0,
  serpentine = false,
  stripOrigin: StripOrigin = 'top-left',
  ledSkipFirst = 0,
  largeRowLeds = 0,
  rowPadding = 0
): SlotDefinition[] {
  const slots: SlotDefinition[] = [];
  const step = ledsPerSlot + ledGap;
  const activeWidth = columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap;
  const ledsPerRow = rowPadding + activeWidth + rowPadding;
  const largeActiveWidth = bottomRowLarge && largeRowLeds > 0 ? largeRowLeds : activeWidth;
  const largeRowTotal = rowPadding + largeActiveWidth + rowPadding;

  const stacksDown = stripOrigin.startsWith('top');
  const firstRowReversed = stripOrigin.endsWith('right');

  // Build per-physical-row start positions
  const rowStarts: number[] = [];
  let cursor = ledSkipFirst;
  for (let p = 0; p < rows; p++) {
    rowStarts.push(cursor);
    const logicalRow = stacksDown ? p : rows - 1 - p;
    cursor += bottomRowLarge && logicalRow === rows - 1 ? largeRowTotal : ledsPerRow;
  }

  for (let logicalRow = 0; logicalRow < rows; logicalRow++) {
    const isLargeRow = bottomRowLarge && logicalRow === rows - 1;
    const physIdx = stacksDown ? logicalRow : rows - 1 - logicalRow;
    const rowStart = rowStarts[physIdx];

    if (isLargeRow) {
      // Large slot: starts after rowPadding, covers largeActiveWidth
      slots.push({ row: logicalRow, col: 0, ledStart: rowStart + rowPadding, ledCount: largeActiveWidth, isLarge: true });
      continue;
    }

    const reversed = serpentine
      ? (physIdx % 2 === 0 ? firstRowReversed : !firstRowReversed)
      : firstRowReversed;

    for (let logicalCol = 0; logicalCol < columns; logicalCol++) {
      const physCol = reversed ? columns - 1 - logicalCol : logicalCol;
      // Slot starts after rowPadding, then column offset
      const ledStart = rowStart + rowPadding + physCol * step;
      slots.push({ row: logicalRow, col: logicalCol, ledStart, ledCount: ledsPerSlot, isLarge: false });
    }
  }

  return slots;
}

export function totalLedCount(
  rows: number,
  columns: number,
  ledsPerSlot: number,
  bottomRowLarge: boolean,
  ledGap = 0,
  ledSkipFirst = 0,
  largeRowLeds = 0,
  rowPadding = 0
): number {
  const activeWidth = columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap;
  const ledsPerRow = rowPadding + activeWidth + rowPadding;
  const largeActiveWidth = bottomRowLarge && largeRowLeds > 0 ? largeRowLeds : activeWidth;
  const largeRowTotal = rowPadding + largeActiveWidth + rowPadding;
  const regularRows = bottomRowLarge ? rows - 1 : rows;
  return ledSkipFirst + regularRows * ledsPerRow + (bottomRowLarge ? largeRowTotal : 0);
}
