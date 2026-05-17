import type { Magazine, Part, WledDevice, Settings, SearchResult } from './types';

const BASE = '/api';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Magazines
export const api = {
  magazines: {
    list: () => req<Magazine[]>('GET', '/magazines'),
    get: (id: number) => req<Magazine>('GET', `/magazines/${id}`),
    create: (data: {
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
    }) => req<Magazine>('POST', '/magazines', data),
    update: (id: number, data: {
      name?: string;
      ledsPerSlot?: number;
      ledGap?: number;
      ledSkipFirst?: number;
      rowPadding?: number;
      serpentine?: boolean;
      stripOrigin?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      largeRowLeds?: number;
    }) => req<Magazine>('PUT', `/magazines/${id}`, data),
    delete: (id: number) => req<{ success: boolean }>('DELETE', `/magazines/${id}`),
    duplicate: (id: number) => req<Magazine>('POST', `/magazines/${id}/duplicate`),
  },

  parts: {
    create: (data: {
      slotId: number;
      name: string;
      description?: string;
      quantity: number;
      unit: string;
      minQuantity?: number | null;
      tags?: string[];
    }) => req<Part>('POST', '/parts', data),
    update: (id: number, data: Partial<Part>) => req<Part>('PUT', `/parts/${id}`, data),
    delete: (id: number) => req<{ success: boolean }>('DELETE', `/parts/${id}`),
  },

  search: {
    query: (q: string) => req<SearchResult[]>('GET', `/search?q=${encodeURIComponent(q)}`),
    highlight: (slotId: number) => req<{ success: boolean }>('POST', `/search/highlight/${slotId}`),
    clearHighlight: () => req<{ success: boolean }>('DELETE', '/search/highlight'),
  },

  wled: {
    status: () => req<{ status: string }>('GET', '/wled/status'),
    devices: () => req<WledDevice[]>('GET', '/wled/devices'),
    create: (data: Omit<WledDevice, 'id' | 'createdAt' | 'magazine'>) =>
      req<WledDevice>('POST', '/wled/devices', data),
    update: (id: number, data: Partial<WledDevice>) =>
      req<WledDevice>('PUT', `/wled/devices/${id}`, data),
    delete: (id: number) => req<{ success: boolean }>('DELETE', `/wled/devices/${id}`),
    test: (
      id: number,
      mode: 'flash' | 'sequence' = 'flash',
      delayMs?: number,
      totalLedsOverride?: number,
      slotOverrides?: { ledStart: number; ledCount: number }[]
    ) =>
      req<{ success: boolean; message: string; mqttTopic: string; messagesCount: number }>(
        'POST', `/wled/devices/${id}/test`, { mode, delayMs, totalLedsOverride, slotOverrides }
      ),
    lightRange: (
      id: number,
      ledStart: number,
      ledCount: number,
      color?: [number, number, number],
      totalLedsOverride?: number
    ) =>
      req<{ success: boolean }>('POST', `/wled/devices/${id}/light-range`, { ledStart, ledCount, color, totalLedsOverride }),
    allOff: (id: number) =>
      req<{ success: boolean }>('POST', `/wled/devices/${id}/all-off`),
  },

  settings: {
    get: () => req<Settings>('GET', '/settings'),
    update: (data: Partial<Settings>) => req<{ success: boolean }>('PUT', '/settings', data),
  },

  tags: {
    list: () => req<string[]>('GET', '/tags'),
  },
};
