# LetsTalkBuddy

A marketplace for paid, per-minute conversations — expert advice, mentorship, or just companionship. Node.js + Express + MySQL.

## Running the app

**Requirements:** Node.js 18+, MySQL/MariaDB on port 3306 (XAMPP works).

```bash
npm install                # install dependencies
cp .env.example .env       # then edit DB credentials if needed (defaults: root, no password)
npm run db:setup           # creates the letstalkbuddy database, tables, and sample data
npm start                  # serves the app at http://localhost:3000
```

Demo login: `demo@letstalkbuddy.com` / `password123`

**Add more sample data** (random advisors):

```bash
npm run db:add-data              # adds 20
node scripts/add-advisors.js 50  # adds 50
```

## Project layout

| Path | Purpose |
|---|---|
| `server.js` | Express server: static files + REST API (auth, categories, advisor search) |
| `db.js` | MySQL connection pool |
| `db/schema.sql` | Database schema (users, categories, advisors, reviews) |
| `db/seed.sql` | Demo user and 9 sample advisors |
| `scripts/taxonomy.js` | Hierarchical category tree (9 top-level groups, subcategories, sub-subcategories) |
| `scripts/migrate-categories.js` | One-off migration from the old flat categories to the tree |
| `scripts/setup-db.js` | Applies schema + seed |
| `scripts/add-advisors.js` | Generates random advisors |
| `public/index.html` | Landing page (categories + featured advisors from the DB) |
| `public/signup.html`, `public/login.html` | Auth pages (bcrypt + sessions) |
| `public/search.html` | Advisor search with live filters (category, price, language, rating, online) |
| `public/profile.html` | Advisor profile: about, gallery, reviews, sticky booking sidebar |
| `scripts/migrate-profile.js` | One-off migration adding profile fields to an existing database |
| `public/css/style.css`, `public/js/app.js` | Shared styles and helpers |
| `public/LetsTalkBuddy.dc.html` | Original design comp (kept for reference; not used by the app) |

### API

- `POST /api/auth/signup` — `{ name, email, password, role }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/categories` — flat list with `parent_id`; clients build the tree. Filtering by a category includes all of its descendants.
- `GET /api/advisors?q=&categories=1,2&online=1&minRating=4.5&maxRate=2&language=Bangla&featured=1`
- `GET /api/advisors/:id` — full profile plus latest reviews

---

# Expert Time Marketplace — Feature List (MoSCoW)

**Concept:** A marketplace where anyone — doctors, engineers, psychiatrists, businesspeople, chess players, or just a friendly listener — sets a per-minute/per-hour rate, and users book paid sessions for advice, mentorship, or companionship.

**Name ideas:** Minutly, TalkTime, Porামর্শ (Poramorsho — "advice" in Bangla), HourWise, Advisr, KothaBox, TimeTaka, Sohay, MindMinute, Boloi ("speak" vibe), Adda+ (Bangla "adda" = friendly chat), GyaanCall.

---

## MUST HAVE (MVP — can't launch without these)

### Accounts & Profiles
1. User registration (email, phone/OTP, Google login)
2. Two roles: Seeker (buyer) and Advisor (seller) — one account can be both
3. Advisor profile: photo, bio, expertise tags, languages spoken
4. Per-minute and per-hour rate setting (advisor-defined)
5. Advisor availability calendar / online-offline toggle
6. Profile verification badge (ID verification at minimum)

### Discovery
7. Category browsing (Health, Legal, Tech, Business, Career, Life/Companionship, Hobbies, Religion, etc.)
8. Search with filters: category, price range, language, rating, availability
9. Advisor listing cards with rate, rating, response time

### Booking & Sessions
10. Instant call ("available now") and scheduled booking
11. In-app audio call
12. In-app text chat sessions
13. Per-minute billing timer visible to both parties during session
14. Session end summary (duration, cost)

### Payments
15. Wallet system — user tops up, advisor earns to wallet
16. Local payment methods (bKash, Nagad, cards, for BD market)
17. Automatic per-minute deduction from wallet during live session
18. Advisor payout/withdrawal requests
19. Platform commission (e.g., 15–25% cut)
20. Transaction history for both sides

### Trust & Safety
21. Ratings and written reviews after each session
22. Report/block users
23. Basic content moderation (profanity, abuse flags)
24. Clear disclaimer: advice ≠ licensed professional service (critical for medical/legal/mental-health categories)
25. Refund/dispute request flow

### Core Infra
26. Push/email notifications (booking, call incoming, payment)
27. Admin panel: user management, advisor approval, dispute handling, payout approval
28. Terms of service, privacy policy, KYC for advisors receiving money

---

## SHOULD HAVE (v1.x — soon after launch)

