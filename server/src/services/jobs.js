import {
  BloodRequest,
  Drive,
  DriveRegistration,
  User,
} from "../models/index.js";
import { retryEmail, broadcast, notify, email } from "./events.js";
export async function runJobs() {
  const now = new Date();
  const expired = await BloodRequest.updateMany(
    { status: { $in: ["pending", "active"] }, expiresAt: { $lte: now } },
    { status: "expired" },
  );
  const ended = await Drive.updateMany(
    { status: { $in: ["upcoming", "live"] }, endDate: { $lte: now } },
    { status: "completed" },
  );
  if (expired.modifiedCount || ended.modifiedCount)
    broadcast("refresh", { resource: "listings" });
  const drives = await Drive.find({
    status: "upcoming",
    startDate: { $gt: now, $lte: new Date(now.getTime() + 86400000) },
  }).limit(100);
  for (const drive of drives) {
    const registrations = await DriveRegistration.find({
      driveId: drive._id,
      reminderSentAt: { $exists: false },
    }).limit(500);
    for (const registration of registrations) {
      const user = await User.findOne({
        _id: registration.donorId,
        disabled: false,
      });
      if (!user) continue;
      const claimed = await DriveRegistration.updateOne(
        { _id: registration._id, reminderSentAt: { $exists: false } },
        { $set: { reminderSentAt: now } },
      );
      if (!claimed.modifiedCount) continue;
      await notify(
        user._id,
        "A little reminder for tomorrow",
        `${drive.title} starts ${drive.startDate.toISOString()} at ${drive.venue}. On-site screening is required.`,
        "drive",
      );
      await email(
        user,
        "Your upcoming donation drive",
        `${drive.title} at ${drive.venue}. Check the event page for current details. Participation is voluntary; registration is not medical clearance.`,
      );
    }
  }
  await retryEmail();
}
