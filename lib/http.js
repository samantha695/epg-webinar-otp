export function prepareRequest(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.statusCode = origin && !allowed.includes(origin) ? 403 : 204;
    res.end();
    return false;
  }
  if (origin && !allowed.includes(origin)) {
    send(res, 403, { error: 'Origin not allowed' });
    return false;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    send(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}

export async function readBody(req) {
  const size = Number(req.headers['content-length'] || 0);
  if (size > 2048) throw new InputError('Request body is too large');
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return parseJson(req.body);

  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 2048) throw new InputError('Request body is too large');
  }
  return parseJson(raw);
}

function parseJson(raw) {
  try {
    const body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
    return body;
  } catch {
    throw new InputError('Invalid JSON body');
  }
}

export function send(res, status, payload) {
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

export class InputError extends Error {}

export function phoneNumber(value) {
  if (typeof value !== 'string') throw new InputError('A valid Australian mobile number is required');
  const cleaned = value.replace(/[\s()-]/g, '');
  const normalized = cleaned.startsWith('04') ? '+61' + cleaned.slice(1) : cleaned;
  if (!/^\+614\d{8}$/.test(normalized)) {
    throw new InputError('A valid Australian mobile number is required');
  }
  return normalized;
}

export function verificationId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,50}$/i.test(value)) {
    throw new InputError('A valid verification ID is required');
  }
  return value;
}

export function otpCode(value) {
  if (typeof value !== 'string' || !/^\d{4,10}$/.test(value)) {
    throw new InputError('A valid verification code is required');
  }
  return value;
}

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim().slice(0, 100);
}

