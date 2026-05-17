export interface Part {
  id: number;
  slotId: number;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  minQuantity: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  slot?: Slot;
}

export interface Slot {
  id: number;
  magazineId: number;
  row: number;
  col: number;
  ledStart: number;
  ledCount: number;
  isLarge: boolean;
  part: Part | null;
  magazine?: Magazine;
}

export interface WledDevice {
  id: number;
  magazineId: number;
  name: string;
  ipAddress: string | null;
  mqttTopic: string;
  ledCount: number;
  createdAt: string;
  magazine?: { id: number; name: string };
}

export interface Magazine {
  id: number;
  name: string;
  rows: number;
  columns: number;
  ledsPerSlot: number;
  ledGap: number;
  ledSkipFirst: number;
  rowPadding: number;
  serpentine: boolean;
  stripOrigin: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  bottomRowLarge: boolean;
  largeRowLeds: number;
  createdAt: string;
  updatedAt: string;
  slots: Slot[];
  wledDevices: WledDevice[];
  occupiedSlots?: number;
  _count?: { slots: number };
}

export interface Settings {
  led_auto_off_seconds: string;
  search_highlight_color: string;
  not_found_color: string;
  low_stock_color: string;
  [key: string]: string;
}

export interface SearchResult extends Part {
  slot: Slot & { magazine: Magazine };
}
