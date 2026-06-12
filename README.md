# ClienteLoop

ClienteLoop is a Spanish-first CRM and unified inbox for small businesses. It connects customer conversations, follow-up tasks, appointments, broadcasts, and niche-specific AI responses in one workspace.

## Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Express, PostgreSQL/Supabase
- Auth: Supabase Auth
- Messaging: Meta WhatsApp Cloud API, with Embedded Signup/Coexistence support in progress
- Realtime: Socket.IO
- Billing: Stripe
- AI: Google Gemini

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in the required values.

3. Start frontend and backend:

```bash
npm run dev
```

Frontend runs on `http://localhost:4000` and the API runs on `http://localhost:3001`.

## Useful Commands

```bash
npm run lint
npm run build
npm run test:e2e
```

## WhatsApp Notes

- `META_PHONE_ID` is Meta's Phone Number ID, not the display phone number.
- `META_VERIFY_TOKEN` is used only for webhook verification setup.
- `META_APP_SECRET` is used to validate Meta webhook signatures.
- `ENABLE_CHANNELS=false` keeps WhatsApp sending in simulation mode.
- `ENABLE_CHANNELS=true` sends real messages through Meta Cloud API.

Embedded Signup and Coexistence require the appropriate Meta app review permissions before this can be offered to external businesses.
