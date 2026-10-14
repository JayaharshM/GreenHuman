import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config, assertConfig } from "./config.js";
import {
  User,
  Hospital,
  BloodRequest,
  Drive,
  Story,
  ContentPage,
  Application,
  Sponsorship,
} from "./models/index.js";
assertConfig();
if (config.env === "production" || !config.demo)
  throw new Error("Seed is only allowed in development with DEMO_MODE=true.");
if (!process.env.SEED_PASSWORD) throw new Error("Set SEED_PASSWORD in .env.");
await mongoose.connect(config.mongo);
const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD, 12);
const accounts = [
  ["donor", "Aarav Demo", "donor@lifeline.example"],
  ["hospital", "Meera Demo", "hospital@lifeline.example"],
  ["admin", "NGO Administrator", "admin@lifeline.example"],
  ["volunteer", "Riya Demo", "volunteer@lifeline.example"],
];
const users = {};
for (const [role, name, email] of accounts) {
  users[role] = await User.findOneAndUpdate(
    { email },
    {
      $setOnInsert: {
        name,
        email,
        passwordHash,
        role,
        phone: "0000000000",
        dateOfBirth: new Date("2001-05-12"),
        bloodGroup: "O+",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        college: "Example Arts College",
        isVerified: true,
        consent: {
          processing: true,
          booking: true,
          invitations: true,
          promotions: false,
        },
        demo: true,
      },
    },
    { upsert: true, new: true },
  );
}
const hospitals = [];
const entries = [
  [
    "Sahyadri Community Hospital",
    "Koregaon Park, Pune",
    "411001",
    [73.8938, 18.5362],
  ],
  ["Asha Blood Centre", "Shivajinagar, Pune", "411005", [73.8467, 18.5314]],
  ["Sunrise Care Hospital", "Baner, Pune", "411045", [73.7868, 18.559]],
  [
    "Unity Medical Centre",
    "Andheri West, Mumbai",
    "400053",
    [72.8296, 19.1364],
  ],
];
for (let i = 0; i < entries.length; i++) {
  const [name, address, pincode, coordinates] = entries[i];
  const h = await Hospital.findOneAndUpdate(
    { name, demo: true },
    {
      $setOnInsert: {
        ownerId: users.hospital._id,
        name,
        address,
        pincode,
        city: i === 3 ? "Mumbai" : "Pune",
        state: "Maharashtra",
        description:
          "A fictitious community care facility created to demonstrate hospital discovery and donation coordination. This is not a real medical service.",
        registrationNumber: `DEMO-${i + 1}`,
        category: i === 1 ? "blood_bank" : "hospital",
        location: { type: "Point", coordinates },
        contactEmail: `hospital${i + 1}@lifeline.example`,
        contactPhone: "0000000000",
        donationHours: "Monday–Saturday, 9:00 AM–4:00 PM (demo)",
        facilities: [
          "Donation counselling",
          "Accessible entrance",
          "Refreshment area",
        ],
        acceptingDonors: true,
        verificationStatus: "verified",
        verifiedAt: new Date(),
        verifiedBy: users.admin._id,
        demo: true,
      },
    },
    { upsert: true, new: true },
  );
  hospitals.push(h);
}
for (let i = 0; i < 3; i++)
  await BloodRequest.findOneAndUpdate(
    { hospitalId: hospitals[i]._id, demo: true },
    {
      $set: {
        bloodGroup: ["O-", "B+", "A+"][i],
        unitsRequired: [3, 2, 4][i],
        urgency: ["critical", "high", "routine"][i],
        description:
          "Illustrative requirement for testing the coordination workflow. No real patient or inventory information is represented.",
        instructions:
          "Use the demo appointment form to request a visit. Do not travel or contact this fictitious hospital.",
        status: "active",
        verificationStatus: "verified",
        verifiedBy: users.admin._id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        demo: true,
      },
    },
    { upsert: true },
  );
