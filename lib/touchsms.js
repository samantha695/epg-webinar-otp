function credentials() {
  const id = process.env.TOUCHSMS_TOKEN_ID;
  const secret = process.env.TOUCHSMS_TOKEN_SECRET;
  if (!id || !secret) throw new Error('TouchSMS is not configured');
  return Buffer.from(`${id}:${secret}`).toString('base64');
}

async function request(path, body) {
  const response = await fetch(`https://app.touchsms.com.au/api/v3/verify${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

export async function createVerification(phone) {
  const template = process.env.OTP_MESSAGE_TEMPLATE || 'Your EPG webinar verification code is %code%';
  if (!template.includes('%code%')) throw new Error('OTP template must include %code%');
  const result = await request('', { destination: phone, template });
  const id = result.data?.data?.id;
  if (result.status !== 201 || typeof id !== 'string') {
    throw new Error('TouchSMS could not create verification');
  }
  return id;
}

export async function checkVerification(id, code) {
  const result = await request(`/${encodeURIComponent(id)}/verify`, { code });
  if (result.status === 422) return false;
  if (result.status !== 200) throw new Error('TouchSMS could not check verification');
  return result.data?.data?.status === 'verified';
}

