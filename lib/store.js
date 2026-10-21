import { createHmac } from 'node:crypto';

function settings() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const secret = process.env.RATE_LIMIT_KEY_SECRET;
  if (!url || !token || !secret || secret.length < 32) {
    throw new Error('OTP storage is not configured');
  }
  return { url: url.replace(/\/$/, ''), token, secret };
}

export function key(scope, value) {
  const { secret } = settings();
  return `epg-otp:${scope}:` + createHmac('sha256', secret).update(value).digest('hex');
}

export async function redis(command) {
  const { url, token } = settings();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('OTP storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('OTP storage unavailable');
  return data.result;
}

export async function limit(scope, value, maximum, seconds) {
  const redisKey = key(scope, value);
  const count = await redis(['INCR', redisKey]);
  if (count === 1) await redis(['EXPIRE', redisKey, seconds]);
  return count <= maximum;
}

export async function rememberVerification(id, phone) {
  await redis(['SET', key('verification', id), key('phone', phone), 'EX', 300]);
}

export async function knownVerification(id) {
  return Boolean(await redis(['GET', key('verification', id)]));
}

export async function forgetVerification(id) {
  await redis(['DEL', key('verification', id)]);
}

