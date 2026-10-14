# Verification — 14 October 2026

Executed locally with Node.js 26.3.0, MongoDB Community 7.0.24 and installed Google Chrome.

A follow-up check using Node.js 22.23.3 passed the production build and all 30 regression tests, including credential redaction, Render-only IP lookup, authentication error codes and IP-service failure handling for startup diagnostics. A read-only Atlas connection/ping to `lifeline` also succeeded under Node 22. Deployment configuration now selects Node 22 to match the current MongoDB driver and Dockerfile. These checks ran locally; hosted HTTP checks are described below.

A later live HTTP check confirmed that Render's API was healthy, but `/` returned `Cannot GET /`, its CSRF cookie lacked Secure, and its client/public origins did not match the deployed site. The Render settings were corrected by the user. Application configuration now selects production mode automatically on Render. Local checks with `RENDER=true`, `NODE_ENV=development` and both loopback HOST values served the actual React homepage, JavaScript bundle and `/hospitals` deep link with HTTP 200, set Secure cookies, and kept unknown API routes as JSON 404s. Each check used its own temporary local database and removed it afterward.

| Check                              | Result                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                    | Passed; React production assets generated                                                                                                                      |
| `npm test`                         | 30 tests passed across 4 files                                                                                                                                 |
| `npm run test:e2e`                 | 8 tests passed across desktop and mobile projects                                                                                                              |
| MongoDB Atlas connection           | Connected and pinged the `lifeline` database using the ignored `.env`; no demo seed or tests ran against Atlas                                                 |
| `npm audit --audit-level=moderate` | 0 known vulnerabilities                                                                                                                                        |
| Production HTTP smoke checks       | Home, SPA deep link, health API, empty hospital API, robots and sitemap returned 200; unknown API returned 404                                                 |
| Production CSRF cookie             | Secure attribute present                                                                                                                                       |
| Production data guard              | Refuses databases containing demonstration records                                                                                                             |
| Render host/port smoke checks      | Actual Node 22 production servers bound to `0.0.0.0` and honored `PORT` with both `HOST=localhost` and `HOST=127.0.0.1`; health and hospital APIs returned 200 |

The database tests exercised actual Express → MongoDB operations, including private documents, hospital/requirement verification, cross-account permissions, appointment confirmation and donation completion, concurrent event-capacity limits, sponsorship authorization, independent consent, export/deletion requests, token reuse and logout. They also verify that registration generates no verification email/token when email verification is disabled, existing unverified donors can book and join drives, and single-use email verification still works when explicitly enabled.

Browser tests exercised public navigation and map/list discovery, responsive overflow checks, registration and booking without email verification, legacy verification links, drive registration/cancellation, consent updates, and hospital-to-NGO requirement review. Public-route checks reported no JavaScript runtime errors. The suite used its own servers on ports `4002`/`5174` and a temporary local `lifeline_test_e2e_*` database, which it removed afterward.

Previews: [desktop](preview-desktop.png), [mobile](preview-mobile.png). Original artwork and prompt: [design notes](DESIGN.md).

External SMTP delivery and S3-compatible uploads have not been exercised. Docker/Render configurations are provided; the production smoke checks used local Node processes. Live Render checks covered public HTTP responses without creating users or demonstration data. Production NGO/legal content and contacts remain editable drafts. The build emits harmless upstream Zod annotation warnings and completes successfully.
