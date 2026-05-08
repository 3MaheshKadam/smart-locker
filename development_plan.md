# Smart Locker System — Development Plan

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 14 (App Router, API Routes) |
| Database | MongoDB + Mongoose |
| Email OTP | NodeMailer (Gmail SMTP or custom SMTP) |
| Payments | Razorpay (Orders API + Webhooks) |
| Hardware | ESP8266 / ESP32 (Arduino / PlatformIO) |
| Hosting | Vercel (Next.js) + MongoDB Atlas |
| Styling | Tailwind CSS + shadcn/ui |

---

## Project Structure

```
smart-locker/
├── app/
│   ├── locker/
│   │   └── [locker_id]/
│   │       ├── page.tsx              # Landing — check availability
│   │       ├── register/page.tsx     # Name + email + OTP
│   │       ├── book/page.tsx         # Duration picker + payment
│   │       ├── success/page.tsx      # Booking confirmed
│   │       └── return/page.tsx       # Retrieval + overtime handling
│   ├── admin/
│   │   ├── page.tsx                  # Dashboard
│   │   └── lockers/[id]/page.tsx     # Per-locker detail
│   └── api/
│       ├── locker/
│       │   ├── [locker_id]/route.ts  # GET locker status
│       │   └── unlock/route.ts       # POST unlock command (ESP polls)
│       ├── auth/
│       │   ├── send-otp/route.ts
│       │   └── verify-otp/route.ts
│       ├── session/
│       │   ├── create/route.ts
│       │   ├── close/route.ts
│       │   └── [session_id]/route.ts
│       └── payment/
│           ├── create-order/route.ts
│           ├── verify/route.ts
│           └── webhook/route.ts      # Razorpay webhook
├── lib/
│   ├── db.ts                         # Mongoose connection
│   ├── mailer.ts                     # NodeMailer setup
│   ├── razorpay.ts                   # Razorpay SDK init
│   └── utils.ts
├── models/
│   ├── Locker.ts
│   ├── Session.ts
│   ├── OTP.ts
│   └── Payment.ts
├── components/
│   ├── OtpInput.tsx
│   ├── DurationPicker.tsx
│   ├── PriceSummary.tsx
│   ├── RazorpayButton.tsx
│   └── SessionStatus.tsx
└── esp/
    └── smart_locker.ino              # ESP firmware
```

---

## Database Models

### Locker
```ts
{
  locker_id: string,       // unique, used in QR URL
  label: string,           // display name e.g. "Locker A3"
  location: string,
  hourly_rate: number,     // in INR
  status: 'available' | 'occupied' | 'maintenance',
  current_session_id: ObjectId | null,
  unlock_requested: boolean,   // ESP polls this flag
  last_seen: Date              // last ESP heartbeat
}
```

### Session
```ts
{
  locker_id: ObjectId,
  user_name: string,
  user_email: string,
  start_time: Date,
  paid_until: Date,           // start_time + paid_duration
  end_time: Date | null,      // set on close
  paid_duration_hours: number,
  status: 'active' | 'expired' | 'overtime' | 'closed',
  initial_payment_id: ObjectId,
  overtime_payment_id: ObjectId | null
}
```

### OTP
```ts
{
  email: string,
  otp: string,               // hashed
  locker_id: string,
  expires_at: Date,
  verified: boolean,
  attempts: number           // max 3
}
```

### Payment
```ts
{
  session_id: ObjectId,
  razorpay_order_id: string,
  razorpay_payment_id: string | null,
  amount: number,            // in paise
  type: 'initial' | 'overtime',
  status: 'pending' | 'paid' | 'failed' | 'refunded'
}
```

---

## API Contract

### Locker

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/locker/[locker_id]` | Returns locker status + hourly rate |
| GET | `/api/locker/unlock?locker_id=X` | ESP polls — returns `{ unlock: true/false }` then resets flag |

### Auth

| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| POST | `/api/auth/send-otp` | `{ email, locker_id }` | Sends OTP email |
| POST | `/api/auth/verify-otp` | `{ email, otp, locker_id }` | Verifies OTP, returns `session_token` (short-lived JWT) |

### Session

| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| POST | `/api/session/create` | `{ locker_id, name, email, duration_hours, payment_id }` | Creates session after payment |
| POST | `/api/session/close` | `{ session_id, email }` | Closes session, signals unlock |
| GET | `/api/session/[session_id]` | — | Returns session status + overtime due |

### Payment

| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| POST | `/api/payment/create-order` | `{ session_id?, locker_id, duration_hours, type }` | Creates Razorpay order |
| POST | `/api/payment/verify` | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | Verifies signature, updates DB |
| POST | `/api/payment/webhook` | Razorpay webhook payload | Handles async payment events |

---

## UI Pages

### `/locker/[locker_id]` — Landing
- Shows locker name, location, hourly rate
- Status badge: Available (green) / Occupied (red) / Maintenance (grey)
- If occupied: shows "Occupied — expected free at HH:MM"
- CTA: **Book Now** → `/locker/[locker_id]/register`
- If user has an active session on this locker: show **Return & Unlock** button

### `/locker/[locker_id]/register` — Identity Verification
- Input: Full Name, Email
- "Send OTP" button
- OTP 6-box input component (auto-focus, paste support)
- Resend OTP (60s cooldown)
- On success → `/locker/[locker_id]/book`

### `/locker/[locker_id]/book` — Booking
- Duration selector: 1h / 2h / 3h / Custom slider (1–12)
- Price breakdown card:
  - Base: ₹X × N hours
  - Convenience fee: ₹2
  - **Total: ₹Y**
- Razorpay Pay button
- On success → `/locker/[locker_id]/success`

### `/locker/[locker_id]/success` — Confirmation
- Checkmark animation
- Locker label + location
- Session timer (countdown to expiry)
- "You'll receive a reminder email 15 min before expiry"
- **Return & Unlock** button (opens return flow)

### `/locker/[locker_id]/return` — Return
- Re-verify email + OTP (security check)
- **On time**: Show session summary → Unlock button
- **Overtime**: Show red banner:
  - "Your paid time expired N hours M minutes ago"
  - Overtime amount due: ₹Z
  - Razorpay Pay Overtime button
  - On payment → Unlock

### `/admin` — Dashboard (protected)
- Cards: Total Lockers / Active Sessions / Today's Revenue
- Table: all lockers with status, current user, time remaining
- Actions: Force Unlock, Mark Maintenance

---

## ESP Firmware Logic (`smart_locker.ino`)

```
Setup:
  - Connect to WiFi
  - Store locker_id in flash

