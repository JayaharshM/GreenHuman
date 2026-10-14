import { readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
try {
  await access(".env");
  console.log(".env already exists; preserved.");
} catch {
  const template = await readFile(".env.example", "utf8");
  await writeFile(
    ".env",
    template.replace(
      "generate-at-least-32-random-bytes",
      randomBytes(48).toString("hex"),
    ),
    { mode: 0o600 },
  );
  console.log("Created local .env with a random session secret.");
}
