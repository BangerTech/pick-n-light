export interface SlotDefinition {
  row: number;
  col: number;
  ledStart: number;
  ledCount: number;
  isLarge: boolean;
}

export type StripOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Calculate LED positions for all slots in a magazine.
 *
 * Logical grid (what the user sees in the UI):
 *   row 0 = top row, col 0 = left column.
 *
 * Physical strip layout (depends on hardware wiring):
 *   - stripOrigin: which corner of the magazine is the FIRST LED on the strip.
 *   - serpentine:  if true, every other physical row runs in the opposite direction.
 *
 * The first physical row starts at the strip origin and runs:
 *   - top-left / bottom-left  → left to right  (so logical col 0 maps to physical col 0)
 *   - top-right / bottom-right → right to left (so logical col 0 maps to physical col cols-1)
 *
 * Each subsequent physical row stacks toward the opposite vertical edge of the magazine.
 * With serpentine on, the horizontal direction flips each row.
 *
 * Row pattern (LED indices in a single physical row): [ledsPerSlot] [ledGap] ... [ledsPerSlot]
 * Large bottom row: one slot covering the full row width including gaps.
 */
export function calculateSlots(
  rows: number,
  columns: number,
  ledsPerSlot: number,
  bottomRowLarge: boolean,
  ledGap = 0,
  serpentine = false,
  stripOrigin: StripOrigin = 'top-left'
): SlotDefinition[] {
  const slots: SlotDefinition[] = [];
  const step = ledsPerSlot + ledGap;
  const ledsPerRow = columns * ledsPerSlot + Math.max(0, columns - 1) * ledGap;

  // Vertical direction: do physical rows stack downward (top origin) or upward (bottom origin)?
  const stacksDown = stripOrigin.startsWith('top');
  // Horizontal direction of the FIRST physical row
  const firstRowReversed = stripOrigin.endsWith('right');

  for (let logicalRow = 0; logicalRow < rows; logicalRow++) {
    const isLargeRow = bottomRowLarge && logicalRow === rows - 1;

    // Map logical row → physical row index along the strip.
    const physicalRowIdx = stacksDown ? logicalRow : rows - 1 - logicalRow;
    const rowStart = physicalRowIdx * ledsPerRow;

    // Determine if THIS physical row runs reversed (right→left in logical space).
    // Without serpentine: every row matches the first-row direction.
    // With serpentine: alternate.
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
