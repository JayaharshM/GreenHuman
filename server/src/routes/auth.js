import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/index.js";
import { registerSchema, loginSchema } from "../../../shared/validation.js";
import {
  auth,
  validate,
  hash,
  token,
  fail,
  setSession,
  clearSession,
  safeUser,
} from "../middleware/security.js";
import { email, audit } from "../services/events.js";
import { config } from "../config.js";
export const authRouter = Router();
const verificationEnabled = (_req, _res, next) => {
  if (!config.requireEmailVerification)
    fail(
      409,
      "Email verification is currently disabled. You can use your account without it.",
    );
  next();
};
authRouter.post("/register", validate(registerSchema), async (req, res) => {
  const data = req.input;
  const verification = config.requireEmailVerification ? token() : null;
  const user = await User.create({
    ...data,
    demo: config.demo,
    passwordHash: await bcrypt.hash(data.password, 12),
    consentRecords: [{ choices: data.consent, at: new Date(), version: "1.0" }],
    ...(verification
      ? {
          emailTokenHash: hash(verification),
          emailTokenExpires: new Date(Date.now() + 86400000),
        }
      : {}),
  });
  let developmentLink;
  if (verification) {
    const link = `${config.client}/verify-email?token=${verification}`;
    const local = await email(
      user,
      "Verify your Lifeline email",
      `Confirm your email: ${link}`,
    );
    if (local && config.env === "development") developmentLink = link;
  }
  await setSession(res, user);
  res.status(201).json({
    data: safeUser(user),
    meta: {
      emailVerificationRequired: config.requireEmailVerification,
      ...(developmentLink ? { developmentLink } : {}),
    },
  });
});
authRouter.post("/login", validate(loginSchema), async (req, res) => {
  const user = await User.findOne({ email: req.input.email }).select(
    "+passwordHash",
  );
  if (
    !user ||
    user.disabled ||
    !(await bcrypt.compare(req.input.password, user.passwordHash))
  )
    fail(401, "Email or password is incorrect.");
  await setSession(res, user);
  res.json({ data: safeUser(user) });
});
authRouter.get("/me", auth, (req, res) =>
  res.json({ data: safeUser(req.user) }),
);
authRouter.post("/logout", async (req, res) => {
  const refresh = req.cookies.refresh;
  if (refresh)
    await User.updateOne(
      { refreshHash: hash(refresh) },
      {
        $unset: { refreshHash: 1, refreshExpires: 1 },
        $inc: { sessionVersion: 1 },
      },
    );
  clearSession(res);
  res.json({ data: { message: "Signed out." } });
});
authRouter.post("/refresh", async (req, res) => {
  const refresh = req.cookies.refresh;
  if (!refresh) fail(401, "Please sign in.");
  const user = await User.findOne({
    refreshHash: hash(refresh),
    refreshExpires: { $gt: new Date() },
    disabled: false,
  }).select("+refreshHash");
  if (!user) fail(401, "Session expired.");
  const claimed = await User.updateOne(
    { _id: user._id, refreshHash: hash(refresh) },
    { $unset: { refreshHash: 1 } },
  );
  if (!claimed.modifiedCount) fail(401, "Session already refreshed.");
  await setSession(res, user);
  res.json({ data: safeUser(user) });
});
authRouter.post(
  "/forgot-password",
  validate(z.object({ email: z.email() })),
  async (req, res) => {
    const user = await User.findOne({ email: req.input.email.toLowerCase() });
    if (user) {
      const reset = token();
      user.resetTokenHash = hash(reset);
      user.resetTokenExpires = new Date(Date.now() + 3600000);
      await user.save();
      await email(
        user,
        "Reset your Lifeline password",
        `${config.client}/reset-password?token=${reset}`,
      );
    }
    res.json({
      data: {
        message:
          "If that email is registered, a reset link has been queued for delivery.",
      },
    });
  },
);
authRouter.post(
  "/reset-password",
  validate(
    z.object({
      token: z.string().length(64),
      password: z.string().min(10).max(128),
    }),
  ),
  async (req, res) => {
    const user = await User.findOneAndUpdate(
      {
        resetTokenHash: hash(req.input.token),
        resetTokenExpires: { $gt: new Date() },
      },
      {
        $set: { passwordHash: await bcrypt.hash(req.input.password, 12) },
        $unset: {
          resetTokenHash: 1,
          resetTokenExpires: 1,
          refreshHash: 1,
          refreshExpires: 1,
        },
        $inc: { sessionVersion: 1 },
      },
      { new: true },
    );
    if (!user) fail(400, "This reset link has expired or was already used.");
    clearSession(res);
    await audit(user, "password.reset", user._id);
    res.json({ data: { message: "Password updated. Please sign in." } });
  },
);
authRouter.post(
  "/verify-email",
  verificationEnabled,
  validate(z.object({ token: z.string().length(64) })),
  async (req, res) => {
    const user = await User.findOneAndUpdate(
      {
        emailTokenHash: hash(req.input.token),
        emailTokenExpires: { $gt: new Date() },
      },
      {
        $set: { isVerified: true },
        $unset: { emailTokenHash: 1, emailTokenExpires: 1 },
      },
      { new: true },
    );
    if (!user)
      fail(400, "This verification link has expired or was already used.");
    res.json({
      data: { message: "Email verified. You’re ready to participate." },
    });
  },
);
authRouter.post(
  "/resend-verification",
  auth,
  verificationEnabled,
  async (req, res) => {
    if (req.user.isVerified) fail(400, "Your email is already verified.");
    const verification = token();
    req.user.emailTokenHash = hash(verification);
    req.user.emailTokenExpires = new Date(Date.now() + 86400000);
    await req.user.save();
    const link = `${config.client}/verify-email?token=${verification}`;
    const local = await email(req.user, "Verify your Lifeline email", link);
    res.json({
      data: { message: "Verification email queued." },
      meta: {
        ...(local && config.env === "development"
          ? { developmentLink: link }
          : {}),
      },
    });
  },
);
