# Lifeline — Every drop has a story

A locally working MERN blood-donation coordination platform with an original editorial identity. React talks to Express; every hospital, requirement, registration, appointment, notification and dashboard metric comes from MongoDB. The default seed contains **fictitious demonstration data only**.

## Run locally

Requires Node.js 22.12+ and MongoDB Community 7+ (or a MongoDB Atlas connection).

```sh
npm install
npm run setup
npm run db
```

Keep the database terminal running. In another terminal:

```sh
npm run seed
npm run dev
```

Open **http://127.0.0.1:5173**. API: `http://127.0.0.1:4000/api`; local MongoDB: port `27018`. Use `127.0.0.1` consistently rather than mixing it with `localhost` so cookies and origin checks agree.

`npm run setup` creates an ignored, permission-restricted `.env` with a random JWT secret. For Atlas, replace `MONGODB_URI` and skip `npm run db`. `npm run seed` is repeatable, preserves existing users, and refuses production or non-demo environments. It never clears a database.

## Development accounts

| Role                   | Email                        | Password        |
| ---------------------- | ---------------------------- | --------------- |
| Donor                  | `donor@lifeline.example`     | `DemoLife2026!` |
| Hospital administrator | `hospital@lifeline.example`  | `DemoLife2026!` |
| NGO administrator      | `admin@lifeline.example`     | `DemoLife2026!` |
| Volunteer organizer    | `volunteer@lifeline.example` | `DemoLife2026!` |

The password above is the development value in `.env.example`. If you changed `SEED_PASSWORD` **before the first seed**, use that value instead. Seed credentials are not read by production authentication. New users verify their email before booking; in development without SMTP, the dashboard offers an explicitly labeled local verification-email link. Password-reset emails are stored privately in `EmailOutbox` when SMTP is absent; configure SMTP for actual delivery.

## Main workflows

1. **Donor:** register in three steps → verify email → search/map hospitals → request preferred visit → hospital confirms an actual date/time → hospital separately records an actual donation. Appointment cancellation, drive registration/cancellation, notifications, independent consent controls, JSON data export, and account-deletion requests are available in the dashboard.
2. **Hospital:** register authorized administrator → submit profile and private verification document → NGO review → manage appointment requests, requirements, drives and sponsored-placement applications. Profile edits and material requirement edits return to review.
3. **NGO administrator:** review private hospital documents, verify requirements, approve drives, manage sponsorship dates/prices/manual payment reconciliation, suspend accounts, review inquiries/applications, edit content, publish consented stories, view aggregate analytics and audit logs.
4. **Volunteer organizer:** view/create drives with a verified hospital partner, await NGO approval, see their own participants, and post status/announcement updates.

No available appointment times are fabricated. No registration or check-in is counted as a donation. Booking age, consent, email verification, ownership, duplicate registrations, capacity, document access and all review permissions are enforced by Express. Urgency is reviewed independently of sponsorship; paid placement is labeled and appears separately from requirements.

Public pages include `/`, `/about`, `/hospitals`, `/hospitals/:id`, `/urgent-requests`, `/drives`, `/drives/:id`, `/campus`, `/volunteer`, `/stories`, `/stories/:id`, `/contact`, `/faq`, `/privacy`, `/terms`, `/accessibility` and a 404 route. Protected areas are `/dashboard`, `/hospital/dashboard` and `/admin`.

## Verification

With the local MongoDB instance running:

```sh
npm test
npm run build
npm run test:e2e
```

- Vitest/React Testing Library: accessible controls, validation and consent/age/date boundaries.
- Supertest: actual Express requests against a newly created `lifeline_test_*` MongoDB database. Includes auth, CSRF, private documents, verification, geospatial queries, cross-account isolation, appointments, donation completion, drive-capacity races, sponsorship authorization, export, reset-token reuse and logout. Only the suite’s isolated database is removed.
- Playwright: desktop and mobile discovery/navigation, public-route smoke checks, donor onboarding/verification/booking/drive registration, and hospital-to-NGO requirement review. Run against the seeded local demo. On macOS the config uses installed Google Chrome; on other platforms run `npx playwright install chromium` first. Browser tests create fictitious demonstration records in the local demo database.
- Screenshots and failure traces are written to ignored `test-results/`; the HTML report is in `playwright-report/`.

