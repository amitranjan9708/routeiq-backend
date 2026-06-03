/** Shared Skyscanner availability (CAPTCHA / rate limits). */
export interface SkyscannerStatus {
  available: boolean;
  lastError?: string;
  errorCode?: string;
}

let status: SkyscannerStatus = { available: true };

export function getSkyscannerStatus(): SkyscannerStatus {
  if (process.env.SKYSCANNER_DISABLED === '1') {
    return {
      available: false,
      lastError: 'Skyscanner disabled via SKYSCANNER_DISABLED=1',
      errorCode: 'Disabled',
    };
  }
  return { ...status };
}

export function markSkyscannerBlocked(error: string, errorCode = 'BannedWithCaptcha'): void {
  status = { available: false, lastError: error, errorCode };
  console.warn('[Skyscanner] Blocked for this backend session:', error);
}

export function shouldSkipSkyscanner(): boolean {
  if (process.env.SKYSCANNER_DISABLED === '1') return true;
  return !status.available;
}
