import crypto from 'crypto';
import { config } from '../config.js';

const LAUNDRY_SECRET =
  process.env.LAUNDRY_QR_SECRET || config.jwtSecret || 'hostelconnect-laundry-qr-hmac-secret-2026';

/**
 * Computes deterministic SHA-256 HMAC for a given machine ID.
 */
export function generateMachineHmac(machineId: number): string {
  return crypto.createHmac('sha256', LAUNDRY_SECRET).update(String(machineId)).digest('hex');
}

/**
 * Generates the official QR code payload string containing machine ID and HMAC signature.
 */
export function generateMachineQrPayload(machineId: number): string {
  const sig = generateMachineHmac(machineId);
  return JSON.stringify({ machine_id: machineId, sig });
}

/**
 * Validates a QR code payload or HMAC signature against a specific machine ID.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyMachineQr(machineId: number, qrInput: string | undefined | null): boolean {
  if (!qrInput || typeof qrInput !== 'string') {
    return false;
  }

  const expectedHmac = generateMachineHmac(machineId);

  let candidateSig = qrInput.trim();

  // 1. Try parsing JSON format: { "machine_id": 1, "sig": "..." }
  if (candidateSig.startsWith('{') && candidateSig.endsWith('}')) {
    try {
      const parsed = JSON.parse(candidateSig);
      if (Number(parsed.machine_id) !== Number(machineId) || !parsed.sig) {
        return false;
      }
      candidateSig = String(parsed.sig).trim();
    } catch {
      return false;
    }
  } else if (candidateSig.includes(':')) {
    // 2. Try prefix format: HC-WM-1:<sig> or 1:<sig>
    const parts = candidateSig.split(':');
    if (parts.length === 2) {
      const idPart = parts[0].replace(/^HC-WM-/i, '').trim();
      if (Number(idPart) !== Number(machineId)) {
        return false;
      }
      candidateSig = parts[1].trim();
    }
  }

  if (candidateSig.length !== expectedHmac.length) {
    return false;
  }

  try {
    const candidateBuf = Buffer.from(candidateSig, 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    if (candidateBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(candidateBuf, expectedBuf);
  } catch {
    return false;
  }
}
