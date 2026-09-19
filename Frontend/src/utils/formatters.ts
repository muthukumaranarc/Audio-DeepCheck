/**
 * Safe numeric formatters to prevent runtime TypeError when values are null or undefined.
 */

export function formatStrength(val: number | null | undefined, fallback = '0.00'): string {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
}

export function formatPercent(val: number | null | undefined, fallback = '0%'): string {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return `${(val * 100).toFixed(0)}%`;
}

export function formatSec(val: number | null | undefined, digits = 1, fallback = '0.0'): string {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return val.toFixed(digits);
}
