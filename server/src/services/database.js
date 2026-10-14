import {
  User,
  Hospital,
  BloodRequest,
  Drive,
  Story,
  DonationRecord,
  Sponsorship,
} from "../models/index.js";
import { config } from "../config.js";
export async function assertProductionData(environment = config.env) {
  if (environment !== "production") return;
  const demoRecords = await Promise.all(
    [
      User,
      Hospital,
      BloodRequest,
      Drive,
      Story,
      DonationRecord,
      Sponsorship,
    ].map((model) => model.exists({ demo: true })),
  );
  if (demoRecords.some(Boolean))
    throw new Error(
      "Production database contains demonstration records. Use a fresh production database; demo data cannot be presented as real activity.",
    );
}
