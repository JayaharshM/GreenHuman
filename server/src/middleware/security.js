import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { config } from "../config.js";
import { User } from "../models/index.js";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
const cookieOptions = {
  httpOnly: true,
  secure: config.env === "production",
  sameSite: "lax",
  path: "/",
};
export async function setSession(res, user) {
  const refresh = token();
  user.refreshHash = hash(refresh);
  user.refreshExpires = new Date(Date.now() + 7 * 86400000);
  await user.save();
  res.cookie(
    "access",
    jwt.sign(
      { sub: String(user._id), version: user.sessionVersion },
      config.secret,
      { expiresIn: "15m", issuer: "lifeline", audience: "lifeline-web" },
    ),
    { ...cookieOptions, maxAge: 900000 },
  );
  res.cookie("refresh", refresh, { ...cookieOptions, maxAge: 7 * 86400000 });
}
export function clearSession(res) {
  res.clearCookie("access", cookieOptions);
  res.clearCookie("refresh", cookieOptions);
}
export function csrf(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS")
    return next();
  const origin = req.get("origin");
  if (origin && origin !== config.client)
    return next(
      Object.assign(new Error("Origin is not allowed."), { status: 403 }),
    );
  const header = req.get("x-csrf-token"),
    cookie = req.cookies.csrf;
  if (
    !header ||
    !cookie ||
    header.length !== cookie.length ||
    !timingSafeEqual(Buffer.from(header), Buffer.from(cookie))
  )
    return next(
      Object.assign(
        new Error("Your security token expired. Refresh the page."),
        { status: 403 },
      ),
    );
  next();
}
export async function auth(req, res, next) {
  try {
    const decoded = jwt.verify(req.cookies.access || "", config.secret, {
      issuer: "lifeline",
      audience: "lifeline-web",
    });
    const user = await User.findById(decoded.sub);
    if (!user || user.disabled || user.sessionVersion !== decoded.version)
      fail(401, "Please sign in again.");
    req.user = user;
    next();
  } catch {
    next(
      Object.assign(new Error("Please sign in to continue."), { status: 401 }),
    );
  }
}
export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : next(
          Object.assign(
            new Error("This action is not available for your account."),
            { status: 403 },
          ),
        );
export const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(422).json({
      error: {
        message: parsed.error.issues[0].message,
        fields: parsed.error.flatten().fieldErrors,
      },
    });
  req.input = parsed.data;
  next();
};
export const safeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  city: user.city,
  state: user.state,
  pincode: user.pincode,
  dateOfBirth: user.dateOfBirth,
  bloodGroup: user.bloodGroup,
  college: user.college,
  isVerified: user.isVerified,
  consent: user.consent,
  notificationPreferences: user.notificationPreferences,
  deletionRequestedAt: user.deletionRequestedAt,
});
