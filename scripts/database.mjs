import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
await mkdir(".data/mongo", { recursive: true });
const processDB = spawn(
  "mongod",
  ["--dbpath", ".data/mongo", "--port", "27018", "--bind_ip", "127.0.0.1"],
  { stdio: "inherit" },
);
processDB.on("error", () => {
  console.error(
    "Install MongoDB Community or configure MONGODB_URI for Atlas.",
  );
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => processDB.kill(signal));
