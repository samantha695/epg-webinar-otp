import test from 'node:test';
import assert from 'node:assert/strict';
import start from '../api/otp/start.js';
import check from '../api/otp/check.js';

const ID = '33bebe5f-9f5f-4cad-a4c7-3b57433036f6';

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body = '') { this.body = body ? JSON.parse(body) : null; }
  };
}

function request(body, origin = 'https://info.elliottgroup.com.au') {
  return { method: 'POST', headers: { origin, 'x-forwarded-for': '203.0.113.1' }, body };
}

function setup() {
  process.env.ALLOWED_ORIGINS = 'https://info.elliottgroup.com.au';
  process.env.TOUCHSMS_TOKEN_ID = 'test-id';
  process.env.TOUCHSMS_TOKEN_SECRET = 'test-secret';
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.RATE_LIMIT_KEY_SECRET = 'test-secret-that-is-at-least-32-characters';
  const values = new Map();
  const providerCalls = [];
  globalThis.fetch = async (url, options) => {
    if (url.startsWith('https://redis.example.test')) {
      const [command, key, value] = JSON.parse(options.body);
      let result;
      if (command === 'INCR') {
        result = Number(values.get(key) || 0) + 1;
        values.set(key, result);
      } else if (command === 'SET') {
        values.set(key, value);
        result = 'OK';
      } else if (command === 'GET') {
        result = values.get(key) ?? null;
      } else if (command === 'DEL') {
        result = values.delete(key) ? 1 : 0;
      } else if (command === 'EXPIRE') {
        result = 1;
      } else throw new Error(`Unexpected Redis command: ${command}`);
      return { ok: true, json: async () => ({ result }) };
    }
    providerCalls.push({ url, options, body: JSON.parse(options.body) });
    if (url.endsWith('/verify') && !url.includes(`/${ID}/`)) {
      return { status: 201, json: async () => ({ data: { id: ID, status: 'sent' } }) };
    }
    const correct = JSON.parse(options.body).code === '745494';
    return {
      status: correct ? 200 : 422,
      json: async () => correct
        ? { data: { id: ID, status: 'verified' } }
        : { message: 'Invalid code' }
    };
  };
  return { providerCalls };
}

test('sends an OTP and checks it once through touchSMS', async () => {
  const { providerCalls } = setup();
  const sent = response();
  await start(request({ phone: '0412 345 678' }), sent);
  assert.equal(sent.statusCode, 200);
  assert.equal(sent.body.verificationId, ID);
  assert.equal(providerCalls[0].body.destination, '+61412345678');
  assert.match(providerCalls[0].options.headers.Authorization, /^Basic /);

  const wrong = response();
  await check(request({ verificationId: ID, code: '000000' }), wrong);
  assert.deepEqual(wrong.body, { verified: false });

  const right = response();
  await check(request({ verificationId: ID, code: '745494' }), right);
  assert.deepEqual(right.body, { verified: true });

  const again = response();
  await check(request({ verificationId: ID, code: '745494' }), again);
  assert.equal(again.statusCode, 400);
});

test('limits SMS sends for the same number', async () => {
  const { providerCalls } = setup();
  for (let index = 0; index < 4; index++) {
    const result = response();
    await start(request({ phone: '0412345678' }), result);
    assert.equal(result.statusCode, index === 3 ? 429 : 200);
  }
  assert.equal(providerCalls.length, 3);
});

test('rejects malformed input and a different browser origin', async () => {
  setup();
  const badPhone = response();
  await start(request({ phone: '123' }), badPhone);
  assert.equal(badPhone.statusCode, 400);

  const otherOrigin = response();
  await start(request({ phone: '0412345678' }, 'https://unexpected.example'), otherOrigin);
  assert.equal(otherOrigin.statusCode, 403);
});

