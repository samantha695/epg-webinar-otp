import { InputError, clientIp, phoneNumber, prepareRequest, readBody, send } from '../../lib/http.js';
import { limit, rememberVerification } from '../../lib/store.js';
import { createVerification } from '../../lib/touchsms.js';

export default async function handler(req, res) {
  if (!prepareRequest(req, res)) return;
  try {
    const { phone } = await readBody(req);
    const normalized = phoneNumber(phone);
    const [phoneAllowed, ipAllowed] = await Promise.all([
      limit('send-phone', normalized, 3, 3600),
      limit('send-ip', clientIp(req), 10, 3600)
    ]);
    if (!phoneAllowed || !ipAllowed) {
      send(res, 429, { error: 'Too many requests. Please try again later.' });
      return;
    }
    const verificationId = await createVerification(normalized);
    await rememberVerification(verificationId, normalized);
    send(res, 200, { verificationId });
  } catch (error) {
    if (error instanceof InputError) send(res, 400, { error: error.message });
    else {
      console.error('OTP start failed:', error.message);
      send(res, 503, { error: 'Verification is temporarily unavailable' });
    }
  }
}

