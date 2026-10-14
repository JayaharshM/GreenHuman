import nodemailer from "nodemailer";
import { Notification, EmailOutbox, AuditLog, User } from "../models/index.js";
let io;
export const attachIO = (socketServer) => {
  io = socketServer;
};
export const broadcast = (event, data) => io?.to("public").emit(event, data);
export const audit = (actor, action, resource, details = {}) =>
  AuditLog.create({
    actorId: actor?._id,
    action,
    resourceId: String(resource),
    details,
  });
export async function notify(recipientId, title, message, type = "update") {
  const notification = await Notification.create({
    recipientId,
    title,
    message,
    type,
  });
  io?.to(`user:${recipientId}`).emit("notification", notification);
  return notification;
}
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;
export async function email(user, subject, text) {
  const mail = await EmailOutbox.create({
    recipientId: user._id,
    to: user.email,
    subject,
    text,
    nextAttempt: new Date(),
  });
  if (transport) await sendMail(mail);
  return !transport;
}
async function sendMail(mail) {
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
    mail.status = "sent";
  } catch {
    mail.status = "failed";
    mail.attempts++;
    mail.nextAttempt = new Date(
      Date.now() + Math.min(3600000, 60000 * 2 ** mail.attempts),
    );
  }
  await mail.save();
}
export async function retryEmail() {
  if (!transport) return;
  const mails = await EmailOutbox.find({
    status: { $in: ["pending", "failed"] },
    attempts: { $lt: 5 },
    nextAttempt: { $lte: new Date() },
  })
    .select("+to +text")
    .limit(20);
  for (const mail of mails) await sendMail(mail);
}
export async function optionalAlerts(city, title, message) {
  const users = await User.find({
    city,
    "consent.invitations": true,
    "notificationPreferences.requests": { $ne: false },
    disabled: false,
  })
    .select("_id")
    .limit(500);
  for (const user of users) await notify(user._id, title, message, "request");
}
