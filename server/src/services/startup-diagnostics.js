import { isIP } from "node:net";

const identifier = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(value)
    ? value
    : undefined;
const errorCode = (value) =>
  Number.isInteger(value) ? value : identifier(value);

export async function reportMongoStartupFailure(
  error,
  uri,
  {
    render = process.env.RENDER === "true",
    log = console.error,
    fetchIP = globalThis.fetch,
  } = {},
) {
  let cluster;
  try {
    cluster = new URL(uri).hostname;
  } catch {
    // Invalid URIs can contain credentials in their error messages.
  }
  const servers = [...(error.reason?.servers?.values() || [])];
  const codes = [
    error.code,
    error.cause?.code,
    ...servers.flatMap((server) => [
      server.error?.code,
      server.error?.cause?.code,
    ]),
  ];
  log(
    "MongoDB startup diagnostics:",
    JSON.stringify({
      node: process.version,
      cluster,
      errorType: identifier(error.name),
      errorCodes: [
        ...new Set(codes.map(errorCode).filter((v) => v !== undefined)),
      ],
    }),
  );
  if (!render) return;
  try {
    const response = await fetchIP("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("IP lookup failed");
    const { ip } = await response.json();
    if (isIP(ip) !== 4) throw new Error("Invalid IPv4 response");
    log("Render observed outbound IPv4:", ip);
  } catch {
    log("Render outbound IPv4 lookup unavailable.");
  }
  log(
    "Check this service's complete Connect > Outbound ranges against the database IP Access List in the Atlas project containing the cluster above. HTTPS and database traffic may use different addresses within those ranges.",
  );
}
