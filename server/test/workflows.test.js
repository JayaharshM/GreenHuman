import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { assertProductionData } from "../src/services/database.js";
import * as models from "../src/models/index.js";
const {
  User,
  Hospital,
  BloodRequest,
  Drive,
  DriveRegistration,
  Appointment,
  DonationRecord,
  Sponsorship,
  EmailOutbox,
} = models;
const app = createApp();
const sessions = {};
const users = {};
let hospital, drive, requirement, appointment;
const tomorrow = () =>
  new Date(Date.now() + 86400000).toISOString().slice(0, 10);
async function session(email) {
  const agent = request.agent(app);
  const csrf = (await agent.get("/api/csrf")).body.data.token;
  const login = await agent
    .post("/api/auth/login")
    .set("X-CSRF-Token", csrf)
    .send({ email, password: "TestingLife123!" });
  expect(login.status).toBe(200);
  return {
    agent,
    csrf,
    post: (url, body) => agent.post(url).set("X-CSRF-Token", csrf).send(body),
    patch: (url, body) => agent.patch(url).set("X-CSRF-Token", csrf).send(body),
    delete: (url) => agent.delete(url).set("X-CSRF-Token", csrf),
  };
}
beforeAll(async () => {
  const uri =
    process.env.TEST_MONGODB_URI ||
    `mongodb://127.0.0.1:27018/lifeline_test_${process.pid}_${Date.now()}`;
  if (!/\/lifeline_test_[\w]+(?:\?|$)/.test(uri))
    throw new Error("Tests require a dedicated lifeline_test_* database.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all(
    Object.values(models)
      .filter((m) => m.init)
      .map((m) => m.init()),
  );
  const passwordHash = await bcrypt.hash("TestingLife123!", 4);
  for (const [key, role, dob, verified] of [
    ["admin", "admin", "1990-01-01", true],
    ["hospital", "hospital", "1990-01-01", true],
    ["otherHospital", "hospital", "1990-01-01", true],
    ["donor", "donor", "2000-01-01", true],
    ["otherDonor", "donor", "2000-01-01", true],
    ["minor", "donor", "2015-01-01", true],
    ["unverified", "donor", "2000-01-01", false],
  ]) {
    users[key] = await User.create({
      name: `Test ${key}`,
      email: `${key.toLowerCase()}@test.example`,
      phone: "9000000000",
      passwordHash,
      role,
      dateOfBirth: dob,
      isVerified: verified,
      city: "Pune",
      consent: {
        processing: true,
        booking: true,
        invitations: false,
        promotions: false,
      },
    });
    sessions[key] = await session(users[key].email);
  }
});
afterAll(async () => {
  if (mongoose.connection.name?.startsWith("lifeline_test_"))
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
describe("Real Express → MongoDB workflows", () => {
  it("enforces CSRF, authentication, roles and safe account responses", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: users.donor.email, password: "TestingLife123!" })
      ).status,
    ).toBe(403);
    expect((await request(app).get("/api/admin/dashboard")).status).toBe(401);
    expect(
      (await sessions.donor.agent.get("/api/admin/dashboard")).status,
    ).toBe(403);
    const me = await sessions.donor.agent.get("/api/auth/me");
    expect(me.body.data.passwordHash).toBeUndefined();
    expect(me.body.data.refreshHash).toBeUndefined();
    const noOrigin = await sessions.donor
      .post("/api/contact", {
        name: "Test",
        email: "test@example.org",
        subject: "Test inquiry",
        message: "This is a test inquiry.",
      })
      .set("Origin", "https://evil.example");
    expect(noOrigin.status).toBe(403);
  });
  it("registers a donor and verifies single-use tokens when explicitly enabled", async () => {
    const previous = config.requireEmailVerification;
    config.requireEmailVerification = true;
    try {
      const agent = request.agent(app);
      const csrf = (await agent.get("/api/csrf")).body.data.token;
      const payload = {
        name: "New test donor",
        email: "new@test.example",
        phone: "9000000000",
        password: "TestingLife123!",
        dateOfBirth: "2000-01-01",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        consent: { processing: true, booking: true },
      };
      expect(
        (
          await agent
            .post("/api/auth/register")
            .set("X-CSRF-Token", csrf)
            .send({ ...payload, role: "admin" })
        ).status,
      ).toBe(422);
      const result = await agent
        .post("/api/auth/register")
        .set("X-CSRF-Token", csrf)
        .send(payload);
      expect(result.status).toBe(201);
      expect(
        result.headers["set-cookie"].some((v) => v.includes("HttpOnly")),
      ).toBe(true);
      expect(result.body.data.isVerified).toBe(false);
      const u = await User.findOne({ email: payload.email });
      const mail = await EmailOutbox.findOne({ recipientId: u._id }).select(
        "+text",
      );
      const token = new URL(
        mail.text.split("Confirm your email: ")[1],
      ).searchParams.get("token");
      expect(
        (
          await agent
            .post("/api/auth/verify-email")
            .set("X-CSRF-Token", csrf)
            .send({ token })
        ).status,
      ).toBe(200);
      expect(
        (
          await agent
            .post("/api/auth/verify-email")
            .set("X-CSRF-Token", csrf)
            .send({ token })
        ).status,
      ).toBe(400);
    } finally {
      config.requireEmailVerification = previous;
    }
  });
  it("registers without verification emails, tokens or a false verified flag", async () => {
    const agent = request.agent(app);
    const csrf = (await agent.get("/api/csrf")).body.data.token;
    const result = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrf)
      .send({
        name: "No email test donor",
        email: "no-email@test.example",
        phone: "9000000000",
        password: "TestingLife123!",
        dateOfBirth: "2000-01-01",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        consent: { processing: true, booking: true },
      });
    expect(result.status).toBe(201);
    expect(result.body.data.isVerified).toBe(false);
    expect(result.body.data.emailVerificationRequired).toBe(false);
    expect(result.body.meta.developmentLink).toBeUndefined();
    const user = await User.findOne({ email: "no-email@test.example" }).select(
      "+emailTokenHash",
    );
    expect(user.emailTokenHash).toBeUndefined();
    expect(user.emailTokenExpires).toBeUndefined();
    expect(await EmailOutbox.countDocuments({ recipientId: user._id })).toBe(0);
    expect(
      (
        await agent
          .post("/api/auth/resend-verification")
          .set("X-CSRF-Token", csrf)
      ).status,
    ).toBe(409);
    expect(
      (
        await agent
          .post("/api/auth/verify-email")
          .set("X-CSRF-Token", csrf)
          .send({ token: "a".repeat(64) })
      ).status,
    ).toBe(409);
  });
  it("keeps pending hospitals private and restricts verification documents", async () => {
    const payload = {
      name: "Test Care Hospital",
      registrationNumber: "TEST-LICENSE-123",
      description: "A hospital used only in an isolated automated test.",
      address: "Test Street, Pune",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      longitude: 73.85,
      latitude: 18.52,
      contactEmail: "care@test.example",
      contactPhone: "9000000000",
      donationHours: "9 AM–3 PM",
      facilities: ["Counselling"],
      acceptingDonors: true,
    };
    const result = await sessions.hospital.post("/api/hospitals", payload);
    expect(result.status).toBe(201);
    hospital = result.body.data;
    expect(hospital.verificationStatus).toBe("pending");
    expect((await request(app).get("/api/hospitals")).body.data).toHaveLength(
      0,
    );
    expect(
      (
        await sessions.admin.patch(
          `/api/admin/hospitals/${hospital._id}/verify`,
          { status: "verified", note: "Checked identity and license." },
        )
      ).status,
    ).toBe(422);
    const invalid = await sessions.hospital.agent
      .post(`/api/hospitals/${hospital._id}/verification-documents`)
      .set("X-CSRF-Token", sessions.hospital.csrf)
      .attach("document", Buffer.from("<svg>bad</svg>"), "document.svg");
    expect(invalid.status).toBe(422);
    const uploaded = await sessions.hospital.agent
      .post(`/api/hospitals/${hospital._id}/verification-documents`)
      .set("X-CSRF-Token", sessions.hospital.csrf)
      .attach("document", Buffer.from("%PDF-1.4\nTest only"), "license.pdf");
    expect(uploaded.status).toBe(201);
    const h = await Hospital.findById(hospital._id);
    const url = `/api/hospitals/${hospital._id}/documents/${h.verificationDocuments[0]._id}`;
    expect((await sessions.otherHospital.agent.get(url)).status).toBe(403);
    expect((await sessions.admin.agent.get(url)).status).toBe(200);
    expect((await request(app).get(url)).status).toBe(401);
  });
  it("approves a hospital and supports geospatial discovery without exposing private documents", async () => {
    expect(
      (
        await sessions.admin.patch(
          `/api/admin/hospitals/${hospital._id}/verify`,
          {
            status: "verified",
            note: "Reviewed private license and official contact.",
          },
        )
      ).status,
    ).toBe(200);
    const list = await request(app).get("/api/hospitals?city=Pune");
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].verificationDocuments).toBeUndefined();
    expect(list.body.data[0].registrationNumber).toBeUndefined();
    const near = await request(app).get(
      "/api/hospitals/nearby?lat=18.52&lng=73.85&radius=5",
    );
    expect(near.body.data).toHaveLength(1);
    expect(near.body.data[0].distance).toBeLessThan(5);
  });
  it("requires age, email verification and booking consent on the server", async () => {
    const body = { hospitalId: hospital._id, preferredDate: tomorrow() };
    expect((await sessions.minor.post("/api/appointments", body)).status).toBe(
      422,
    );
    const previous = config.requireEmailVerification;
    config.requireEmailVerification = true;
    try {
      expect(
        (await sessions.unverified.post("/api/appointments", body)).status,
      ).toBe(403);
    } finally {
      config.requireEmailVerification = previous;
    }
    await User.updateOne(
      { _id: users.otherDonor._id },
      { "consent.booking": false },
    );
    expect(
      (await sessions.otherDonor.post("/api/appointments", body)).status,
    ).toBe(422);
    await User.updateOne(
      { _id: users.otherDonor._id },
      { "consent.booking": true },
    );
  });
  it("allows an existing unverified donor to book when verification is disabled", async () => {
    expect(config.requireEmailVerification).toBe(false);
    const result = await sessions.unverified.post("/api/appointments", {
      hospitalId: hospital._id,
      preferredDate: tomorrow(),
    });
    expect(result.status).toBe(201);
    expect(result.body.data.status).toBe("requested");
    expect((await User.findById(users.unverified._id)).isVerified).toBe(false);
    expect(
      (
        await sessions.unverified.patch(
          `/api/appointments/${result.body.data._id}`,
          { status: "cancelled" },
        )
      ).status,
    ).toBe(200);
  });
  it("requests and confirms a real appointment, counts only a hospital-confirmed donation", async () => {
    const body = { hospitalId: hospital._id, preferredDate: tomorrow() };
    let r = await sessions.donor.post("/api/appointments", body);
    expect(r.status).toBe(201);
    appointment = r.body.data;
    expect(appointment.status).toBe("requested");
    expect((await sessions.donor.post("/api/appointments", body)).status).toBe(
      409,
    );
    expect(await DonationRecord.countDocuments()).toBe(0);
    expect(
      (
        await sessions.donor.patch(`/api/appointments/${appointment._id}`, {
          status: "completed",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await sessions.otherHospital.patch(
          `/api/appointments/${appointment._id}`,
          {
            status: "confirmed",
            scheduledDate: tomorrow(),
            scheduledTime: "10:00",
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await sessions.hospital.patch(`/api/appointments/${appointment._id}`, {
          status: "completed",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await sessions.hospital.patch(`/api/appointments/${appointment._id}`, {
          status: "confirmed",
          scheduledDate: tomorrow(),
          scheduledTime: "10:00",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await sessions.hospital.patch(`/api/appointments/${appointment._id}`, {
          status: "completed",
        })
      ).status,
    ).toBe(200);
    expect(await DonationRecord.countDocuments()).toBe(1);
    expect(
      (
        await sessions.hospital.patch(`/api/appointments/${appointment._id}`, {
          status: "completed",
        })
      ).status,
    ).toBe(409);
    expect(await DonationRecord.countDocuments()).toBe(1);
  });
  it("publishes requirements only after independent verification and re-reviews material edits", async () => {
    const body = {
      hospitalId: hospital._id,
      bloodGroup: "O-",
      unitsRequired: 3,
      urgency: "critical",
      description: "Reviewed test requirement with no patient details.",
      instructions: "Use the test appointment form for coordination.",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    let r = await sessions.hospital.post("/api/blood-requests", body);
    expect(r.status).toBe(201);
    requirement = r.body.data;
    expect(
      (await request(app).get("/api/blood-requests")).body.data,
    ).toHaveLength(0);
    expect(
      (
        await sessions.otherHospital.patch(
          `/api/blood-requests/${requirement._id}`,
          { unitsRequired: 5 },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await sessions.admin.patch(
          `/api/admin/blood-requests/${requirement._id}/verify`,
          { approved: true, note: "Independently checked with care team." },
        )
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/blood-requests")).body.data,
    ).toHaveLength(1);
    expect(
      (
        await sessions.hospital.patch(
          `/api/blood-requests/${requirement._id}`,
          { unitsRequired: 4 },
        )
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get("/api/blood-requests")).body.data,
    ).toHaveLength(0);
    await sessions.admin.patch(
      `/api/admin/blood-requests/${requirement._id}/verify`,
      { approved: true, note: "Rechecked changed quantity." },
    );
    await BloodRequest.updateOne(
      { _id: requirement._id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    expect(
      (await request(app).get("/api/blood-requests")).body.data,
    ).toHaveLength(0);
  });
  it("creates and approves drives while preventing duplicate and over-capacity registrations", async () => {
    const starts = new Date(Date.now() + 3 * 86400000);
    const body = {
      title: "Test Community Drive",
      description: "An isolated event for testing capacity and authorization.",
      hospitalId: hospital._id,
      venue: "Test Community Centre",
      city: "Pune",
      startDate: starts.toISOString(),
      endDate: new Date(starts.getTime() + 3600000).toISOString(),
      registrationDeadline: new Date(starts.getTime() - 3600000).toISOString(),
      capacity: 1,
    };
    const result = await sessions.hospital.post("/api/drives", body);
    expect(result.status).toBe(201);
    drive = result.body.data;
    expect(drive.status).toBe("pending");
    expect(
      (await sessions.donor.post(`/api/drives/${drive._id}/register`)).status,
    ).toBe(409);
    expect(
      (
        await sessions.admin.patch(`/api/admin/drives/${drive._id}/verify`, {
          approved: true,
        })
      ).status,
    ).toBe(200);
    const outcomes = await Promise.all([
      sessions.donor.post(`/api/drives/${drive._id}/register`),
      sessions.otherDonor.post(`/api/drives/${drive._id}/register`),
    ]);
    expect(outcomes.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await Drive.findById(drive._id)).registeredCount).toBe(1);
    expect(await DriveRegistration.countDocuments({ driveId: drive._id })).toBe(
      1,
    );
    const winner =
      outcomes[0].status === 201 ? sessions.donor : sessions.otherDonor;
    expect(
      (await winner.post(`/api/drives/${drive._id}/register`)).status,
    ).toBe(409);
    expect(
      (await winner.delete(`/api/drives/${drive._id}/register`)).status,
    ).toBe(200);
    expect((await Drive.findById(drive._id)).registeredCount).toBe(0);
  });
  it("allows an unverified donor to join a drive while still enforcing age", async () => {
    expect(
      (await sessions.minor.post(`/api/drives/${drive._id}/register`)).status,
    ).toBe(422);
    expect(
      (await sessions.unverified.post(`/api/drives/${drive._id}/register`))
        .status,
    ).toBe(201);
    expect(
      (await sessions.unverified.delete(`/api/drives/${drive._id}/register`))
        .status,
    ).toBe(200);
    expect((await Drive.findById(drive._id)).registeredCount).toBe(0);
  });
  it("protects participant and donor information with ownership checks", async () => {
    expect(
      (
        await sessions.otherHospital.agent.get(
          `/api/drives/${drive._id}/registrations`,
        )
      ).status,
    ).toBe(403);
    expect(
      (await sessions.donor.agent.get(`/api/drives/${drive._id}/registrations`))
        .status,
    ).toBe(403);
    expect(
      (
        await sessions.hospital.agent.get(
          `/api/drives/${drive._id}/registrations`,
        )
      ).status,
    ).toBe(200);
    const own = (await sessions.donor.agent.get("/api/dashboard")).body.data;
    const other = (await sessions.otherDonor.agent.get("/api/dashboard")).body
      .data;
    expect(own.appointments).toHaveLength(1);
    expect(other.appointments).toHaveLength(0);
    const notification = (await sessions.donor.agent.get("/api/notifications"))
      .body.data[0];
    if (notification)
      expect(
        (
          await sessions.otherDonor.patch(
            `/api/notifications/${notification._id}/read`,
          )
        ).status,
      ).toBe(404);
  });
  it("separates paid visibility from medical urgency and enforces sponsor authorization", async () => {
    const body = {
      hospitalId: hospital._id,
      campaignType: "featured_hospital",
      title: "Test sponsorship",
      description: "A sponsored test placement for the community.",
      startDate: new Date(Date.now() + 1000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      urgency: "critical",
      status: "approved",
      paymentStatus: "paid",
    };
    expect((await sessions.donor.post("/api/sponsorships", body)).status).toBe(
      403,
    );
    const r = await sessions.hospital.post("/api/sponsorships", body);
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe("pending");
    expect(r.body.data.urgency).toBeUndefined();
    expect(
      (
        await sessions.hospital.patch(
          `/api/admin/sponsorships/${r.body.data._id}`,
          { status: "approved", price: 0, paymentStatus: "paid" },
        )
      ).status,
    ).toBe(403);
    const reviewed = await sessions.admin.patch(
      `/api/admin/sponsorships/${r.body.data._id}`,
      {
        status: "approved",
        price: 500,
        paymentStatus: "paid",
        startDate: new Date(Date.now() - 1000).toISOString(),
      },
    );
    expect(reviewed.status).toBe(200);
    expect(
      (await request(app).get("/api/sponsorships/featured")).body.data,
    ).toHaveLength(1);
    expect(await BloodRequest.countDocuments({ urgency: "critical" })).toBe(1);
  });
  it("persists independent consent changes, data export and deletion requests", async () => {
    const r = await sessions.donor.patch("/api/donors/me", {
      consent: {
        processing: true,
        booking: true,
        invitations: true,
        promotions: false,
      },
    });
    expect(r.status).toBe(200);
    expect((await User.findById(users.donor._id)).consentRecords).toHaveLength(
      1,
    );
    const exported = await sessions.donor.agent.get("/api/donors/me/export");
    expect(exported.status).toBe(200);
    expect(exported.body.data.profile.passwordHash).toBeUndefined();
    expect(exported.body.data.donations).toHaveLength(1);
    expect((await sessions.donor.post("/api/donors/me/deletion")).status).toBe(
      200,
    );
    expect(
      (await User.findById(users.donor._id)).deletionRequestedAt,
    ).toBeTruthy();
  });
  it("stores inquiries and rejects honeypot spam", async () => {
    const body = {
      name: "Example person",
      email: "person@test.example",
      subject: "Campus idea",
      message: "Let us organize a thoughtful campus event.",
    };
    expect(
      (
        await sessions.donor.post("/api/contact", {
          ...body,
          website: "https://spam.example",
        })
      ).status,
    ).toBe(422);
    expect((await sessions.donor.post("/api/contact", body)).status).toBe(201);
    expect(
      (await sessions.donor.agent.get("/api/admin/applications")).status,
    ).toBe(403);
    expect(
      (
        await sessions.admin.agent.get("/api/admin/applications")
      ).body.data.some((a) => a.subject === "Campus idea"),
    ).toBe(true);
  });
  it("resets passwords with hashed single-use tokens and revokes prior sessions", async () => {
    const s = sessions.unverified;
    expect(
      (
        await s.post("/api/auth/forgot-password", {
          email: users.unverified.email,
        })
      ).status,
    ).toBe(200);
    const mail = await EmailOutbox.findOne({
      recipientId: users.unverified._id,
      subject: "Reset your Lifeline password",
    }).select("+text");
    const reset = new URL(mail.text).searchParams.get("token");
    const u = await User.findById(users.unverified._id).select(
      "+resetTokenHash",
    );
    expect(u.resetTokenHash).not.toBe(reset);
    expect(
      (
        await s.post("/api/auth/reset-password", {
          token: reset,
          password: "NewTestingLife123!",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await s.post("/api/auth/reset-password", {
          token: reset,
          password: "NewTestingLife123!",
        })
      ).status,
    ).toBe(400);
    expect((await s.agent.get("/api/auth/me")).status).toBe(401);
  });
  it("rotates refresh cookies and invalidates access on logout", async () => {
    const s = sessions.otherDonor;
    const first = await s.post("/api/auth/refresh");
    expect(first.status).toBe(200);
    expect(
      first.headers["set-cookie"].filter((c) => c.includes("HttpOnly")),
    ).toHaveLength(2);
    expect((await s.post("/api/auth/logout")).status).toBe(200);
    expect((await s.agent.get("/api/auth/me")).status).toBe(401);
    expect((await s.post("/api/auth/refresh")).status).toBe(401);
  });
  it("refuses demonstration records in production", async () => {
    await expect(assertProductionData("production")).rejects.toThrow(
      "demonstration records",
    );
    await expect(assertProductionData("development")).resolves.toBeUndefined();
  });
});
