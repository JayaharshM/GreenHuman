# Deploy Lifeline using free hosting

Provider information checked on **14 October 2026**. This guide is specific to the code in this repository.

The recommended setup is **Render Free + MongoDB Atlas Free + Supabase Storage Free + Brevo Free**. Keep the React frontend and Express backend together on Render. This preserves the app’s existing cookie authentication, CSRF protection, private file routes, and Socket.IO connection without changing application code.

Hosting, database, and file storage can cost $0 while you remain within their allowances. Email also needs an approved sender; a domain you own may add a cost if you do not already have one. Free services can sleep or pause, so this is suitable for a college project, demonstration, or small pilot rather than dependable, round-the-clock donation coordination.

## 1. What runs where

```mermaid
flowchart LR
    Browser[Browser] -->|HTTPS: pages, API, Socket.IO| Render[Render: React build + Express]
    Render --> Atlas[MongoDB Atlas: application records]
    Render --> Storage[Supabase S3: private files]
    Render --> Email[Brevo SMTP: verification and reset emails]
```

| Part                                        | Free option                            | What to expect                                                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend, API, Socket.IO                    | One Render Free **Web Service**        | Shared allowance of 750 free instance hours/month per workspace; sleeps after 15 idle minutes; a cold start can take about a minute. [Render free-service limits](https://render.com/docs/free).                      |
| MongoDB                                     | Atlas **Free / M0** cluster            | 0.5 GB including documents and indexes; no managed backups; idle clusters can pause after 30 days without connections. [Atlas limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).         |
| Hospital images and private documents       | Supabase **Free** Storage              | 1 GB file storage; 5 GB uncached and 5 GB cached egress allowances; projects can pause after one inactive week. Only Storage is used; MongoDB remains the database. [Supabase pricing](https://supabase.com/pricing). |
| Verification, reset, and confirmation email | Brevo **Free**                         | 300 email sends/day, subject to account activation and sender requirements. [Brevo free-plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).                   |
| Website URL                                 | Render-provided `onrender.com` address | A custom website domain is optional. [Render deployment guide](https://render.com/docs/deploy-node-express-app).                                                                                                      |

## 2. Prepare the repository

From the project root, check the frontend build:

```sh
npm ci
npm run build
```

Push the source to a GitHub repository you can connect to Render. Include the root `package-lock.json`, both workspace package files, `client/`, `server/`, and `shared/`.

The existing `.gitignore` excludes `.env`, `node_modules/`, `.data/`, `.private/`, and generated builds. Check your staged files before pushing so that credentials, local MongoDB records, and uploaded documents are excluded. `.env.example` contains configuration examples and can be committed.

Use a **new, empty production database**. The server deliberately refuses production startup when it finds demonstration records. Do not run `npm run seed` against the production database or copy the local demo database into it.

## 3. Create MongoDB Atlas Free

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a project and select the **Free / M0** cluster option. Do not select a paid cluster or an optional paid add-on.
3. Choose an available region near your eventual Render service.
4. Create a database user with a strong password and `readWrite` access to a database named `lifeline_production`. This is a database credential, separate from your Atlas website login and your Lifeline admin login.
5. Use **Connect → Drivers → Node.js** to obtain the connection string. Put the application database name before the query string:

```text
mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/lifeline_production?retryWrites=true&w=majority
```

Replace the placeholders. Percent-encode special characters in the username/password as required by a connection URI. Keep the resulting string private.

Official walkthrough: [Create an Atlas Free cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

### Allow connections from Render

After creating the Render service in step 6, open its **Connect → Outbound** tab. Copy **all** the displayed outbound IP/CIDR ranges into Atlas **Network Access / IP Access List**. Render can use any address within those ranges. [Render outbound addresses](https://render.com/docs/outbound-ip-addresses).

Temporarily allow your computer’s current public IP as well when creating the first administrator in step 8. Atlas supports temporary entries. Restrict the list to these required addresses instead of opening it to the whole internet. [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

## 4. Create persistent private file storage

Use Supabase Storage’s S3 interface, which matches the existing adapter in `server/src/services/storage.js`. Supabase supports the `PutObject` and `GetObject` operations this application uses. [S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility).

1. Create a Supabase project on the **Free** plan.
2. In **Storage**, create a bucket named `lifeline-files` with **public access disabled**.
3. Open the project’s Storage S3 configuration and generate an S3 access-key pair.
4. Copy the **endpoint**, **region**, **Access Key ID**, and **Secret Access Key** displayed there.
5. Add the following environment variables to Render in step 7:

```dotenv
S3_BUCKET=lifeline-files
S3_ENDPOINT=https://YOUR_PROJECT_REF.storage.supabase.co/storage/v1/s3
S3_REGION=YOUR_PROJECT_REGION
S3_ACCESS_KEY_ID=YOUR_GENERATED_S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY=YOUR_GENERATED_S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE=true
```

Use the exact endpoint and region from your dashboard. The access keys belong only on the backend; Supabase’s generated S3 keys bypass Storage RLS. Do not use an anonymous frontend key in these fields. [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).

The browser uploads through Express, so a public bucket or browser-facing S3 credentials are unnecessary. The application continues enforcing document ownership before serving private verification files.

Leaving `S3_BUCKET` empty switches the app to local files. Those files are lost when a free Render service restarts, redeploys, or sleeps. External storage is therefore necessary for persistent hospital documents and images. [Render filesystem limitations](https://render.com/docs/free).

### Alternative: Cloudflare R2

If you already use Cloudflare, its Standard-storage allowance includes 10 GB-month, one million Class A operations, and ten million Class B operations monthly. Usage beyond the allowance is billable; setup involves an R2 subscription checkout. [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 setup](https://developers.cloudflare.com/r2/get-started/).

Create a private bucket and a bucket-scoped read/write S3 token, then replace the Supabase values with the bucket’s R2 credentials and endpoint. Use `S3_REGION=auto`; keep the bucket private. The recommended Supabase path avoids relying on R2’s usage-based billing for this small deployment.

## 5. Configure email before testing donor registration

New donors must verify their email before booking. In production, the app does not show the local development verification link. A deployment without working email will therefore leave new donors unable to complete booking onboarding.

Render Free blocks outbound SMTP ports **25, 465, and 587**. The repository’s example port, `587`, needs to be changed for this deployment. [Render SMTP restrictions](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports).

Brevo supports **2525**, so use that alternative:

1. Create a Brevo Free account and complete its required account/transactional-sending activation.
2. Add and verify your sender address. For dependable delivery, authenticate a domain you control using the records Brevo supplies.
3. Under **SMTP & API**, copy the SMTP login and generate an **SMTP key**.
4. Add these values to Render:

```dotenv
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=2525
SMTP_USER=YOUR_BREVO_SMTP_LOGIN
SMTP_PASS=YOUR_BREVO_SMTP_KEY
MAIL_FROM=Lifeline <YOUR_VERIFIED_SENDER_ADDRESS>
```

The SMTP login is not the relay hostname; the SMTP key is not your Brevo account password or HTTP API key. The existing Nodemailer configuration uses STARTTLS when available on this non-465 port. [Brevo SMTP setup and troubleshooting](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP).

**Compatibility inference:** Render’s documented blocked-port list excludes 2525, and Brevo documents support for it. Test an actual verification email from the deployed app; this guide does not claim a tested hosted connection or guarantee a provider will approve your account.

**If you do not own a sender domain:** a free website address does not give you control of its email DNS. Free Gmail/Yahoo domains cannot be authenticated in Brevo. Do not assume that verifying a personal mailbox guarantees delivery to donors; obtaining an authenticated sender domain may be the part that costs money. [Brevo sender requirements](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [domain setup](https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability).

If SMTP 2525 is unavailable, switching email delivery to an HTTPS API requires an application change in `server/src/services/events.js`; it is not supported merely by adding an API key to the current SMTP configuration.

## 6. Create one free Render web service

In Render, choose **New → Web Service**, connect your repository, and use these settings:

| Setting            | Value                                   |
| ------------------ | --------------------------------------- |
| Language / runtime | Node                                    |
| Root Directory     | Leave empty: use the repository root    |
| Build Command      | `npm ci --include=dev && npm run build` |
| Start Command      | `npm start`                             |
| Instance Type      | **Free**                                |
| Health Check Path  | `/api/health`                           |

The build explicitly installs development dependencies because Vite and its build plugins are development dependencies. `NODE_ENV=production` should not cause them to be omitted during the build.

Copy the HTTPS URL Render assigns, for example `https://YOUR_SERVICE.onrender.com`. Use that actual URL in the next step. A first deployment may fail until you finish the environment variables and Atlas allowlist; save those settings and deploy again afterward. [Render Express deployment](https://render.com/docs/deploy-node-express-app).

### If you prefer the existing Dockerfile

Choose Docker as the Render runtime, use the repository root as the build context, and select `./Dockerfile`. Still choose the **Free** instance and provide the same runtime environment variables below. The Dockerfile builds React and starts Express; native build/start commands are unnecessary in Docker mode. Do not build credentials into the image.

### If you use the existing `render.yaml`

The checked-in Blueprint currently does **not** explicitly select a free instance. Before using it, set the service’s `plan: free`, change `buildCommand` to `npm ci --include=dev && npm run build`, and add the SMTP/S3 settings described here. The manual dashboard path above makes the instance choice explicit. This guide does not modify your deployment configuration automatically.

## 7. Set the production environment variables

Add these in Render’s **Environment** settings. Replace every placeholder; values in the dashboard do not need surrounding shell quotes.

| Variable                                                        | Value / instruction                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`                                                      | `production`                                                          |
| `NODE_VERSION`                                                  | `22` for the native Node runtime; the Dockerfile already uses Node 22 |
| `DEMO_MODE`                                                     | `false`                                                               |
| `HOST`                                                          | `0.0.0.0`                                                             |
| `CLIENT_URL`                                                    | Your exact HTTPS Render URL, with no trailing slash                   |
| `PUBLIC_URL`                                                    | The same HTTPS URL, with no trailing slash                            |
| `MONGODB_URI`                                                   | Your Atlas URI using the empty `lifeline_production` database         |
| `JWT_SECRET`                                                    | A new random secret, at least 32 characters                           |
| `MIN_DONATION_AGE`                                              | `18`, or the reviewed minimum applicable to your operating setting    |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`                         | Values from step 4                                                    |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                      | Private S3 credentials from step 4                                    |
| `S3_FORCE_PATH_STYLE`                                           | `true` for the recommended Supabase setup                             |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Values from step 5                                                    |

Render supports `NODE_VERSION` to control the native runtime. [Node version configuration](https://render.com/docs/node-version).

Generate a JWT secret locally and paste its output only into the private environment setting:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Let Render supply `PORT`. Do not copy the local `PORT=4000`, `HOST=127.0.0.1`, or localhost URLs into the hosted settings. Leave `VITE_API_URL` and `VITE_SOCKET_URL` unset for this single-origin deployment. The frontend will use `/api` and the current site origin automatically.

After saving the variables and Atlas IP entries, deploy. Confirm the logs show the API started and the service becomes available.

## 8. Create the first NGO administrator from your computer

Use the existing `npm run create-admin` command locally against Atlas. Render Free does not provide a dashboard shell or one-off jobs. [Render free-service limitations](https://render.com/docs/free).

First add your current public IP temporarily to Atlas’s allowlist. Run `npm run setup` locally if you do not yet have a local `.env` with a generated secret. The following **zsh** example prompts for private values rather than placing them in command history; it does not overwrite your development `.env`:

```zsh
(
  read -rs 'MONGODB_URI?Production Atlas URI (hidden input): '
  printf '\n'
  read -r 'CLIENT_URL?Public HTTPS site URL: '
  read -r 'ADMIN_EMAIL?Administrator email: '
  read -r 'ADMIN_NAME?Administrator name: '
  read -rs 'ADMIN_PASSWORD?Administrator password (16+ characters): '
  printf '\n'

  export MONGODB_URI CLIENT_URL ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
  export NODE_ENV=production DEMO_MODE=false
  npm run create-admin
)
```

The helper hashes the password, creates an email-verified admin, and refuses to overwrite or promote an existing account. Its session-secret requirement is satisfied by the local `.env`; this command does not issue login cookies, so the local and hosted JWT secrets do not need to match for admin creation.

Remove the temporary Atlas IP entry afterward. Sign into the deployed `/login` page with the new administrator account. The demo credentials from `README.md` do not exist in this fresh database.

## 9. Check the deployed workflows

| Check                                              | Expected result                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Open `/` and refresh `/hospitals` directly         | Both load the React application                                                       |
| Open `/api/health`                                 | JSON containing `data.status: "ok"`; also check real database-backed pages            |
| Start with the empty database                      | Honest zero counts and empty listings                                                 |
| Register a donor                                   | Verification email arrives with the public HTTPS URL                                  |
| Verify email, then request a visit                 | Email verification is recognized; booking waits for hospital confirmation             |
| Submit a hospital profile and document             | NGO administrator can privately download and review the file                          |
| Approve a hospital and a requirement               | Only approved records appear publicly                                                 |
| Register/cancel a drive                            | Capacity and dashboard records change correctly                                       |
| Confirm an appointment in a second browser session | Donor sees the updated status; authenticated real-time updates work while connected   |
| Redeploy, then download an uploaded document       | File remains available through the authorized route because it is in external storage |
| Request a password reset                           | Reset email arrives and its link points to the deployed site                          |

Use separate browser profiles for donor, hospital, and admin testing so their cookies do not overwrite one another. Replace the draft NGO and policy content before inviting real participants.

## 10. Limits that affect this particular application

Free hosting does not provide continuous availability. While the service is asleep, this app’s in-process reminder, expiration-update, and email-retry jobs do not execute. Public requirement queries still exclude expired requests by timestamp after the server wakes, but scheduled notifications can be delayed. This follows from the current `server/src/services/jobs.js` / `server.js` implementation and Render’s sleeping behavior.

Socket.IO runs on the same HTTP server; Render supports WebSockets. Connections can still disconnect on deploys and restarts. This app also ends each authenticated socket connection after 15 minutes, and public queries poll periodically; do not assume a permanently connected stream. [Render WebSockets](https://render.com/docs/websocket).

Keep provider plans at Free and review usage. Render can suspend services or builds when allowances are exhausted without a payment method; with billing enabled, some usage can incur charges. Supabase can pause an inactive project, and Atlas needs a separate backup process. The allowances above are a small-deployment budget, not a promise of unlimited free capacity.

## Troubleshooting

| Problem                                             | What to check                                                                                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite: not found` during build                      | Use `npm ci --include=dev && npm run build` from the repository root                                                                                              |
| Connection timeout / `MongooseServerSelectionError` | Atlas URI, database password encoding, all Render outbound CIDRs, and whether Atlas is paused                                                                     |
| Production refuses demonstration records            | Use a fresh database; do not disable the guard or use the seeded local database                                                                                   |
| Login or form actions return 403                    | `CLIENT_URL` must match the browser’s exact HTTPS origin, with no trailing slash; keep frontend/API together                                                      |
| Pages load but new donors cannot book               | Complete email verification and booking-communication consent; inspect email delivery status                                                                      |
| Email times out                                     | Use `SMTP_PORT=2525`, not the example’s 587; confirm Brevo activation, SMTP login/key, and approved sender                                                        |
| Email is marked sent but never arrives              | Inspect Brevo transactional logs, sender authentication, recipient spam folder, and send quota; application `EmailOutbox` records distinguish pending/failed/sent |
| Uploads fail                                        | Correct S3 endpoint, region, generated S3 keys, `S3_FORCE_PATH_STYLE=true`, active Supabase project, and available quota; test a genuine PDF/PNG/JPEG under 5 MB  |
| Files disappear after a deploy                      | `S3_BUCKET` was missing and uploads used ephemeral local storage                                                                                                  |
| A deep-link page returns 404                        | Use the root Express web service with `NODE_ENV=production`; deploy the generated `client/dist` via this server                                                   |
| Website is slow on the first visit                  | Allow the free service to wake before testing; this is separate from database or authentication errors                                                            |

## Updating the application

Push changes to the repository branch linked to Render and let the service rebuild. Database records remain in Atlas and files remain in Storage. Keep the same JWT secret unless intentionally rotating it, because changing it invalidates existing sessions.

If you later add a custom domain, update **both** `CLIENT_URL` and `PUBLIC_URL`, redeploy, and test login and newly generated email links on that domain. Existing emails retain the URL they were created with.

This document describes the deployment procedure; no cloud accounts, paid subscriptions, credentials, or hosted resources were created while writing it.
