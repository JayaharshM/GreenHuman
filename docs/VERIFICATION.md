# Verification — 14 October 2026

Executed locally with Node.js 26.3.0, MongoDB Community 7.0.24 and installed Google Chrome.

| Check                              | Result                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run build`                    | Passed; React production assets generated                                                                      |
| `npm test`                         | 26 tests passed across 3 files                                                                                 |
| `npm run test:e2e`                 | 8 tests passed across desktop and mobile projects                                                              |
| MongoDB Atlas connection           | Connected and pinged the `lifeline` database using the ignored `.env`; no demo seed or tests ran against Atlas |
| `npm audit --audit-level=moderate` | 0 known vulnerabilities                                                                                        |
| Production HTTP smoke checks       | Home, SPA deep link, health API, empty hospital API, robots and sitemap returned 200; unknown API returned 404 |
| Production CSRF cookie             | Secure attribute present                                                                                       |
| Production data guard              | Refuses databases containing demonstration records                                                             |

The database tests exercised actual Express → MongoDB operations, including private documents, hospital/requirement verification, cross-account permissions, appointment confirmation and donation completion, concurrent event-capacity limits, sponsorship authorization, independent consent, export/deletion requests, token reuse and logout. They also verify that registration generates no verification email/token when email verification is disabled, existing unverified donors can book and join drives, and single-use email verification still works when explicitly enabled.

Browser tests exercised public navigation and map/list discovery, responsive overflow checks, registration and booking without email verification, legacy verification links, drive registration/cancellation, consent updates, and hospital-to-NGO requirement review. Public-route checks reported no JavaScript runtime errors. The suite used its own servers on ports `4002`/`5174` and a temporary local `lifeline_test_e2e_*` database, which it removed afterward.

Previews: [desktop](preview-desktop.png), [mobile](preview-mobile.png). Original artwork and prompt: [design notes](DESIGN.md).

External SMTP delivery, S3-compatible storage and a hosted deployment were not exercised because service credentials and a deployment destination were not supplied. Docker/Render configurations are provided; the production smoke check used the local Node process. Production NGO/legal content and contacts remain editable drafts. The build emits harmless upstream Zod annotation warnings and completes successfully.