## Configuration and integrations

See [.env.example](.env.example) for all configuration keys. Never commit `.env`, uploaded documents, MongoDB runtime files or credentials.

| Integration     | Configuration / behavior                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB         | `MONGODB_URI`; Atlas-compatible schemas and 2dsphere index                                                                                                                            |
| Email           | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`; a private retryable outbox queues messages                                                                           |
| Private files   | Local `.private/uploads/` by default; use a persistent volume or S3-compatible storage                                                                                                |
| S3 / R2 / MinIO | `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT`, credentials; `S3_FORCE_PATH_STYLE=true` for MinIO. Keep the bucket private. File downloads pass through authorized Express handlers |
| Maps            | Leaflet + OpenStreetMap; no API key. Manual city search works without geolocation permission                                                                                          |
| Real time       | Socket.IO authenticates HTTP-only access cookies, assigns user rooms server-side and sends generic listing invalidations; personal notifications only go to the recipient             |
| Sponsorship     | Admin-managed pricing/approval/manual reconciliation. No payment-gateway or card-data processing                                                                                      |

SMTP and S3 adapters are implemented but need your service credentials for external-delivery/storage verification. Optional Google OAuth, SMS/WhatsApp, a payment gateway, QR check-in, waitlists and hospital staff subaccounts are not included.

## Production deployment

For a step-by-step setup using free hosting, see [FREE_DEPLOYMENT.md](FREE_DEPLOYMENT.md). It covers provider limits, private file storage, email configuration, and first-admin creation.

The simplest supported topology is **one HTTPS origin**: Express serves the built React app, `/api`, and `/socket.io`. This keeps HTTP-only cookies, CSRF and Socket.IO behavior consistent. A Dockerfile and `render.yaml` are included.

```sh
npm ci
npm run build
NODE_ENV=production npm start
```

Set `NODE_ENV=production`, `DEMO_MODE=false`, a strong random `JWT_SECRET`, Atlas `MONGODB_URI`, and matching HTTPS `CLIENT_URL` / `PUBLIC_URL`. The process binds to `0.0.0.0:$PORT` in production. Connect SMTP; configure private S3 storage or set `PRIVATE_UPLOAD_DIR` to a persistent mounted directory. A single instance runs the scheduled jobs. Multi-instance deployments need a shared rate-limit store, a distributed job lock/queue and a Socket.IO adapter.

For Vercel frontend + Render/Railway API, proxy `/api` and `/socket.io` through a shared domain, or intentionally configure cross-site cookie and CSRF behavior. Do not simply deploy the frontend with a cross-site API URL and assume cookie sessions will work. No hosted deployment has been created by this local build.

Create a real administrator using `npm run create-admin` with `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` set through the deployment environment. This command cannot promote an existing account. Do not seed production. Production startup refuses a database containing demonstration records. Replace draft NGO/policy content with verified legal identity, genuine contacts, consented stories and approved retention practices before collecting real data. Validate operational/legal donation criteria with the operating healthcare partners.

## Source and design

- [Architecture and API contract](docs/ARCHITECTURE.md)
- [Design, artwork provenance and prompt](docs/DESIGN.md)
- `client/src/components`: reusable accessible controls, cards, layout and map
- `client/src/pages`: public experiences, onboarding and role workspaces
- `server/src/routes`: role-scoped REST resources and auth
- `server/src/models`: MongoDB schemas, references and indexes
- `server/src/services`: notifications, audit, email and storage adapters
- `shared`: schemas shared by browser and server

The brief’s reference `https://www.tatvam2026.in` could not be fetched during development. The design is original and follows the supplied editorial, youth-oriented direction. Impact counters always query database records; a fresh production database displays honest zero/empty states.