### Sessions & Communication
29. In-app video calls
30. Call recording (with both-party consent) for dispute resolution
31. Session extension mid-call ("add 15 more minutes")
32. Free first 2–3 minutes teaser (advisor-optional)
33. Async paid Q&A — send a question, advisor replies within X hours for a flat fee
34. Voice notes in chat sessions
35. File/image sharing in sessions (e.g., share a report with a doctor, a resume with a career coach)

### Advisor Tools
36. Advisor dashboard: earnings, session stats, ratings trend
37. Custom packages ("3 sessions for X", "30-min resume review — flat rate")
38. Auto-decline / do-not-disturb hours
39. Quick reply templates
40. Credential upload & verified-professional badge tier (license verification for doctors/lawyers/psychologists)
41. Advisor intro video on profile

### Discovery & Growth
42. Featured/top advisors section
43. "Online now" filter for instant connection
44. Personalized recommendations based on browsing/booking history
45. Referral program (both seeker & advisor referrals)
46. Promo codes and discount campaigns
47. SEO-friendly public advisor profile pages

### Payments
48. Multiple currency support (USD for NRB diaspora + BDT)
49. Subscription plans for seekers (monthly minutes bundle at discount)
50. Tipping after a great session
51. Automatic invoices/receipts

### Trust & Safety
52. Phone/ID verification tiers displayed on profile
53. AI-assisted chat moderation (detect harassment, scam attempts, off-platform payment solicitation)
54. Escrow-style hold: money released to advisor only after session completes without dispute
55. Anonymous mode for seekers (especially mental-health/loneliness categories)

---

## COULD HAVE (differentiators — later versions)

### Companionship & "Time Pass" Vertical
56. "Just Talk" category — listeners, adda partners, language practice buddies
57. Group sessions / paid group calls (one advisor, many listeners — webinar style)
58. Interest-based matching ("find someone who loves cricket to chat with")
59. Scheduled recurring companionship calls (daily 10-min check-in for elderly users)
60. Icebreaker prompts and conversation games in chat

### Gamification & Community
61. Advisor leaderboards (weekly top-rated)
62. Badges: "500 sessions", "Fast responder", "Top mentor"
63. Public AMA events with famous advisors
64. Community forum / free public Q&A that funnels to paid sessions
65. Follow advisors, get notified when they go live

### AI Features
66. AI matchmaking — describe your problem in plain language, get matched to right advisors
67. AI session summaries and action items emailed after call
68. AI-suggested rate for new advisors based on category/credentials
69. AI pre-screening chatbot that gathers context before human session starts
70. Real-time translation for cross-language sessions (NRB kids ↔ BD experts)

### Advisor Business Suite
71. Advisor mobile app with earnings analytics
72. Marketing tools: shareable booking links, embeddable "Book me" widget
73. CRM-lite: notes about repeat clients
74. Multi-tier pricing (peak-hour pricing, loyal-client discounts)
75. Team/agency accounts (a clinic listing multiple doctors)

### Platform Expansion
76. Corporate/B2B accounts (companies buy mentorship credits for employees)
77. Gift cards ("gift your friend a session with a career coach")
78. Marketplace API for third-party integration
79. White-label version for organizations
80. Affiliate program for bloggers/influencers

### UX Enhancements
81. Dark mode
82. Bangla + English full localization
83. Low-bandwidth call mode (critical for BD networks)
84. Waitlist/queue when advisor is busy ("you're #2 in line")
85. In-call collaborative tools (shared whiteboard, chess board for chess coaching!)
86. Screen sharing (for engineers/tech consultations)

---

## WON'T HAVE (this phase — explicitly out of scope)

87. Physical/in-person meeting facilitation (huge safety & liability risk)
88. Prescriptions or formal medical diagnoses (regulatory nightmare — advisory only)
89. Legal representation or filing (advice only)
90. Dating/romance positioning (moderation & brand risk — companionship ≠ dating; enforce this hard)
91. Crypto payments (regulatory uncertainty in BD)
92. Livestream tipping/gifting economy (different product; scope creep)
93. Advisor lending/advances against future earnings
94. Own video-call infrastructure from scratch (use Agora/Twilio/LiveKit instead)
95. Native desktop apps (web + Android first; iOS later)

---

## Suggested MVP cut (8–12 weeks)

Registration → advisor profiles with rates → search/browse → wallet top-up (bKash/Nagad) → instant audio call + chat with per-minute billing → ratings → payouts → admin panel. Everything else waits.

## Key risks to plan for early
- **Off-platform leakage:** users exchanging phone numbers to avoid commission → detect & deter (feature #53)
- **Liability:** medical/mental-health advice needs airtight disclaimers + licensed-tier verification
- **Loneliness vertical drifting into dating/adult content** → strict moderation policy from day one
- **Chicken-and-egg:** seed the supply side first (recruit 50–100 quality advisors before public launch)
