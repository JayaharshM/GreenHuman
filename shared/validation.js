import { z } from "zod";
export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const consentSchema = z.object({
  processing: z.literal(true, {
    error: "Please consent to processing your registration.",
  }),
  booking: z.boolean().default(false),
  invitations: z.boolean().default(false),
  promotions: z.boolean().default(false),
});
export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  phone: z.string().regex(/^\+?[\d ()-]{8,18}$/, "Enter a valid phone number."),
  dateOfBirth: z
    .string()
    .refine(
      (s) => !Number.isNaN(Date.parse(s)) && new Date(s) < new Date(),
      "Enter a valid date of birth.",
    ),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, "Enter a six-digit pincode."),
  bloodGroup: z.enum([...bloodGroups, "unknown"]).default("unknown"),
  college: z.string().max(150).optional(),
  previousDonation: z.boolean().default(false),
  lastDonationDate: z.string().optional(),
  consent: consentSchema,
  role: z.enum(["donor", "hospital", "volunteer"]).default("donor"),
});
export const loginSchema = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
});
export const hospitalSchema = z.object({
  name: z.string().trim().min(3).max(150),
  category: z.enum(["hospital", "blood_bank", "clinic"]).default("hospital"),
  registrationNumber: z.string().min(3).max(100),
  description: z.string().min(20).max(2000),
  address: z.string().min(5).max(300),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/),
  longitude: z.coerce.number().min(-180).max(180),
  latitude: z.coerce.number().min(-90).max(90),
  contactEmail: z.email(),
  contactPhone: z.string().min(8).max(20),
  website: z.union([z.url(), z.literal("")]).default(""),
  donationHours: z.string().min(3).max(200),
  facilities: z.array(z.string().max(100)).max(15).default([]),
  acceptingDonors: z.boolean().default(true),
});
export const requestSchema = z.object({
  hospitalId: z.string().regex(/^[a-f\d]{24}$/i),
  bloodGroup: z.enum(bloodGroups),
  unitsRequired: z.coerce.number().int().min(1).max(100),
  urgency: z.enum(["critical", "high", "routine"]),
  description: z.string().min(10).max(1500),
  instructions: z.string().min(10).max(1500),
  expiresAt: z
    .string()
    .refine(
      (s) => Date.parse(s) > Date.now(),
      "Expiration must be in the future.",
    ),
});
export const driveSchema = z
  .object({
    title: z.string().min(4).max(150),
    description: z.string().min(20).max(3000),
    hospitalId: z.string().regex(/^[a-f\d]{24}$/i),
    venue: z.string().min(4).max(300),
    city: z.string().min(2).max(100),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    registrationDeadline: z.string().datetime(),
    capacity: z.coerce.number().int().min(1).max(10000),
    theme: z.enum(["coral", "crimson", "olive"]).default("coral"),
  })
  .refine(
    (d) =>
      Date.parse(d.endDate) > Date.parse(d.startDate) &&
      Date.parse(d.registrationDeadline) <= Date.parse(d.startDate) &&
      Date.parse(d.startDate) > Date.now(),
    { message: "Check event dates and registration deadline." },
  );
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  subject: z.string().min(3).max(150),
  message: z.string().min(10).max(3000),
  website: z.string().max(0).optional(),
});
export function ageOn(date, now = new Date()) {
  const dob = new Date(date);
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() &&
      now.getUTCDate() < dob.getUTCDate())
  )
    age--;
  return age;
}
