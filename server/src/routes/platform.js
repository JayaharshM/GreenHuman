import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  User,
  Hospital,
  BloodRequest,
  Drive,
  DriveRegistration,
  Appointment,
  DonationRecord,
  Notification,
  Sponsorship,
  Application,
  Story,
  ContentPage,
  AuditLog,
} from "../models/index.js";
import {
  hospitalSchema,
  requestSchema,
  driveSchema,
  contactSchema,
  ageOn,
} from "../../../shared/validation.js";
import {
  auth,
  roles,
  validate,
  fail,
  token,
  safeUser,
} from "../middleware/security.js";
import {
  audit,
  notify,
  broadcast,
  optionalAlerts,
  email,
} from "../services/events.js";
import { config } from "../config.js";
import { saveFile, serveFile } from "../services/storage.js";
export const platform = Router();
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
platform.param("id", (req, res, next, id) =>
  idSchema.safeParse(id).success
    ? next()
    : next(
        Object.assign(new Error("This record could not be found."), {
          status: 404,
        }),
      ),
);
const page = (req) => ({
  limit: Math.min(50, Math.max(1, Number(req.query.limit) || 12)),
  skip:
    (Math.max(1, Number(req.query.page) || 1) - 1) *
    Math.min(50, Math.max(1, Number(req.query.limit) || 12)),
});
const publicHospital = (h) => {
  if (!h) return null;
  const v = h.toObject ? h.toObject() : { ...h };
  delete v.verificationDocuments;
  delete v.registrationNumber;
  delete v.ownerId;
  delete v.verifiedBy;
  return v;
};
const activeRequests = {
  status: "active",
  verificationStatus: "verified",
  expiresAt: { $gt: new Date() },
};
const verifiedQuery = () => ({
  status: "active",
  verificationStatus: "verified",
  expiresAt: { $gt: new Date() },
});
const ownership = async (user, hospitalId, verified = false) => {
  const h = await Hospital.findById(hospitalId);
  if (!h) fail(404, "Hospital not found.");
  if (user.role !== "admin" && String(h.ownerId) !== String(user._id))
    fail(403, "You do not manage this hospital.");
  if (verified && h.verificationStatus !== "verified")
    fail(403, "Your hospital must be verified first.");
  return h;
};
const canDonate = (user) => {
  if (user.role !== "donor") fail(403, "Use a donor account to register.");
  if (config.requireEmailVerification && !user.isVerified)
    fail(403, "Verify your email before booking.");
  if (!user.dateOfBirth || ageOn(user.dateOfBirth) < config.minAge)
    fail(
      422,
      `Donation bookings require a minimum age of ${config.minAge}. You can explore volunteering instead.`,
    );
  if (!user.consent?.booking)
    fail(422, "Enable booking communications in your profile settings first.");
};
platform.get("/stats", async (req, res) => {
  const [donors, hospitals, donations, drives] = await Promise.all([
    User.countDocuments({ role: "donor", disabled: false }),
    Hospital.countDocuments({ verificationStatus: "verified" }),
    DonationRecord.countDocuments({ confirmationStatus: "confirmed" }),
    Drive.countDocuments({ status: "completed" }),
  ]);
  res.json({
    data: { donors, hospitals, donations, drives, demo: config.demo },
  });
});
platform.get("/hospitals", async (req, res) => {
  const { limit, skip } = page(req);
  const filter = { verificationStatus: "verified" };
  if (typeof req.query.city === "string" && req.query.city)
    filter.city = {
      $regex: req.query.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  if (typeof req.query.q === "string" && req.query.q) {
    const q = req.query.q.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { pincode: q },
      { city: { $regex: q, $options: "i" } },
    ];
  }
  if (req.query.accepting === "true") filter.acceptingDonors = true;
  if (req.query.bloodGroup) {
    const ids = await BloodRequest.distinct("hospitalId", {
      ...verifiedQuery(),
      bloodGroup: String(req.query.bloodGroup),
    });
    filter._id = { $in: ids };
  }
  const sort =
    req.query.sort === "recent"
      ? { updatedAt: -1 }
      : req.query.sort === "accepting"
        ? { acceptingDonors: -1, name: 1 }
        : { name: 1 };
  const [hospitals, total] = await Promise.all([
    Hospital.find(filter).sort(sort).skip(skip).limit(limit),
    Hospital.countDocuments(filter),
  ]);
  const ids = hospitals.map((h) => h._id);
  const requests = await BloodRequest.aggregate([
    { $match: { ...verifiedQuery(), hospitalId: { $in: ids } } },
    { $group: { _id: "$hospitalId", count: { $sum: 1 } } },
  ]);
  res.json({
    data: hospitals.map((h) => ({
      ...publicHospital(h),
      activeRequests:
        requests.find((r) => String(r._id) === String(h._id))?.count || 0,
    })),
    meta: { total, limit },
  });
});
platform.get("/hospitals/nearby", async (req, res) => {
  const parsed = z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      radius: z.coerce.number().min(1).max(100).default(25),
    })
    .safeParse(req.query);
  if (!parsed.success)
    fail(422, "Enter valid coordinates and a radius from 1 to 100 km.");
  const { lat, lng, radius } = parsed.data;
  const hospitals = await Hospital.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distance",
        maxDistance: radius * 1000,
        spherical: true,
        query: { verificationStatus: "verified" },
      },
    },
    { $limit: 50 },
    {
      $project: {
        verificationDocuments: 0,
        registrationNumber: 0,
        ownerId: 0,
        verifiedBy: 0,
      },
    },
  ]);
  res.json({ data: hospitals });
});
platform.get("/hospitals/:id", async (req, res) => {
  const h = await Hospital.findOne({
    _id: req.params.id,
    verificationStatus: "verified",
  });
  if (!h) fail(404, "Hospital not found.");
  const [requests, drives] = await Promise.all([
    BloodRequest.find({ ...verifiedQuery(), hospitalId: h._id }),
    Drive.find({
      hospitalId: h._id,
      status: { $in: ["upcoming", "live"] },
      endDate: { $gt: new Date() },
    }),
  ]);
  res.json({ data: { ...publicHospital(h), requests, drives } });
});
platform.post(
  "/hospitals",
  auth,
  roles("hospital"),
  validate(hospitalSchema),
  async (req, res) => {
    if (await Hospital.exists({ ownerId: req.user._id }))
      fail(409, "You already have a hospital profile.");
    const { longitude, latitude, ...data } = req.input;
    const h = await Hospital.create({
      ...data,
      ownerId: req.user._id,
      location: { type: "Point", coordinates: [longitude, latitude] },
      verificationStatus: "pending",
      demo: config.demo,
    });
    await audit(req.user, "hospital.submitted", h._id);
    res.status(201).json({ data: h });
  },
);
platform.patch(
  "/hospitals/:id",
  auth,
  roles("hospital", "admin"),
  validate(hospitalSchema.partial()),
  async (req, res) => {
    const h = await ownership(req.user, req.params.id);
    const { longitude, latitude, ...data } = req.input;
    Object.assign(h, data);
    if (longitude !== undefined || latitude !== undefined)
      h.location.coordinates = [
        longitude ?? h.location.coordinates[0],
        latitude ?? h.location.coordinates[1],
      ];
    if (req.user.role !== "admin") {
      h.verificationStatus = "pending";
      h.verifiedAt = undefined;
    }
    await h.save();
    broadcast("refresh", { resource: "hospitals" });
    res.json({ data: h });
  },
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
platform.post(
  "/hospitals/:id/images",
  auth,
  roles("hospital", "admin"),
  upload.single("image"),
  async (req, res) => {
    const h = await ownership(req.user, req.params.id);
    if (h.images.length >= 6) fail(422, "Maximum six hospital photographs.");
    const file = req.file;
    if (!file) fail(422, "Choose a PNG or JPEG image.");
    const signature = file.buffer.subarray(0, 8).toString("hex");
    const extension = signature.startsWith("89504e470d0a1a0a")
      ? "png"
      : signature.startsWith("ffd8ff")
        ? "jpg"
        : null;
    if (!extension) fail(422, "Only genuine PNG and JPEG images are accepted.");
    const key = `${token()}.${extension}`;
    await saveFile(
      key,
      file.buffer,
      extension === "png" ? "image/png" : "image/jpeg",
    );
    h.images.push(`/api/hospitals/${h._id}/images/${key}`);
    if (req.user.role !== "admin") h.verificationStatus = "pending";
    await h.save();
    await audit(req.user, "hospital.image_uploaded", h._id);
    broadcast("refresh", { resource: "hospitals" });
    res
      .status(201)
      .json({ data: { message: "Image saved. Profile is ready for review." } });
  },
);
platform.get("/hospitals/:id/images/:key", async (req, res) => {
  const key = req.params.key;
  if (!/^[a-f\d]{64}\.(png|jpg)$/.test(key)) fail(404, "Image not found.");
  const url = `/api/hospitals/${req.params.id}/images/${key}`;
  const h = await Hospital.findOne({
    _id: req.params.id,
    verificationStatus: "verified",
    images: url,
  });
  if (!h) fail(404, "Image not found.");
  await serveFile(res, key, key.endsWith(".png") ? "image/png" : "image/jpeg");
});
platform.post(
  "/hospitals/:id/verification-documents",
  auth,
  roles("hospital", "admin"),
  upload.single("document"),
  async (req, res) => {
    const h = await ownership(req.user, req.params.id);
    if (h.verificationDocuments.length >= 5)
      fail(422, "Maximum five verification documents.");
    const f = req.file;
    if (!f) fail(422, "Choose a PDF, PNG or JPEG document.");
    const signature = f.buffer.subarray(0, 8).toString("hex");
    const mime =
      f.buffer.subarray(0, 5).toString() === "%PDF-"
        ? "application/pdf"
        : signature.startsWith("89504e470d0a1a0a")
          ? "image/png"
          : signature.startsWith("ffd8ff")
            ? "image/jpeg"
            : null;
    if (!mime) fail(422, "Only genuine PDF, PNG and JPEG files are accepted.");
    const file = token();
    await saveFile(file, f.buffer, mime);
    h.verificationDocuments.push({
      name: path.basename(f.originalname).slice(0, 100),
      file,
      mime,
      size: f.size,
    });
    await h.save();
    await audit(req.user, "hospital.document_uploaded", h._id);
    res.status(201).json({ data: { message: "Document saved privately." } });
  },
);
platform.get(
  "/hospitals/:id/documents/:documentId",
  auth,
  roles("hospital", "admin"),
  async (req, res) => {
    const h = await ownership(req.user, req.params.id);
    const doc = h.verificationDocuments.id(req.params.documentId);
    if (!doc) fail(404, "Document not found.");
    await serveFile(res, doc.file, doc.mime, { download: true });
  },
);
platform.get("/blood-requests", async (req, res) => {
  const filter = verifiedQuery();
  if (req.query.bloodGroup) filter.bloodGroup = String(req.query.bloodGroup);
  if (["critical", "high", "routine"].includes(req.query.urgency))
    filter.urgency = req.query.urgency;
  if (req.query.city) {
    const ids = await Hospital.distinct("_id", {
      city: String(req.query.city),
      verificationStatus: "verified",
    });
    filter.hospitalId = { $in: ids };
  }
  const hospitals = await Hospital.distinct("_id", {
    verificationStatus: "verified",
  });
  if (!filter.hospitalId) filter.hospitalId = { $in: hospitals };
  const { limit, skip } = page(req);
  const all = await BloodRequest.find(filter)
    .populate({
      path: "hospitalId",
      select: "name city address contactPhone donationHours verificationStatus",
    })
    .lean();
  const rank = { critical: 0, high: 1, routine: 2 };
  all.sort(
    (a, b) =>
      rank[a.urgency] - rank[b.urgency] ||
      new Date(b.updatedAt) - new Date(a.updatedAt),
  );
  res.json({
    data: all.slice(skip, skip + limit),
    meta: { total: all.length },
  });
});
platform.get("/blood-requests/:id", async (req, res) => {
  const r = await BloodRequest.findOne({
    _id: req.params.id,
    ...verifiedQuery(),
  }).populate({
    path: "hospitalId",
    select: "name city address contactPhone donationHours verificationStatus",
  });
  if (!r || r.hospitalId?.verificationStatus !== "verified")
    fail(404, "This requirement is no longer available.");
  res.json({ data: r });
});
platform.post(
  "/blood-requests",
  auth,
  roles("hospital", "admin"),
  validate(requestSchema),
  async (req, res) => {
    const h = await ownership(req.user, req.input.hospitalId, true);
    const r = await BloodRequest.create({
      ...req.input,
      status: "pending",
      verificationStatus: "pending",
      demo: !!h.demo,
    });
    await audit(req.user, "request.submitted", r._id);
    res.status(201).json({ data: r });
  },
);
platform.patch(
  "/blood-requests/:id",
  auth,
  roles("hospital", "admin"),
  async (req, res) => {
    const r = await BloodRequest.findById(req.params.id);
    if (!r) fail(404, "Requirement not found.");
    await ownership(req.user, r.hospitalId);
    if (["fulfilled", "cancelled"].includes(req.body.status)) {
      r.status = req.body.status;
    } else {
      const parsed = requestSchema
        .omit({ hospitalId: true })
        .partial()
        .safeParse(req.body);
      if (!parsed.success || !Object.keys(parsed.data).length)
        fail(422, "Enter valid requirement details.");
      Object.assign(r, parsed.data, {
        status: "pending",
        verificationStatus: "pending",
      });
    }
    await r.save();
    await audit(req.user, "request.updated", r._id, { status: r.status });
    broadcast("refresh", { resource: "requests" });
    res.json({ data: r });
  },
);
platform.delete(
  "/blood-requests/:id",
  auth,
  roles("hospital", "admin"),
  async (req, res) => {
    const r = await BloodRequest.findById(req.params.id);
    if (!r) fail(404, "Requirement not found.");
    await ownership(req.user, r.hospitalId);
    r.status = "cancelled";
    await r.save();
    await audit(req.user, "request.cancelled", r._id);
    broadcast("refresh", { resource: "requests" });
    res.json({ data: r });
  },
);
platform.get("/drives", async (req, res) => {
  const { limit, skip } = page(req);
  const filter = { status: { $in: ["upcoming", "live", "completed"] } };
  if (["upcoming", "live", "completed"].includes(req.query.status))
    filter.status = req.query.status;
  if (req.query.city) filter.city = String(req.query.city);
  const [data, total] = await Promise.all([
    Drive.find(filter)
      .populate("hospitalId", "name")
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit),
    Drive.countDocuments(filter),
  ]);
  res.json({ data, meta: { total } });
});
platform.get("/drives/:id", async (req, res) => {
  const d = await Drive.findOne({
    _id: req.params.id,
    status: { $in: ["upcoming", "live", "completed", "cancelled"] },
  }).populate("hospitalId", "name contactPhone donationHours");
  if (!d) fail(404, "Drive not found.");
  res.json({ data: d });
});
platform.post(
  "/drives",
  auth,
  roles("hospital", "admin", "volunteer"),
  validate(driveSchema),
  async (req, res) => {
    const h =
      req.user.role === "volunteer"
        ? await Hospital.findOne({
            _id: req.input.hospitalId,
            verificationStatus: "verified",
          })
        : await ownership(req.user, req.input.hospitalId, true);
    if (!h) fail(422, "Choose a verified hospital partner.");
    const d = await Drive.create({
      ...req.input,
      location: h.location,
      organizerId: req.user._id,
      status: req.user.role === "admin" ? "upcoming" : "pending",
      demo: !!h.demo,
    });
    await audit(req.user, "drive.created", d._id);
    res.status(201).json({ data: d });
  },
);
platform.patch(
  "/drives/:id",
  auth,
  roles("hospital", "admin", "volunteer"),
  async (req, res) => {
    const d = await Drive.findById(req.params.id);
    if (!d) fail(404, "Drive not found.");
    if (
      req.user.role !== "admin" &&
      String(d.organizerId) !== String(req.user._id)
    )
      fail(403, "You do not manage this drive.");
    const input = z
      .object({
        status: z.enum(["live", "completed", "cancelled"]).optional(),
        announcement: z.string().max(1000).optional(),
      })
      .parse(req.body);
    if (d.status === "pending" && req.user.role !== "admin")
      fail(403, "Drive must be approved first.");
    Object.assign(d, input);
    await d.save();
    const registrations = await DriveRegistration.find({ driveId: d._id });
    for (const r of registrations)
      await notify(
        r.donorId,
        "Drive update",
        `${d.title}: ${d.announcement || d.status}`,
        "drive",
      );
    await audit(req.user, "drive.updated", d._id);
    broadcast("refresh", { resource: "drives" });
    res.json({ data: d });
  },
);
platform.get(
  "/drives/:id/registrations",
  auth,
  roles("hospital", "admin", "volunteer"),
  async (req, res) => {
    const d = await Drive.findById(req.params.id);
    if (!d) fail(404, "Drive not found.");
    if (
      req.user.role !== "admin" &&
      String(d.organizerId) !== String(req.user._id)
    )
      fail(403, "You do not manage this drive.");
    res.json({
      data: await DriveRegistration.find({ driveId: d._id })
        .populate("donorId", "name email")
        .limit(1000),
    });
  },
);
platform.post(
  "/drives/:id/register",
  auth,
  roles("donor"),
  async (req, res) => {
    canDonate(req.user);
    if (
      await DriveRegistration.exists({
        driveId: req.params.id,
        donorId: req.user._id,
      })
    )
      fail(409, "You are already registered for this drive.");
    const drive = await Drive.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: ["upcoming", "live"] },
        registrationDeadline: { $gt: new Date() },
        endDate: { $gt: new Date() },
        $expr: { $lt: ["$registeredCount", "$capacity"] },
      },
      { $inc: { registeredCount: 1 } },
      { new: true },
    );
    if (!drive) fail(409, "Registration is closed or this drive is full.");
    let registration;
    try {
      registration = await DriveRegistration.create({
        driveId: drive._id,
        donorId: req.user._id,
      });
    } catch (error) {
      await Drive.updateOne(
        { _id: drive._id },
        { $inc: { registeredCount: -1 } },
      );
      throw error;
    }
    await notify(
      req.user._id,
      "You’re on the list",
      `Your registration for ${drive.title} is confirmed. On-site screening is required.`,
      "drive",
    );
    await email(
      req.user,
      "Your drive registration",
      `You are registered for ${drive.title} at ${drive.venue}. This registration is not medical clearance.`,
    );
    broadcast("refresh", { resource: "drives" });
    res.status(201).json({ data: registration });
  },
);
platform.delete(
  "/drives/:id/register",
  auth,
  roles("donor"),
  async (req, res) => {
    const registration = await DriveRegistration.findOneAndDelete({
      driveId: req.params.id,
      donorId: req.user._id,
    });
    if (!registration) fail(404, "Registration not found.");
    await Drive.updateOne(
      { _id: req.params.id, registeredCount: { $gt: 0 } },
      { $inc: { registeredCount: -1 } },
    );
    broadcast("refresh", { resource: "drives" });
    res.json({ data: { message: "Registration cancelled." } });
  },
);
platform.post(
  "/appointments",
  auth,
  roles("donor"),
  validate(
    z.object({
      hospitalId: idSchema,
      bloodRequestId: idSchema.optional(),
      preferredDate: z
        .string()
        .refine(
          (s) => Date.parse(s) >= new Date().setHours(0, 0, 0, 0),
          "Choose today or a future date.",
        ),
      note: z.string().max(500).default(""),
    }),
  ),
  async (req, res) => {
    canDonate(req.user);
    const h = await Hospital.findOne({
      _id: req.input.hospitalId,
      verificationStatus: "verified",
      acceptingDonors: true,
    });
    if (!h) fail(422, "This hospital is not currently accepting requests.");
    if (
      req.input.bloodRequestId &&
      !(await BloodRequest.exists({
        _id: req.input.bloodRequestId,
        hospitalId: h._id,
        ...verifiedQuery(),
      }))
    )
      fail(422, "This requirement has expired or changed.");
    const a = await Appointment.create({ ...req.input, donorId: req.user._id });
    await notify(
      h.ownerId,
      "New appointment request",
      `A donor requested a visit to ${h.name}. Please confirm availability.`,
      "appointment",
    );
    await audit(req.user, "appointment.requested", a._id);
    res.status(201).json({ data: a });
  },
);
platform.get("/appointments/me", auth, async (req, res) =>
  res.json({
    data: await Appointment.find({ donorId: req.user._id })
      .populate("hospitalId", "name city")
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
platform.patch("/appointments/:id", auth, async (req, res) => {
  const a = await Appointment.findById(req.params.id);
  if (!a) fail(404, "Appointment not found.");
  const previousStatus = a.status;
  const donor = String(a.donorId) === String(req.user._id);
  const input = z
    .object({
      status: z.enum(["confirmed", "completed", "cancelled", "rejected"]),
      scheduledDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((v) => !Number.isNaN(Date.parse(v)))
        .optional(),
      scheduledTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .optional(),
    })
    .parse(req.body);
  if (donor) {
    if (input.status !== "cancelled")
      fail(403, "Only the hospital can confirm a donation.");
  } else {
    if (!["hospital", "admin"].includes(req.user.role))
      fail(403, "Access denied.");
    await ownership(req.user, a.hospitalId, true);
  }
  if (["completed", "cancelled", "rejected"].includes(a.status))
    fail(409, "This appointment is already closed.");
  if (input.status === "confirmed") {
    if (
      !input.scheduledDate ||
      Date.parse(input.scheduledDate) < new Date().setHours(0, 0, 0, 0) ||
      !input.scheduledTime
    )
      fail(422, "Confirm an actual date and time with the donor.");
    a.scheduledDate = input.scheduledDate;
    a.scheduledTime = input.scheduledTime;
  }
  if (input.status === "completed" && a.status !== "confirmed")
    fail(422, "Confirm the appointment before recording a completed donation.");
  a.status = input.status;
  const updated = await Appointment.findOneAndUpdate(
    { _id: a._id, status: previousStatus },
    {
      $set: {
        status: a.status,
        scheduledDate: a.scheduledDate,
        scheduledTime: a.scheduledTime,
      },
    },
    { new: true },
  );
  if (!updated)
    fail(409, "This appointment just changed. Refresh and try again.");
  if (a.status === "completed")
    await DonationRecord.findOneAndUpdate(
      { appointmentId: a._id },
      {
        $setOnInsert: {
          donorId: a.donorId,
          hospitalId: a.hospitalId,
          appointmentId: a._id,
          donationDate: new Date(),
          confirmedBy: req.user._id,
          confirmationStatus: "confirmed",
          demo: config.demo,
        },
      },
      { upsert: true },
    );
  await notify(
    a.donorId,
    "Appointment updated",
    `Your appointment is ${a.status}${a.scheduledTime ? ` at ${a.scheduledTime}` : ""}.`,
    "appointment",
  );
  await audit(req.user, "appointment.updated", a._id, { status: a.status });
  res.json({ data: a });
});
platform.get("/donors/me", auth, (req, res) =>
  res.json({ data: safeUser(req.user) }),
);
platform.patch(
  "/donors/me",
  auth,
  validate(
    z.object({
      name: z.string().min(2).max(100).optional(),
      phone: z.string().min(8).max(20).optional(),
      city: z.string().min(2).max(100).optional(),
      bloodGroup: z.string().max(7).optional(),
      consent: z
        .object({
          processing: z.literal(true),
          booking: z.boolean(),
          invitations: z.boolean(),
          promotions: z.boolean(),
        })
        .optional(),
      notificationPreferences: z
        .object({
          cities: z.array(z.string().max(100)).max(10).optional(),
          radius: z.number().min(1).max(100).optional(),
          bloodGroups: z.array(z.string().max(4)).max(8).optional(),
          drives: z.boolean().optional(),
          requests: z.boolean().optional(),
          announcements: z.boolean().optional(),
        })
        .optional(),
    }),
  ),
  async (req, res) => {
    Object.assign(req.user, req.input);
    if (req.input.consent)
      req.user.consentRecords.push({
        choices: req.input.consent,
        at: new Date(),
        version: "1.0",
      });
    await req.user.save();
    await audit(req.user, "profile.updated", req.user._id, {
      consentChanged: !!req.input.consent,
    });
    res.json({ data: safeUser(req.user) });
  },
);
platform.get("/donors/me/appointments", auth, async (req, res) =>
  res.json({
    data: await Appointment.find({ donorId: req.user._id })
      .populate("hospitalId", "name city")
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
platform.get("/donors/me/donations", auth, async (req, res) =>
  res.json({
    data: await DonationRecord.find({ donorId: req.user._id })
      .populate("hospitalId", "name")
      .sort({ donationDate: -1 })
      .limit(100),
  }),
);
platform.get("/donors/me/export", auth, async (req, res) => {
  const [appointments, registrations, donations] = await Promise.all([
    Appointment.find({ donorId: req.user._id }),
    DriveRegistration.find({ donorId: req.user._id }),
    DonationRecord.find({ donorId: req.user._id }),
  ]);
  res.set("Content-Disposition", 'attachment; filename="lifeline-data.json"');
  res.json({
    data: {
      profile: safeUser(req.user),
      consentRecords: req.user.consentRecords,
      appointments,
      registrations,
      donations,
    },
  });
});
platform.post("/donors/me/deletion", auth, async (req, res) => {
  req.user.deletionRequestedAt = new Date();
  await req.user.save();
  await Application.findOneAndUpdate(
    { type: "deletion", userId: req.user._id },
    {
      $setOnInsert: {
        name: req.user.name,
        email: req.user.email,
        userId: req.user._id,
        type: "deletion",
        message: "Account deletion requested by owner.",
      },
    },
    { upsert: true },
  );
  await audit(req.user, "account.deletion_requested", req.user._id);
  res.json({
    data: { message: "Your deletion request has been submitted for review." },
  });
});
platform.get("/notifications", auth, async (req, res) =>
  res.json({
    data: await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50),
  }),
);
platform.patch("/notifications/:id/read", auth, async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user._id },
    { read: true },
    { new: true },
  );
  if (!n) fail(404, "Notification not found.");
  res.json({ data: n });
});
platform.get("/stories", async (req, res) =>
  res.json({
    data: await Story.find({
      published: true,
      $or: [{ consentConfirmed: true }, { demo: true }],
    })
      .sort({ createdAt: -1 })
      .limit(30),
  }),
);
platform.get("/stories/:id", async (req, res) => {
  const story = await Story.findOne({
    _id: req.params.id,
    published: true,
    $or: [{ consentConfirmed: true }, { demo: true }],
  });
  if (!story) fail(404, "Story not found.");
  res.json({ data: story });
});
platform.get("/content", async (req, res) =>
  res.json({ data: await ContentPage.find({}).limit(30) }),
);
platform.post("/contact", validate(contactSchema), async (req, res) => {
  const a = await Application.create({ ...req.input, type: "contact" });
  res.status(201).json({
    data: {
      id: a._id,
      message: "Your message has been received. Thank you for reaching out.",
    },
  });
});
platform.post(
  "/applications",
  validate(
    z.object({
      type: z.enum(["volunteer", "campus"]),
      name: z.string().min(2).max(100),
      email: z.email(),
      phone: z.string().min(8).max(20),
      city: z.string().min(2).max(100),
      institution: z.string().max(200).default(""),
      participants: z.coerce.number().min(0).max(10000).default(0),
      preferredDates: z.string().max(100).default(""),
      interests: z.array(z.string().max(100)).max(10).default([]),
      message: z.string().min(10).max(2000),
      consent: z.literal(true),
    }),
  ),
  async (req, res) => {
    await Application.create(req.input);
    res.status(201).json({
      data: {
        message:
          "Application received. Our coordination team will review your interest.",
      },
    });
  },
);
platform.get("/sponsorships/featured", async (req, res) => {
  const campaigns = await Sponsorship.find({
    status: "approved",
    paymentStatus: "paid",
    startDate: { $lte: new Date() },
    endDate: { $gt: new Date() },
  })
    .populate({
      path: "hospitalId",
      match: { verificationStatus: "verified" },
      select: "name city description acceptingDonors",
    })
    .limit(4);
  res.json({ data: campaigns.filter((c) => c.hospitalId) });
});
platform.post(
  "/sponsorships",
  auth,
  roles("hospital"),
  validate(
    z
      .object({
        hospitalId: idSchema,
        campaignType: z.enum([
          "featured_hospital",
          "awareness_campaign",
          "promoted_drive",
        ]),
        title: z.string().min(4).max(150),
        description: z.string().min(10).max(2000),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
      .refine(
        (d) =>
          Date.parse(d.endDate) > Date.parse(d.startDate) &&
          Date.parse(d.startDate) >= new Date().setHours(0, 0, 0, 0),
        "Choose valid future campaign dates.",
      ),
  ),
  async (req, res) => {
    const h = await ownership(req.user, req.input.hospitalId, true);
    const s = await Sponsorship.create({ ...req.input, demo: h.demo });
    await audit(req.user, "sponsorship.submitted", s._id);
    res.status(201).json({ data: s });
  },
);
platform.post("/sponsorships/:id/click", async (req, res) => {
  await Sponsorship.updateOne(
    {
      _id: req.params.id,
      status: "approved",
      paymentStatus: "paid",
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() },
    },
    { $inc: { clicks: 1 } },
  );
  res.json({ data: { ok: true } });
});
platform.get("/dashboard", auth, async (req, res) => {
  const [appointments, registrations, donations, notifications] =
    await Promise.all([
      Appointment.find({ donorId: req.user._id })
        .populate("hospitalId", "name city")
        .sort({ createdAt: -1 })
        .limit(50),
      DriveRegistration.find({ donorId: req.user._id })
        .populate("driveId")
        .limit(50),
      DonationRecord.find({ donorId: req.user._id })
        .populate("hospitalId", "name")
        .limit(100),
      Notification.find({ recipientId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20),
    ]);
  res.json({ data: { appointments, registrations, donations, notifications } });
});
platform.get(
  "/hospital/dashboard",
  auth,
  roles("hospital", "volunteer", "admin"),
  async (req, res) => {
    const hospital = await Hospital.findOne({ ownerId: req.user._id });
    const driveFilter =
      req.user.role === "volunteer"
        ? { organizerId: req.user._id }
        : { hospitalId: hospital?._id };
    const [appointments, requests, drives, sponsorships] = await Promise.all([
      hospital
        ? Appointment.find({ hospitalId: hospital._id })
            .populate("donorId", "name email phone bloodGroup")
            .sort({ createdAt: -1 })
            .limit(100)
        : [],
      hospital
        ? BloodRequest.find({ hospitalId: hospital._id })
            .sort({ createdAt: -1 })
            .limit(100)
        : [],
      Drive.find(driveFilter).sort({ startDate: -1 }).limit(100),
      hospital ? Sponsorship.find({ hospitalId: hospital._id }).limit(50) : [],
    ]);
    res.json({
      data: { hospital, appointments, requests, drives, sponsorships },
    });
  },
);
platform.use("/admin", auth, roles("admin"));
platform.get("/admin/dashboard", async (req, res) => {
  const [
    donors,
    pendingHospitals,
    hospitals,
    requests,
    drives,
    donations,
    sponsorships,
    trend,
    groups,
  ] = await Promise.all([
    User.countDocuments({ role: "donor" }),
    Hospital.countDocuments({ verificationStatus: "pending" }),
    Hospital.countDocuments({ verificationStatus: "verified" }),
    BloodRequest.countDocuments(verifiedQuery()),
    Drive.countDocuments({ status: { $in: ["upcoming", "live"] } }),
    DonationRecord.countDocuments({ confirmationStatus: "confirmed" }),
    Sponsorship.countDocuments({ status: "pending" }),
    User.aggregate([
      { $match: { role: "donor" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          donors: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]),
    User.aggregate([
      { $match: { role: "donor" } },
      { $group: { _id: "$bloodGroup", count: { $sum: 1 } } },
      { $match: { count: { $gte: 5 } } },
    ]),
  ]);
  res.json({
    data: {
      donors,
      pendingHospitals,
      hospitals,
      requests,
      drives,
      donations,
      sponsorships,
      trend,
      groups,
      demo: config.demo,
    },
  });
});
platform.get("/admin/hospitals", async (req, res) =>
  res.json({
    data: await Hospital.find({}).sort({ createdAt: -1 }).limit(100),
  }),
);
platform.patch(
  "/admin/hospitals/:id/verify",
  validate(
    z.object({
      status: z.enum(["verified", "rejected", "suspended"]),
      note: z.string().min(3).max(500),
    }),
  ),
  async (req, res) => {
    const h = await Hospital.findById(req.params.id);
    if (!h) fail(404, "Hospital not found.");
    if (req.input.status === "verified" && !h.verificationDocuments.length)
      fail(
        422,
        "Review at least one private verification document before approval.",
      );
    h.verificationStatus = req.input.status;
    h.verifiedAt = new Date();
    h.verifiedBy = req.user._id;
    h.reviewNote = req.input.note;
    await h.save();
    await notify(
      h.ownerId,
      "Hospital review completed",
      `${h.name}: ${h.verificationStatus}. ${req.input.note}`,
    );
    await audit(req.user, "hospital.reviewed", h._id, req.input);
    broadcast("refresh", { resource: "hospitals" });
    res.json({ data: h });
  },
);
platform.get("/admin/blood-requests", async (req, res) =>
  res.json({
    data: await BloodRequest.find({})
      .populate("hospitalId", "name verificationStatus")
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
platform.patch(
  "/admin/blood-requests/:id/verify",
  validate(
    z.object({ approved: z.boolean(), note: z.string().min(3).max(500) }),
  ),
  async (req, res) => {
    const r = await BloodRequest.findById(req.params.id).populate("hospitalId");
    if (!r) fail(404, "Request not found.");
    if (
      req.input.approved &&
      (r.hospitalId.verificationStatus !== "verified" ||
        r.expiresAt <= new Date())
    )
      fail(422, "Hospital must be verified and request must be current.");
    r.verificationStatus = req.input.approved ? "verified" : "rejected";
    r.status = req.input.approved ? "active" : "rejected";
    r.verifiedBy = req.user._id;
    await r.save();
    await audit(req.user, "request.reviewed", r._id, req.input);
    if (req.input.approved)
      await optionalAlerts(
        r.hospitalId.city,
        "A verified requirement in your city",
        `${r.hospitalId.name} has a new ${r.bloodGroup} requirement.`,
      );
    broadcast("refresh", { resource: "requests" });
    res.json({ data: r });
  },
);
platform.get("/admin/drives", async (req, res) =>
  res.json({
    data: await Drive.find({})
      .populate("hospitalId", "name")
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
platform.patch(
  "/admin/drives/:id/verify",
  validate(z.object({ approved: z.boolean() })),
  async (req, res) => {
    const d = await Drive.findById(req.params.id);
    if (!d) fail(404, "Drive not found.");
    if (
      req.input.approved &&
      !(await Hospital.exists({
        _id: d.hospitalId,
        verificationStatus: "verified",
      }))
    )
      fail(422, "A verified hospital partner is required.");
    d.status = req.input.approved ? "upcoming" : "rejected";
    await d.save();
    await audit(req.user, "drive.reviewed", d._id, req.input);
    broadcast("refresh", { resource: "drives" });
    res.json({ data: d });
  },
);
platform.get("/admin/sponsorships", async (req, res) =>
  res.json({
    data: await Sponsorship.find({})
      .populate("hospitalId", "name")
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
platform.patch(
  "/admin/sponsorships/:id",
  validate(
    z.object({
      status: z.enum(["approved", "rejected", "completed"]),
      paymentStatus: z.enum(["unpaid", "paid"]),
      price: z.coerce.number().min(0).max(10000000),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  ),
  async (req, res) => {
    const s = await Sponsorship.findById(req.params.id);
    if (!s) fail(404, "Campaign not found.");
    Object.assign(s, req.input);
    if (s.endDate <= s.startDate)
      fail(422, "Campaign end must follow its start.");
    if (
      s.status === "approved" &&
      !(await Hospital.exists({
        _id: s.hospitalId,
        verificationStatus: "verified",
      }))
    )
      fail(422, "Sponsor hospital must be verified.");
    await s.save();
    await audit(req.user, "sponsorship.reviewed", s._id, req.input);
    res.json({ data: s });
  },
);
platform.get("/admin/applications", async (req, res) =>
  res.json({
    data: await Application.find({}).sort({ createdAt: -1 }).limit(100),
  }),
);
platform.patch(
  "/admin/applications/:id",
  validate(z.object({ status: z.enum(["reviewed", "closed"]) })),
  async (req, res) => {
    const a = await Application.findByIdAndUpdate(req.params.id, req.input, {
      new: true,
    });
    if (!a) fail(404, "Application not found.");
    await audit(req.user, "application.reviewed", a._id);
    res.json({ data: a });
  },
);
platform.get("/admin/users", async (req, res) =>
  res.json({
    data: await User.find({})
      .select("name role city isVerified disabled createdAt")
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
platform.patch(
  "/admin/users/:id",
  validate(z.object({ disabled: z.boolean() })),
  async (req, res) => {
    if (req.params.id === String(req.user._id))
      fail(422, "You cannot disable your own administrator account.");
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { disabled: req.input.disabled }, $inc: { sessionVersion: 1 } },
      { new: true },
    );
    if (!u) fail(404, "User not found.");
    await audit(req.user, "user.status_changed", u._id, req.input);
    res.json({ data: { id: u._id, disabled: u.disabled } });
  },
);
platform.get("/admin/audit", async (req, res) =>
  res.json({
    data: await AuditLog.find({})
      .populate("actorId", "name role")
      .sort({ createdAt: -1 })
      .limit(100),
  }),
);
platform.put(
  "/admin/content/:key",
  validate(
    z.object({
      title: z.string().min(2).max(150),
      body: z.string().min(10).max(10000),
    }),
  ),
  async (req, res) => {
    if (
      ![
        "about",
        "mission",
        "vision",
        "contact",
        "announcement",
        "faq",
        "team",
        "privacy",
        "terms",
      ].includes(req.params.key)
    )
      fail(422, "Unknown content section.");
    const c = await ContentPage.findOneAndUpdate(
      { key: req.params.key },
      req.input,
      { upsert: true, new: true },
    );
    await audit(req.user, "content.updated", c._id);
    res.json({ data: c });
  },
);
platform.post(
  "/admin/stories",
  validate(
    z.object({
      title: z.string().min(5).max(150),
      excerpt: z.string().min(10).max(300),
      body: z.string().min(20).max(10000),
      category: z.string().max(50),
      author: z.string().max(100),
      consentConfirmed: z.literal(true),
      published: z.boolean(),
    }),
  ),
  async (req, res) => {
    const story = await Story.create(req.input);
    await audit(req.user, "story.created", story._id);
    res.status(201).json({ data: story });
  },
);
