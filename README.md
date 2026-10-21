# EPG webinar SMS verification backend

Two Vercel API routes connect the webinar registration page to touchSMS Verify. The browser never receives touchSMS API credentials.

## API

- `POST /api/otp/start` with `{ "phone": "0412345678" }` returns `{ "verificationId": "..." }` after touchSMS sends the SMS.
- `POST /api/otp/check` with `{ "verificationId": "...", "code": "123456" }` returns `{ "verified": true }` only when touchSMS accepts the code.

Only Australian mobile numbers are accepted. Repeated sends and checks are limited using a shared Redis store. Verification IDs expire after five minutes in this backend. CORS accepts only the origins in `ALLOWED_ORIGINS`.

## Setup

1. Copy `.env.example` to `.env` for local configuration. Do not commit `.env`.
2. Set touchSMS Token ID and Token Secret from touchSMS API Settings.
3. Create an Upstash Redis database and set its REST URL and token. Set `RATE_LIMIT_KEY_SECRET` to a random value of at least 32 characters.
4. Set `ALLOWED_ORIGINS` to the exact webinar page origin. Comma-separate multiple origins if needed.
5. Add the same environment variables to the Vercel project before deployment.

No live SMS is sent by the test suite. Run `npm test` to verify input handling and provider behavior.

## Handoff to Samantha

Transfer the GitHub repository to `samantha695` after her existing repository with the same name has been removed or renamed. Transfer the Vercel project separately, or create a new project in her Vercel account. Enter environment variables into her deployment without committing or sending credentials through GitHub.

## Integration boundary

These routes confirm an SMS code but do not submit a HubSpot form or enforce that HubSpot registration requires verification. The existing page must call both routes. If registration itself must be protected from direct submissions, that submission must move behind a separate backend endpoint.

