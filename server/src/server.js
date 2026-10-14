import http from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { assertConfig, config } from "./config.js";
import { createApp } from "./app.js";
import { attachIO } from "./services/events.js";
import { runJobs } from "./services/jobs.js";
import { assertProductionData } from "./services/database.js";
import { reportMongoStartupFailure } from "./services/startup-diagnostics.js";
import { User } from "./models/index.js";
assertConfig();
try {
  await mongoose.connect(config.mongo);
} catch (error) {
  await reportMongoStartupFailure(error, config.mongo);
  await mongoose.disconnect();
  process.exit(1);
}
await assertProductionData();
const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.client, credentials: true },
});
attachIO(io);
io.use(async (socket, next) => {
  try {
    const cookies = Object.fromEntries(
      (socket.handshake.headers.cookie || "")
        .split(";")
        .map((v) => v.trim().split("=")),
    );
    const data = jwt.verify(cookies.access || "", config.secret, {
      issuer: "lifeline",
      audience: "lifeline-web",
    });
    const u = await User.findById(data.sub);
    if (!u || u.disabled || u.sessionVersion !== data.version)
      throw new Error();
    socket.data.user = u;
    next();
  } catch {
    next(new Error("Authentication required."));
  }
});
io.on("connection", (socket) => {
  socket.join("public");
  socket.join(`user:${socket.data.user._id}`);
  setTimeout(() => socket.disconnect(true), 15 * 60000).unref();
});
let running = false;
const jobs = setInterval(async () => {
  if (running) return;
  running = true;
  try {
    await runJobs();
  } catch (error) {
    console.error("Scheduled job failed:", error.name);
  } finally {
    running = false;
  }
}, 60000);
jobs.unref();
server.listen(config.port, config.host, () => {
  const address = server.address();
  console.log(`Lifeline API listening on ${address.address}:${address.port}`);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    clearInterval(jobs);
    io.close();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  });
