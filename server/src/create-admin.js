import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config, assertConfig } from "./config.js";
import { User } from "./models/index.js";
assertConfig();
const values = z
  .object({
    email: z.email(),
    name: z.string().min(2),
    password: z.string().min(16),
  })
  .parse({
    email: process.env.ADMIN_EMAIL,
    name: process.env.ADMIN_NAME,
    password: process.env.ADMIN_PASSWORD,
  });
await mongoose.connect(config.mongo);
if (await User.exists({ email: values.email.toLowerCase() }))
  throw new Error(
    "An account with that email already exists. No role was changed.",
  );
await User.create({
  name: values.name,
  email: values.email.toLowerCase(),
  passwordHash: await bcrypt.hash(values.password, 12),
  role: "admin",
  isVerified: true,
  consent: {
    processing: true,
    booking: false,
    invitations: false,
    promotions: false,
  },
});
console.log("Administrator created. Credentials were not logged.");
await mongoose.disconnect();
