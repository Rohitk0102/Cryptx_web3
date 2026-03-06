/**
 * Currency Utility
 * 
 * Handles currency conversion and formatting for the application.
 * Default currency is INR (Indian Rupee).
 */

// Exchange rate: 1 USD = 83 INR (approximate, should be fetched from API in production)
const USD_TO_INR_RATE = 83;

/**
 * Convert USD to INR
 */
export function usdToInr(usdAmount: number): number {
  return usdAmount * USD_TO_INR_RATE;
}

/**
 * Convert INR to USD
 */
export function inrToUsd(inrAmount: number): number {
  return inrAmount / USD_TO_INR_RATE;
}

/**
 * Format currency value in INR
 */
export function formatINR(value: number, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

/**
 * Format currency value in USD (for reference)
 */
export function formatUSD(value: number, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

/**
 * Format a USD value and convert it to INR for display
 */
export function formatUSDAsINR(usdValue: number, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string {
  const inrValue = usdToInr(usdValue);
  return formatINR(inrValue, options);
}

/**
 * Get the current exchange rate
 */
export function getExchangeRate(): number {
  return USD_TO_INR_RATE;
}