const driveTitles = [
  "The Good Giving Day",
  "Campus Hearts, Connected",
  "A Sunday for Someone",
];
for (let i = 0; i < 3; i++) {
  const start = new Date(Date.now() + (i + 3) * 86400000);
  start.setHours(9, 0, 0, 0);
  await Drive.findOneAndUpdate(
    { title: driveTitles[i], demo: true },
    {
      $setOnInsert: { registeredCount: 0 },
      $set: {
        title: driveTitles[i],
        description:
          "An illustrative community blood donation drive. Meet a community that cares, learn about donation and experience our registration workflow. This event is fictitious and is not open for real-world attendance.",
        organizerId: i === 1 ? users.volunteer._id : users.hospital._id,
        hospitalId: hospitals[i]._id,
        venue: [
          "The Community Hall, Koregaon Park",
          "Example Arts College, Shivajinagar",
          "Sunrise Community Centre, Baner",
        ][i],
        city: "Pune",
        location: hospitals[i].location,
        startDate: start,
        endDate: new Date(start.getTime() + 5 * 3600000),
        registrationDeadline: new Date(start.getTime() - 3600000),
        capacity: [80, 120, 60][i],
        status: "upcoming",
        theme: ["coral", "crimson", "olive"][i],
        demo: true,
      },
    },
    { upsert: true },
  );
}
for (const [title, category, excerpt] of [
  [
    "A first step that feels like belonging",
    "DONOR JOURNAL",
    "An illustrative story about taking the first step, asking questions, and showing up for your community.",
  ],
  [
    "When a campus comes together",
    "CAMPUS CULTURE",
    "A sample story exploring how student volunteers can make a donation drive feel welcoming.",
  ],
  [
    "The people behind the possibility",
    "BEHIND THE SCENES",
    "A demonstration of the stories we hope to tell, with permission from the people who live them.",
  ],
])
  await Story.findOneAndUpdate(
    { title, demo: true },
    {
      $setOnInsert: {
        title,
        category,
        excerpt,
        body: `${excerpt}\n\nThis is clearly labeled demonstration content. No real donation, person, partnership or achievement is described. Real stories can be published by an administrator only after appropriate consent is confirmed.`,
        author: "Lifeline editorial demo",
        published: true,
        consentConfirmed: false,
        demo: true,
      },
    },
    { upsert: true },
  );
for (const [key, title, body] of [
  [
    "about",
    "Small acts. Shared humanity.",
    "Lifeline is a proposed community-led platform that brings donors, care teams and campuses closer together. This is an editable NGO introduction. Add the organization’s verified legal name, origin, registration details and real team before launch.",
  ],
  [
    "mission",
    "Make kindness easier to act on.",
    "Our proposed mission is to make blood donation accessible, thoughtful and community-driven through clear information and trusted coordination.",
  ],
  [
    "vision",
    "A community that shows up.",
    "We imagine a future where everyone who wants to help can find a safe and informed next step.",
  ],
  [
    "contact",
    "Let’s make good things happen.",
    "Contact details have not been supplied. Use the form to save an inquiry for the local coordination team. No real office address, phone number or social account is claimed.",
  ],
])
  await ContentPage.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, title, body } },
    { upsert: true },
  );
await Application.findOneAndUpdate(
  { email: "student@lifeline.example", demo: true },
  {
    $setOnInsert: {
      type: "volunteer",
      name: "Sam Demo",
      email: "student@lifeline.example",
      city: "Pune",
      message:
        "I would like to help with campus awareness and event coordination.",
      demo: true,
    },
  },
  { upsert: true },
);
await Sponsorship.findOneAndUpdate(
  { title: "Community spotlight — demo", demo: true },
  {
    $setOnInsert: {
      hospitalId: hospitals[1]._id,
      campaignType: "featured_hospital",
      title: "Community spotlight — demo",
      description:
        "Clearly labeled sponsored demonstration placement, separate from urgency listings.",
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 30 * 86400000),
      status: "approved",
      paymentStatus: "paid",
      price: 0,
      demo: true,
    },
  },
  { upsert: true },
);
console.log(
  "Demo seed ready. Fictitious account emails and local password instructions are in README.md. Existing records were preserved.",
);
await mongoose.disconnect();
