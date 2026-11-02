import crypto from 'crypto';
import { config } from '../config.js';

const MESS_SECRET =
  process.env.MESS_QR_SECRET || config.jwtSecret || 'hostelconnect-mess-qr-hmac-secret-2026';

const WINDOW_MS = 60 * 1000; // 60-second rotating window

/**
 * Returns the current 60-second window index based on epoch timestamp.
 */
export function get60sWindowIndex(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / WINDOW_MS);
}

/**
 * Returns seconds remaining in the current 60-second window.
 */
export function getWindowSecondsRemaining(timestampMs: number = Date.now()): number {
  return 60 - Math.floor((timestampMs % WINDOW_MS) / 1000);
}

/**
 * Computes deterministic SHA-256 HMAC for a given meal ID and 60-second window.
 */
export function generateMessHmac(mealId: number, windowIndex: number): string {
  return crypto
    .createHmac('sha256', MESS_SECRET)
    .update(`${mealId}:${windowIndex}`)
    .digest('hex');
}

/**
 * Generates the rotating QR token string for the current meal.
 * Returns a URL-safe structured string: `HC-MEAL:<mealId>:<windowIndex>:<hmac>`
 */
export function generateMessQrToken(mealId: number, timestampMs: number = Date.now()): string {
  const windowIndex = get60sWindowIndex(timestampMs);
  const hmac = generateMessHmac(mealId, windowIndex);
  return `HC-MEAL:${mealId}:${windowIndex}:${hmac}`;
}

export interface VerifyQrResult {
  valid: boolean;
  mealId?: number;
  windowIndex?: number;
  isPreviousWindow?: boolean;
  error?: string;
}

/**
 * Validates a scanned QR token against meal ID and accepts both current and previous 60s windows.
 * Uses constant-time buffer comparison to prevent timing side-channel attacks.
 */
export function verifyMessQrToken(tokenInput: string | undefined | null, expectedMealId?: number): VerifyQrResult {
  if (!tokenInput || typeof tokenInput !== 'string') {
    return { valid: false, error: 'QR token was not provided or empty.' };
  }

  const trimmed = tokenInput.trim();
  let parsedMealId: number | null = null;
  let parsedWindow: number | null = null;
  let candidateHmac: string | null = null;

  // 1. Try JSON payload: { "meal_id": 12, "window": 29834712, "sig": "..." }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      parsedMealId = Number(obj.meal_id || obj.mealId);
      parsedWindow = Number(obj.window || obj.w);
      candidateHmac = String(obj.sig || obj.hmac || '');
    } catch {
      return { valid: false, error: 'Malformed JSON QR token payload.' };
    }
  } else if (trimmed.includes(':')) {
    // 2. Colon-separated format: HC-MEAL:<mealId>:<window>:<hmac> or <mealId>:<window>:<hmac>
    const parts = trimmed.split(':');
    if (parts.length === 4 && parts[0] === 'HC-MEAL') {
      parsedMealId = Number(parts[1]);
      parsedWindow = Number(parts[2]);
      candidateHmac = parts[3];
    } else if (parts.length === 3) {
      parsedMealId = Number(parts[0]);
      parsedWindow = Number(parts[1]);
      candidateHmac = parts[2];
    }
  }

  if (!parsedMealId || !parsedWindow || !candidateHmac) {
    return { valid: false, error: 'Unrecognized QR token format.' };
  }

  if (expectedMealId !== undefined && parsedMealId !== expectedMealId) {
    return { valid: false, error: `QR token meal ID (${parsedMealId}) does not match expected meal (${expectedMealId}).` };
  }

  // 3. Evaluate window boundaries: accept current window and immediately preceding window (60s grace)
  const currentWindow = get60sWindowIndex();
  const allowedWindows = [currentWindow, currentWindow - 1];

  if (!allowedWindows.includes(parsedWindow)) {
    return {
      valid: false,
      error: 'QR token has expired (rotated past 60-second window). Please scan the current code on the counter screen.',
    };
  }

  // 4. Verify HMAC signature for the specific window
  const expectedHmac = generateMessHmac(parsedMealId, parsedWindow);
  if (candidateHmac.length !== expectedHmac.length) {
    return { valid: false, error: 'Invalid QR token cryptographic signature.' };
  }

  const candidateBuf = Buffer.from(candidateHmac, 'hex');
  const expectedBuf = Buffer.from(expectedHmac, 'hex');

  if (candidateBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(candidateBuf, expectedBuf)) {
    return { valid: false, error: 'Cryptographic signature mismatch for QR token.' };
  }

  return {
    valid: true,
    mealId: parsedMealId,
    windowIndex: parsedWindow,
    isPreviousWindow: parsedWindow === currentWindow - 1,
  };
}