Loop (every 5 seconds):
  - GET /api/locker/unlock?locker_id=<id>
  - If response.unlock == true:
      - Trigger relay/servo to open lock
      - Hold open for 5 seconds
      - Close lock
  - POST heartbeat to /api/locker/heartbeat with locker_id
```

Hardware components:
- ESP8266 / ESP32
- 5V relay module or servo motor (for lock mechanism)
- Door sensor (magnetic reed switch) — optional
- 12V solenoid lock or servo-based latch

---

## Development Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Next.js project setup with Tailwind + shadcn/ui
- [ ] MongoDB Atlas setup + Mongoose models
- [ ] NodeMailer config (Gmail App Password or SMTP)
- [ ] Locker seed data (2–3 test lockers)
- [ ] `/api/locker/[locker_id]` GET route
- [ ] Landing page UI

### Phase 2 — Auth (Week 2–3)
- [ ] OTP generation (crypto random 6 digits) + hashing (bcrypt)
- [ ] NodeMailer OTP email template
- [ ] `/api/auth/send-otp` + `/api/auth/verify-otp`
- [ ] Session token (JWT, 30 min TTL)
- [ ] Register page UI with OTP input component

### Phase 3 — Booking + Payment (Week 3–4)
- [ ] Razorpay account setup + API keys
- [ ] `/api/payment/create-order` — create Razorpay order
- [ ] `/api/payment/verify` — HMAC signature verification
- [ ] `/api/payment/webhook` — async confirmation fallback
- [ ] `/api/session/create` — create session on payment success
- [ ] Book page UI + Razorpay checkout integration
- [ ] Locker status → `occupied` on session create

### Phase 4 — Unlock + Return Flow (Week 4–5)
- [ ] Unlock flag mechanism in Locker model
- [ ] `/api/locker/unlock` polling endpoint (ESP)
- [ ] `/api/session/close` — compute overtime, signal unlock
- [ ] Overtime detection logic (grace period aware)
- [ ] Overtime Razorpay order + payment
- [ ] Return page UI
- [ ] Expiry reminder email (cron or background job via Vercel cron)

### Phase 5 — ESP Firmware (Week 5–6)
- [ ] ESP WiFi + HTTP GET to poll unlock endpoint
- [ ] Relay / servo control on unlock signal
- [ ] Heartbeat POST for liveness
- [ ] Test end-to-end with real hardware

### Phase 6 — Admin + Polish (Week 6–7)
- [ ] Admin dashboard (basic auth protected)
- [ ] Force unlock API
- [ ] Session history table
- [ ] Mobile responsive QA (all pages)
- [ ] Error states, loading skeletons
- [ ] End-to-end test of all 3 user journeys

### Phase 7 — Deployment (Week 7–8)
- [ ] Deploy Next.js to Vercel
- [ ] Set environment variables (Razorpay keys, SMTP, MongoDB URI, JWT secret)
- [ ] Configure Razorpay webhook URL (production domain)
- [ ] QR code generation per locker (encode full URL)
- [ ] Print and attach QR codes to physical lockers
- [ ] Final demo walkthrough

---

## Environment Variables

```env
MONGODB_URI=
JWT_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
NEXT_PUBLIC_APP_URL=
```

---

## Key Security Considerations

1. OTP hashed with bcrypt before storage — never stored plain.
2. Razorpay webhook signature verified via HMAC-SHA256 before processing.
3. Unlock endpoint authenticated — ESP uses a shared secret header.
4. Session token (JWT) required for close/unlock actions.
5. Admin routes protected by middleware (basic auth or NextAuth).
6. Rate-limit OTP send route (3 sends per email per 10 minutes).

---

## Estimated Timeline

| Phase | Duration |
|-------|----------|
| Foundation | 1.5 weeks |
| Auth | 1 week |
| Booking + Payment | 1 week |
| Unlock + Return | 1 week |
| ESP Firmware | 1 week |
| Admin + Polish | 1 week |
| Deployment + Demo | 0.5 week |
| **Total** | **~7 weeks** |
