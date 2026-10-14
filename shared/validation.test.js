import { describe, it, expect } from "vitest";
import { ageOn, registerSchema, driveSchema } from "./validation.js";
describe("Donation and consent boundaries", () => {
  it("checks age at the birthday, in UTC", () => {
    expect(ageOn("2008-10-15", new Date("2026-10-14T12:00:00Z"))).toBe(17);
    expect(ageOn("2008-10-14", new Date("2026-10-14T12:00:00Z"))).toBe(18);
  });
  it("rejects privilege escalation and missing processing consent", () => {
    const donor = {
      name: "Example Donor",
      email: "donor@example.org",
      phone: "9000000000",
      password: "SecureDemo123!",
      dateOfBirth: "2000-01-01",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      consent: { processing: true },
    };
    expect(registerSchema.safeParse(donor).success).toBe(true);
    expect(registerSchema.safeParse({ ...donor, role: "admin" }).success).toBe(
      false,
    );
    expect(
      registerSchema.safeParse({ ...donor, consent: { processing: false } })
        .success,
    ).toBe(false);
  });
  it("does not treat optional invitations or promotions as required", () => {
    const parsed = registerSchema.parse({
      name: "Example Donor",
      email: "TEST@example.org",
      phone: "9000000000",
      password: "SecureDemo123!",
      dateOfBirth: "2000-01-01",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      consent: { processing: true },
    });
    expect(parsed.email).toBe("test@example.org");
    expect(parsed.consent.invitations).toBe(false);
    expect(parsed.consent.promotions).toBe(false);
  });
  it("rejects events with conflicting dates", () => {
    const start = new Date(Date.now() + 86400000).toISOString();
    expect(
      driveSchema.safeParse({
        title: "A good drive",
        description: "A community drive to test registration.",
        hospitalId: "a".repeat(24),
        venue: "Community centre",
        city: "Pune",
        startDate: start,
        endDate: new Date(Date.now()).toISOString(),
        registrationDeadline: start,
        capacity: 10,
      }).success,
    ).toBe(false);
  });
});
