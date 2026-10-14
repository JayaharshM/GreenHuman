import { describe, it, expect, vi } from "vitest";
import { reportMongoStartupFailure } from "../src/services/startup-diagnostics.js";

const uri =
  "mongodb+srv://private-user:private-password@cluster0.example.mongodb.net/lifeline";
const failure = () =>
  Object.assign(new Error(`Failed to connect to ${uri}`), {
    name: "MongooseServerSelectionError",
    reason: {
      servers: new Map([
        [
          "cluster-node:27017",
          { error: { cause: { code: "ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR" } } },
        ],
      ]),
    },
  });

describe("MongoDB startup diagnostics", () => {
  it("reports the cluster and TLS code without exposing credentials or contacting an IP service locally", async () => {
    const log = vi.fn();
    const fetchIP = vi.fn();
    await reportMongoStartupFailure(failure(), uri, {
      render: false,
      log,
      fetchIP,
    });
    const output = JSON.stringify(log.mock.calls);
    expect(output).toContain("cluster0.example.mongodb.net");
    expect(output).toContain("ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR");
    expect(output).not.toContain("private-user");
    expect(output).not.toContain("private-password");
    expect(fetchIP).not.toHaveBeenCalled();
  });

  it("reports Render's observed IPv4 without sending the database URI to the IP service", async () => {
    const log = vi.fn();
    const fetchIP = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: "74.220.52.10" }),
    });
    await reportMongoStartupFailure(failure(), uri, {
      render: true,
      log,
      fetchIP,
    });
    expect(log).toHaveBeenCalledWith(
      "Render observed outbound IPv4:",
      "74.220.52.10",
    );
    expect(JSON.stringify(fetchIP.mock.calls)).not.toContain("private-");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-");
  });

  it("preserves authentication error codes and safely handles an unparseable URI", async () => {
    const log = vi.fn();
    await reportMongoStartupFailure(
      Object.assign(new Error(uri), { code: 18 }),
      `"${uri}"`,
      { render: false, log },
    );
    expect(JSON.parse(log.mock.calls[0][1]).errorCodes).toEqual([18]);
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-");
  });

  it("handles unavailable or malformed IP responses without printing their bodies", async () => {
    for (const fetchIP of [
      vi.fn().mockRejectedValue(new Error(uri)),
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ip: uri }),
      }),
    ]) {
      const log = vi.fn();
      await reportMongoStartupFailure(failure(), uri, {
        render: true,
        log,
        fetchIP,
      });
      expect(log).toHaveBeenCalledWith(
        "Render outbound IPv4 lookup unavailable.",
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-");
    }
  });
});
