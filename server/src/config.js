import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
dotenv.config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});
const environment =
  process.env.RENDER === "true"
    ? "production"
    : process.env.NODE_ENV || "development";
export const config = {
  env: environment,
  port: Number(process.env.PORT || 4000),
  host:
    process.env.RENDER === "true"
      ? "0.0.0.0"
      : process.env.HOST ||
        (environment === "production" ? "0.0.0.0" : "127.0.0.1"),
  mongo: process.env.MONGODB_URI,
  secret: process.env.JWT_SECRET,
  client: process.env.CLIENT_URL || "http://127.0.0.1:5173",
  demo: process.env.DEMO_MODE === "true",
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  minAge: Number(process.env.MIN_DONATION_AGE || 18),
  uploads: path.resolve(
    fileURLToPath(new URL("../../", import.meta.url)),
    process.env.PRIVATE_UPLOAD_DIR || ".private/uploads",
  ),
  publicUrl: process.env.PUBLIC_URL || "http://127.0.0.1:4000",
};
export function assertConfig() {
  if (!config.mongo || !config.secret || config.secret.length < 32)
    throw new Error(
      "Set MONGODB_URI and a random JWT_SECRET of at least 32 characters. Run npm run setup for local development.",
    );
  if (
    config.env === "production" &&
    (config.demo || !config.client.startsWith("https://"))
  )
    throw new Error(
      "Production requires HTTPS CLIENT_URL and DEMO_MODE=false.",
    );
  if (
    config.env === "production" &&
    config.requireEmailVerification &&
    !process.env.SMTP_HOST
  )
    throw new Error(
      "Configure SMTP before enabling REQUIRE_EMAIL_VERIFICATION, or set it to false.",
    );
}
