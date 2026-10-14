# Lifeline implementation contract

React/Vite serves public discovery, multi-step donor onboarding, hospital onboarding and protected role dashboards. TanStack Query owns server state; an auth context owns the current user. Express is the only authority for validation, authentication, verification, ownership, booking, capacity and clinical urgency. MongoDB persists all domain records. No frontend fixture responses.

Public navigation: Home → Hospitals / Requests / Drives → detail → sign in → request appointment / register. Campus, volunteering, stories, about, contact, FAQ and policies complete the community experience.

Hospital onboarding → pending hospital → administrator reviews private documents → approved hospital → request submission → administrator verifies medical request → public active listing. Material request edits return it to review. Sponsorship has a separate approval and placement path.

Access JWT: 15 minutes; rotating opaque refresh token: 7 days; both HTTP-only cookies. Double-submit CSRF token and strict allowed origins protect cookie mutations. Password reset and email verification tokens are hashed, single-use and expire. Private document files require ownership or admin access. Socket rooms are assigned server-side from authenticated ownership and never contain public donor data.

Collections: Users, Hospitals (GeoJSON 2dsphere), BloodRequests (expiration), DonationDrives (atomic capacity counters), DriveRegistrations (unique donor+drive), Appointments (active partial unique index), DonationRecords (unique appointment), Notifications, Sponsorships, Applications, Stories, ContentPages, AuditLogs, EmailOutbox. Consent revisions are append-only audit records. All list endpoints are bounded.

Phases: foundation and models → authentication and access → donor/hospital workflows → verified requests and drives → admin/community/content/sponsorship → UI polish, tests, deployment instructions.

Public APIs return `{ data, meta? }`; errors return `{ error: { message, fields? } }`. Auth endpoints cover register/login/logout/refresh/me/forgot-password/reset-password/verify-email. Resources cover hospitals/nearby, blood-requests, drives/registration, appointments, notifications, donor export/deletion, applications, stories, content, and role-scoped dashboard/administration. All timestamps are ISO dates; statuses are lowercase enums. No appointment times are fabricated: users request a preferred visit and hospitals confirm availability.

Demo is explicit: all seeded organizations, people, medical requirements and stories are fictitious and flagged. Production must set DEMO_MODE=false and seed is refused. Public impact counters query records and only hospital-confirmed donation records count as donations.
