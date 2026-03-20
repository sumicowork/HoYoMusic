import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';

const DEBUG_API_ENABLED = process.env.DEBUG_API_ENABLED === 'true';
const DEBUG_JWT_SECRET = process.env.DEBUG_JWT_SECRET || '';
const DEBUG_HMAC_SECRET = process.env.DEBUG_HMAC_SECRET || '';
const DEBUG_JWT_ISSUER = process.env.DEBUG_JWT_ISSUER || 'hoyomusic-debug';
const DEBUG_JWT_AUDIENCE = process.env.DEBUG_JWT_AUDIENCE || 'hoyomusic-debug-client';
const DEBUG_MAX_SKEW_MS = Math.max(5000, parseInt(process.env.DEBUG_MAX_SKEW_MS || '30000', 10));
const DEBUG_NONCE_TTL_MS = Math.max(60000, parseInt(process.env.DEBUG_NONCE_TTL_MS || '300000', 10));

const usedNonceMap = new Map<string, number>();

function getRealIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return (req.socket?.remoteAddress || '0.0.0.0').replace(/^::ffff:/, '');
}

function cleanupExpiredNonces(now: number): void {
  for (const [nonce, expiresAt] of usedNonceMap.entries()) {
    if (expiresAt <= now) usedNonceMap.delete(nonce);
  }
}

function hashBody(body: unknown): string {
  const serialized = body && Object.keys(body as Record<string, unknown>).length > 0
    ? JSON.stringify(body)
    : '';
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function safeHexEqual(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseAuthToken(authorization?: string): string | null {
  if (!authorization || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.substring('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export const authenticateDebug = (req: Request, res: Response, next: NextFunction) => {
  if (!DEBUG_API_ENABLED) {
    return res.status(404).json({
      success: false,
      error: { code: 'DEBUG_DISABLED', message: 'Debug API is disabled' },
    });
  }

  if (!DEBUG_JWT_SECRET || !DEBUG_HMAC_SECRET) {
    return res.status(500).json({
      success: false,
      error: { code: 'DEBUG_MISCONFIG', message: 'Debug API secrets are not configured' },
    });
  }

  const token = parseAuthToken(req.headers.authorization);
  const timestampHeader = String(req.headers['x-debug-timestamp'] || '').trim();
  const nonce = String(req.headers['x-debug-nonce'] || '').trim();
  const signature = String(req.headers['x-debug-signature'] || '').trim().toLowerCase();

  if (!token || !timestampHeader || !nonce || !signature) {
    return res.status(401).json({
      success: false,
      error: { code: 'DEBUG_AUTH_REQUIRED', message: 'Missing debug auth headers' },
    });
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) {
    return res.status(400).json({
      success: false,
      error: { code: 'DEBUG_BAD_TIMESTAMP', message: 'Invalid x-debug-timestamp' },
    });
  }

  const now = Date.now();
  if (Math.abs(now - ts) > DEBUG_MAX_SKEW_MS) {
    return res.status(401).json({
      success: false,
      error: { code: 'DEBUG_TIMESTAMP_EXPIRED', message: 'Request timestamp is out of range' },
    });
  }

  cleanupExpiredNonces(now);
  if (usedNonceMap.has(nonce)) {
    return res.status(409).json({
      success: false,
      error: { code: 'DEBUG_NONCE_REPLAY', message: 'Nonce already used' },
    });
  }

  try {
    const claims = jwt.verify(token, DEBUG_JWT_SECRET, {
      algorithms: ['HS512'],
      issuer: DEBUG_JWT_ISSUER,
      audience: DEBUG_JWT_AUDIENCE,
    }) as JwtPayload;

    if (!claims?.sub) {
      return res.status(401).json({
        success: false,
        error: { code: 'DEBUG_INVALID_TOKEN', message: 'Debug token subject is missing' },
      });
    }

    const bodyHash = hashBody(req.body);
    const signaturePayload = [
      req.method.toUpperCase(),
      req.originalUrl,
      timestampHeader,
      nonce,
      bodyHash,
    ].join('\n');

    const expectedSignature = crypto
      .createHmac('sha512', DEBUG_HMAC_SECRET)
      .update(signaturePayload)
      .digest('hex');

    if (!safeHexEqual(signature, expectedSignature)) {
      return res.status(401).json({
        success: false,
        error: { code: 'DEBUG_BAD_SIGNATURE', message: 'Invalid debug signature' },
      });
    }

    usedNonceMap.set(nonce, now + DEBUG_NONCE_TTL_MS);
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'DEBUG_AUTH_FAILED', message: 'Debug authentication failed' },
    });
  }
};


