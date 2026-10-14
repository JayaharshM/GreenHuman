import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const base = { timestamps: true };
const point = {
  type: { type: String, enum: ["Point"], default: "Point" },
  coordinates: { type: [Number], required: true },
};
const consent = {
  processing: Boolean,
  booking: Boolean,
  invitations: Boolean,
  promotions: Boolean,
};
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: String,
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ["donor", "hospital", "admin", "volunteer"],
      default: "donor",
    },
    dateOfBirth: Date,
    bloodGroup: String,
    city: String,
    state: String,
    pincode: String,
    college: String,
    previousDonation: Boolean,
    lastDonationDate: Date,
    isVerified: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    consent,
    consentRecords: [{ choices: consent, at: Date, version: String }],
    notificationPreferences: {
      cities: [String],
      radius: Number,
      bloodGroups: [String],
      drives: Boolean,
      requests: Boolean,
      announcements: Boolean,
    },
    refreshHash: { type: String, select: false },
    refreshExpires: Date,
    sessionVersion: { type: Number, default: 0 },
    emailTokenHash: { type: String, select: false },
    emailTokenExpires: Date,
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: Date,
    deletionRequestedAt: Date,
    demo: { type: Boolean, default: false },
  },
  base,
);
userSchema.index({ createdAt: -1 });
export const User = model("User", userSchema);
const hospitalSchema = new Schema(
  {
    ownerId: ref("User"),
    name: { type: String, required: true },
    category: String,
    registrationNumber: String,
    description: String,
    address: String,
    city: { type: String, index: true },
    state: String,
    pincode: String,
    location: point,
    contactEmail: String,
    contactPhone: String,
    website: String,
    images: [String],
    logo: String,
    verificationDocuments: [
      { name: String, file: String, mime: String, size: Number },
    ],
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "suspended"],
      default: "pending",
      index: true,
    },
    verifiedAt: Date,
    verifiedBy: ref("User", false),
    reviewNote: String,
    facilities: [String],
    donationHours: String,
    acceptingDonors: Boolean,
    demo: Boolean,
  },
  base,
);
hospitalSchema.index({ location: "2dsphere" });
export const Hospital = model("Hospital", hospitalSchema);
const requestSchema = new Schema(
  {
    hospitalId: ref("Hospital"),
    bloodGroup: String,
    unitsRequired: Number,
    urgency: { type: String, enum: ["critical", "high", "routine"] },
    description: String,
    instructions: String,
    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "fulfilled",
        "expired",
        "cancelled",
        "rejected",
      ],
      default: "pending",
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verifiedBy: ref("User", false),
    expiresAt: Date,
    demo: Boolean,
  },
  base,
);
requestSchema.index({ status: 1, verificationStatus: 1, expiresAt: 1 });
export const BloodRequest = model("BloodRequest", requestSchema);
export const Drive = model(
  "DonationDrive",
  new Schema(
    {
      title: String,
      description: String,
      organizerId: ref("User"),
      hospitalId: ref("Hospital"),
      venue: String,
      city: String,
      location: point,
      startDate: Date,
      endDate: Date,
      registrationDeadline: Date,
      capacity: Number,
      registeredCount: { type: Number, default: 0 },
      status: {
        type: String,
        enum: [
          "pending",
          "upcoming",
          "live",
          "completed",
          "cancelled",
          "rejected",
        ],
        default: "pending",
      },
      announcement: String,
      theme: String,
      bannerImage: String,
      demo: Boolean,
    },
    base,
  ),
);
const registrationSchema = new Schema(
  {
    driveId: ref("DonationDrive"),
    donorId: ref("User"),
    status: {
      type: String,
      enum: ["registered", "checked_in"],
      default: "registered",
    },
    checkInAt: Date,
    reminderSentAt: Date,
  },
  base,
);
registrationSchema.index({ driveId: 1, donorId: 1 }, { unique: true });
export const DriveRegistration = model("DriveRegistration", registrationSchema);
const appointmentSchema = new Schema(
  {
    donorId: ref("User"),
    hospitalId: ref("Hospital"),
    bloodRequestId: ref("BloodRequest", false),
    preferredDate: Date,
    scheduledDate: Date,
    scheduledTime: String,
    note: String,
    status: {
      type: String,
      enum: ["requested", "confirmed", "completed", "cancelled", "rejected"],
      default: "requested",
    },
  },
  base,
);
appointmentSchema.index(
  { donorId: 1, hospitalId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["requested", "confirmed"] } },
  },
);
export const Appointment = model("DonationAppointment", appointmentSchema);
export const DonationRecord = model(
  "DonationRecord",
  new Schema(
    {
      donorId: ref("User"),
      hospitalId: ref("Hospital"),
      appointmentId: { ...ref("DonationAppointment"), unique: true },
      donationDate: Date,
      confirmationStatus: { type: String, default: "confirmed" },
      confirmedBy: ref("User"),
      demo: Boolean,
    },
    base,
  ),
);
export const Notification = model(
  "Notification",
  new Schema(
    {
      recipientId: { ...ref("User"), index: true },
      type: String,
      title: String,
      message: String,
      read: { type: Boolean, default: false },
    },
    base,
  ),
);
export const Sponsorship = model(
  "Sponsorship",
  new Schema(
    {
      hospitalId: ref("Hospital"),
      campaignType: {
        type: String,
        enum: ["featured_hospital", "awareness_campaign", "promoted_drive"],
      },
      title: String,
      description: String,
      startDate: Date,
      endDate: Date,
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "completed"],
        default: "pending",
      },
      paymentStatus: {
        type: String,
        enum: ["unpaid", "paid"],
        default: "unpaid",
      },
      price: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      demo: Boolean,
    },
    base,
  ),
);
export const Application = model(
  "Application",
  new Schema(
    {
      type: {
        type: String,
        enum: ["volunteer", "campus", "contact", "deletion"],
      },
      name: String,
      email: String,
      phone: String,
      city: String,
      institution: String,
      participants: Number,
      preferredDates: String,
      interests: [String],
      subject: String,
      message: String,
      status: {
        type: String,
        enum: ["new", "reviewed", "closed"],
        default: "new",
      },
      userId: ref("User", false),
      demo: Boolean,
    },
    base,
  ),
);
export const Story = model(
  "Story",
  new Schema(
    {
      title: String,
      excerpt: String,
      body: String,
      category: String,
      author: String,
      published: { type: Boolean, default: false },
      consentConfirmed: { type: Boolean, default: false },
      demo: Boolean,
    },
    base,
  ),
);
export const ContentPage = model(
  "ContentPage",
  new Schema(
    { key: { type: String, unique: true }, title: String, body: String },
    base,
  ),
);
export const AuditLog = model(
  "AuditLog",
  new Schema(
    {
      actorId: ref("User", false),
      action: String,
      resourceId: String,
      details: Schema.Types.Mixed,
    },
    base,
  ),
);
export const EmailOutbox = model(
  "EmailOutbox",
  new Schema(
    {
      recipientId: ref("User", false),
      to: { type: String, select: false },
      subject: String,
      text: { type: String, select: false },
      status: {
        type: String,
        enum: ["pending", "sent", "failed"],
        default: "pending",
      },
      attempts: { type: Number, default: 0 },
      nextAttempt: Date,
    },
    base,
  ),
);
EmailOutbox.schema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
);
