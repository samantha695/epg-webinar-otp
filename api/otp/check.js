import { InputError, clientIp, otpCode, prepareRequest, readBody, send, verificationId } from '../../lib/http.js';
import { forgetVerification, knownVerification, limit } from '../../lib/store.js';
import { checkVerification } from '../../lib/touchsms.js';

export default async function handler(req, res) {
  if (!prepareRequest(req, res)) return;
  try {
    const body = await readBody(req);
    const id = verificationId(body.verificationId);
    const code = otpCode(body.code);
    const [idAllowed, ipAllowed] = await Promise.all([
      limit('check-id', id, 5, 600),
      limit('check-ip', clientIp(req), 30, 600)
    ]);
    if (!idAllowed || !ipAllowed) {
      send(res, 429, { error: 'Too many attempts. Please request a new code later.' });
      return;
    }
    if (!(await knownVerification(id))) {
      send(res, 400, { error: 'Verification expired. Please request a new code.' });
      return;
    }
    const verified = await checkVerification(id, code);
    if (verified) await forgetVerification(id);
    send(res, 200, { verified });
  } catch (error) {
    if (error instanceof InputError) send(res, 400, { error: error.message });
    else {
      console.error('OTP check failed:', error.message);
      send(res, 503, { error: 'Verification is temporarily unavailable' });
    }
  }
}

