# Smart Locker System — Business Requirements Document

## 1. Product Overview

A smart physical locker system driven by an ESP microcontroller. Each locker has a QR code that routes users to a web app (Next.js) pre-loaded with the locker's ID. Users register via email OTP, pay per hour via Razorpay, and unlock the locker from the web UI. Overtime is detected and charged automatically before the locker releases.

---

## 2. Stakeholders

| Role | Responsibility |
|------|---------------|
| Admin / Operator | Manages lockers, views revenue, handles disputes |
| End User | Scans QR, books locker, pays, retrieves belongings |
| ESP Firmware | Polls API for unlock signals, reports locker status |

---

## 3. Core User Journeys

### 3.1 Booking Flow (New User)

1. User scans QR code on physical locker.
2. Browser opens `https://<domain>/locker/<locker_id>`.
3. App shows locker status (Available / Occupied).
4. User enters **Name** and **Email**.
5. System sends 6-digit OTP via NodeMailer; OTP expires in 5 minutes.
6. User enters OTP → verified → session begins.
7. User selects duration: 1 hr / 2 hr / 3 hr / Custom (max 12 hr).
8. App displays cost breakdown (₹ per hour × hours + convenience fee).
9. User pays via **Razorpay** (UPI / Card / Netbanking).
10. On payment success → API signals ESP → locker door opens.
11. User places belongings → door closes → timer starts.

### 3.2 Retrieval Flow — On Time

1. User scans QR code on the same locker.
2. App detects active session linked to this locker.
3. User re-enters email → OTP verified.
4. App shows session summary (time used, time remaining).
5. User clicks **Unlock** → ESP receives signal → door opens.
6. Session closed, locker status reset to Available.

### 3.3 Retrieval Flow — Overtime (Edge Case)

1. User scans QR after paid duration has elapsed.
2. App detects overtime (actual time > paid duration).
3. App shows **overtime amount due** = ceil(overtime minutes / 60) × hourly rate.
4. User must pay overtime via Razorpay before unlock is granted.
5. On overtime payment success → locker unlocks → session closed.

### 3.4 Retrieval Flow — Grace Period

- A **10-minute grace period** is given after paid duration expires.
- Overtime billing starts only after grace period.
- User is emailed a warning at T-15 minutes before expiry.

---

## 4. Business Rules

| Rule | Detail |
|------|--------|
| Pricing | ₹X per hour (configurable per locker in DB) |
| Minimum booking | 1 hour |
| Maximum booking | 12 hours |
| Grace period | 10 minutes post-expiry, no extra charge |
| Overtime unit | Billed in full-hour increments (ceiling) |
| Convenience fee | Flat ₹2 per transaction |
| OTP expiry | 5 minutes |
| OTP max attempts | 3 per email per session |
| Locker states | `available` / `occupied` / `maintenance` |
| Payment states | `pending` / `paid` / `failed` / `refunded` |
| Session states | `active` / `expired` / `closed` / `overtime` |

---

## 5. Edge Cases

| Scenario | Handling |
|----------|----------|
| Payment initiated but not completed | Session not created; locker stays available |
| ESP offline / no response to unlock | Show "Locker hardware unreachable" error; auto-refund initiated |
| User scans another user's occupied locker | Show "Locker is currently occupied" with estimated free time |
| OTP not received | Resend after 60 seconds, max 3 resends |
| User loses QR access (phone dead) | Operator admin panel can force-unlock |
| Razorpay webhook delayed | Polling fallback every 30s for up to 5 minutes |
| Duplicate payment (double-click) | Razorpay order ID is idempotent; second click reuses same order |
| Session active but locker physically left open | ESP reports door sensor state; flag in admin dashboard |

---

## 6. Non-Functional Requirements

| Concern | Requirement |
|---------|-------------|
| Availability | 99.5% uptime for web app |
| Unlock latency | < 3 seconds from payment confirmation to ESP signal |
| Security | OTP-gated unlock; no session token in URL |
| Data privacy | Email stored hashed after session close |
| Mobile-first | All UI optimised for mobile (users scan from phone) |
| ESP polling | Every 5 seconds for unlock command |

---

## 7. Revenue Model

- Hourly rental fee (operator sets rate per locker).
- Overtime surcharge.
- Optional: convenience fee per transaction.

---

## 8. Admin Requirements

- Dashboard: total lockers, occupancy rate, daily revenue.
- Per-locker history: all sessions, payments, events.
- Force unlock / mark maintenance.
- Configure hourly rate per locker.
- Export CSV of sessions.
