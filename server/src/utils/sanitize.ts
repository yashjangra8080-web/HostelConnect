const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'password_hash',
  'token',
  'jwt',
  'authorization',
  'cookie',
  'x-csrf-token',
  'csrftoken',
  '_csrf'
]);

/**
 * Deeply redacts sensitive keys (passwords, tokens, cookies) from any object before logging.
 */
export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        clean[key] = sanitizeLogData(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  return data;
}

export const logger = {
  info: (message: string, meta?: any) => {
    if (meta) {
      console.log(`[INFO] ${message}`, sanitizeLogData(meta));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  warn: (message: string, meta?: any) => {
    if (meta) {
      console.warn(`[WARN] ${message}`, sanitizeLogData(meta));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },
  error: (message: string, meta?: any) => {
    if (meta) {
      console.error(`[ERROR] ${message}`, sanitizeLogData(meta));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }
};
