import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { csrf, token } from "./middleware/security.js";
import { authRouter } from "./routes/auth.js";
import { platform } from "./routes/platform.js";
import { Hospital, Drive, Story } from "./models/index.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.env === "production") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org"],
          connectSrc: ["'self'", "wss:", "ws:"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.env === "production" ? [] : null,
        },
      },
    }),
  );
  app.use(cors({ origin: config.client, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.get("/robots.txt", (_req, res) =>
    res
      .type("text/plain")
      .send(
        `User-agent: *\nDisallow: /api/\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /hospital/dashboard\nDisallow: /reset-password\nDisallow: /verify-email\nSitemap: ${config.publicUrl}/sitemap.xml\n`,
      ),
  );
  app.get("/sitemap.xml", async (_req, res) => {
    const [hospitals, drives, stories] = await Promise.all([
      Hospital.find({ verificationStatus: "verified" })
        .select("_id")
        .limit(5000),
      Drive.find({ status: { $in: ["upcoming", "live", "completed"] } })
        .select("_id")
        .limit(5000),
      Story.find({
        published: true,
        $or: [{ consentConfirmed: true }, { demo: true }],
      })
        .select("_id")
        .limit(5000),
    ]);
    const paths = [
      "/",
      "/about",
      "/hospitals",
      "/urgent-requests",
      "/drives",
      "/campus",
      "/volunteer",
      "/stories",
      "/contact",
      "/faq",
      "/privacy",
      "/terms",
      ...hospitals.map((h) => `/hospitals/${h._id}`),
      ...drives.map((d) => `/drives/${d._id}`),
      ...stories.map((s) => `/stories/${s._id}`),
    ];
    const escape = (s) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll('"', "&quot;");
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${escape(config.publicUrl + p)}</loc></url>`).join("")}</urlset>`,
      );
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_req, res) => res.json({ data: { status: "ok" } }));
  app.get("/api/csrf", (req, res) => {
    const value = /^[a-f\d]{64}$/.test(req.cookies.csrf || "")
      ? req.cookies.csrf
      : token();
    res.cookie("csrf", value, {
      httpOnly: false,
      sameSite: "lax",
      secure: config.env === "production",
      path: "/api",
    });
    res.json({
      data: {
        token: value,
        demo: config.demo,
        minDonationAge: config.minAge,
        emailVerificationRequired: config.requireEmailVerification,
      },
    });
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: config.env === "test" ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) =>
      req.method === "GET" || (req.path === "/refresh" && !req.cookies.refresh),
    handler: (_req, res) =>
      res.status(429).json({
        error: {
          message: "Too many sign-in attempts. Please try again in 15 minutes.",
        },
      }),
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit:
        config.env === "production"
          ? 300
          : config.env === "test"
            ? 10000
            : 1000,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          error: {
            message: "Too many requests. Please try again in a minute.",
          },
        }),
    }),
  );
  app.use("/api", csrf);
  app.use("/api/auth", authLimit, authRouter);
  app.use("/api/contact", rateLimit({ windowMs: 3600000, limit: 10 }));
  app.use("/api/applications", rateLimit({ windowMs: 3600000, limit: 10 }));
  app.use("/api", platform);
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: { message: "API route not found." } }),
  );
  if (config.env === "production") {
    const folder = new URL("../../client/dist/", import.meta.url).pathname;
    app.use(express.static(folder));
    app.get("/{*path}", (_req, res) => res.sendFile(`${folder}index.html`));
  }
  app.use((error, _req, res, _next) => {
    let status = error.status || 500;
    let message = error.message;
    if (error.code === 11000) {
      status = 409;
      message = "This account or registration already exists.";
    }
    if (error.name === "ZodError") {
      status = 422;
      message = error.issues[0]?.message || "Check the submitted details.";
    }
    if (error.name === "CastError") {
      status = 404;
      message = "Record not found.";
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      status = 413;
      message = "Files must be under 5 MB.";
    }
    if (status === 500) {
      console.error("Request failed:", error.name, error.code || "");
      message = "Something went wrong. Please try again.";
    }
    res.status(status).json({ error: { message } });
  });
  return app;
}
