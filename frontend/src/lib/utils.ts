import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isLowStock(part: { quantity: number; minQuantity: number | null }): boolean {
  if (part.minQuantity === null || part.minQuantity === undefined) return false;
  return part.quantity <= part.minQuantity;
}

export function formatQuantity(quantity: number, unit: string): string {
  const n = Number.isInteger(quantity) ? quantity : quantity.toFixed(1);
  return `${n} ${unit}`;
}
