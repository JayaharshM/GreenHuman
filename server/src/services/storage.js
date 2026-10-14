import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "../config.js";
const bucket = process.env.S3_BUCKET;
const client = bucket
  ? new S3Client({
      region: process.env.S3_REGION || "auto",
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      ...(process.env.S3_ACCESS_KEY_ID
        ? {
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    })
  : null;
export async function saveFile(key, bytes, mime) {
  if (client) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: mime,
      }),
    );
    return;
  }
  await fs.mkdir(config.uploads, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(config.uploads, key), bytes, { mode: 0o600 });
}
export async function serveFile(res, key, mime, { download = false } = {}) {
  res.set({
    "Content-Type": mime,
    "Cache-Control": "no-store",
    ...(download
      ? {
          "Content-Disposition": `attachment; filename="verification.${mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg"}"`,
        }
      : {}),
  });
  if (client) {
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    object.Body.pipe(res);
    return;
  }
  res.sendFile(path.join(config.uploads, key), { dotfiles: "allow" });
}
