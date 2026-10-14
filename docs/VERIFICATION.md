# Verification — 14 October 2026

Executed locally with Node.js 26.3.0, MongoDB Community 7.0.24 and installed Google Chrome.

| Check | Result |
| --- | --- |
| `npm run build` | Passed; React production assets generated |
| `npm test` | 23 tests passed across 3 files |
| `npm run test:e2e` | 8 tests passed across desktop and mobile projects |
| `npm audit --audit-level=moderate` | 0 known vulnerabilities |
| Production HTTP smoke checks | Home, SPA deep link, health API, empty hospital API, robots and sitemap returned 200; unknown API returned 404 |
| Production CSRF cookie | Secure attribute present |
| Production data guard | Refuses databases containing demonstration records |

The database tests exercised actual Express → MongoDB operations, including private documents, hospital/requirement verification, cross-account permissions, appointment confirmation and donation completion, concurrent event-capacity limits, sponsorship authorization, independent consent, export/deletion requests, token reuse and logout.

Browser tests exercised public navigation and map/list discovery, responsive overflow checks, registration, email verification, appointment requests, drive registration/cancellation, consent updates, and hospital-to-NGO requirement review. Public-route checks reported no JavaScript runtime errors.

Previews: [desktop](preview-desktop.png), [mobile](preview-mobile.png). Original artwork and prompt: [design notes](DESIGN.md).

External SMTP delivery, S3-compatible storage and a hosted deployment were not exercised because service credentials and a deployment destination were not supplied. Docker/Render configurations are provided; the production smoke check used the local Node process. Production NGO/legal content and contacts remain editable drafts. The build emits harmless upstream Zod annotation warnings and completes successfully.
