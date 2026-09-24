import { describe, it, expect, vi, afterEach } from "vitest";
import { scValToNative } from "@stellar/stellar-sdk";
import { VestflowClient } from "../src/client";
import { TOTAL_SPLITS_WEIGHT } from "../src/types";

// Real, checksum-valid addresses (see give.test.ts for why FALLBACK_ACCOUNT
// is not usable here).
const ACCOUNT = "GDZ2GDLBPUCEXA3I5U7WN5E3CNQ3JBP5FK464EMLTHPCX6KVB5N4A4YT";
const RECEIVER_A = "GA64S64HF7NNWH337Y35EC4SYZHNU72IZQDV7ORJZWD7WXMYZ3J4FK3E";
const CONTRACT_RECEIVER = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const signer = vi.fn();

function mockSubmitAndSettle(client: VestflowClient) {
  return vi
    .spyOn(client as any, "submitAndSettle")
    .mockResolvedValue({ hash: "abc123", status: "SUCCESS" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("setSplits (#681)", () => {
  it("submits set_splits with a valid config and returns TransactionResult", async () => {
    const client = new VestflowClient({ network: "testnet" });
    const spy = mockSubmitAndSettle(client);

    const receivers = [
      { address: RECEIVER_A, weightBps: 6_000 },
      { address: CONTRACT_RECEIVER, weightBps: 4_000 },
    ];

    const result = await client.setSplits(ACCOUNT, receivers, signer);

    expect(result).toEqual({ hash: "abc123", status: "SUCCESS" });
    expect(spy).toHaveBeenCalledWith(ACCOUNT, "set_splits", expect.any(Array), signer);

    // Verify the encoded args: the account, then the typed receivers vector.
    const [source, method, args] = spy.mock.calls[0];
    expect(source).toBe(ACCOUNT);
    expect(method).toBe("set_splits");
    expect(scValToNative(args[0])).toBe(ACCOUNT);
    expect(scValToNative(args[1])).toEqual([
      { receiver: RECEIVER_A, weight_bps: 6_000 },
      { receiver: CONTRACT_RECEIVER, weight_bps: 4_000 },
    ]);
  });

  it("accepts a single receiver holding the full TOTAL_SPLITS_WEIGHT", async () => {
    const client = new VestflowClient({ network: "testnet" });
    const spy = mockSubmitAndSettle(client);

    const result = await client.setSplits(
      ACCOUNT,
      [{ address: RECEIVER_A, weightBps: TOTAL_SPLITS_WEIGHT }],
      signer
    );

    expect(result.status).toBe("SUCCESS");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects weights that do not sum to TOTAL_SPLITS_WEIGHT", async () => {
    const client = new VestflowClient({ network: "testnet" });
    const spy = mockSubmitAndSettle(client);

    await expect(
      client.setSplits(
        ACCOUNT,
        [
          { address: RECEIVER_A, weightBps: 5_000 },
          { address: CONTRACT_RECEIVER, weightBps: 4_000 },
        ],
        signer
      )
    ).rejects.toThrow(/TOTAL_SPLITS_WEIGHT/);

    await expect(
      client.setSplits(
        ACCOUNT,
        [
          { address: RECEIVER_A, weightBps: 7_000 },
          { address: CONTRACT_RECEIVER, weightBps: 7_000 },
        ],
        signer
      )
    ).rejects.toThrow(/TOTAL_SPLITS_WEIGHT/);

    await expect(client.setSplits(ACCOUNT, [], signer)).rejects.toThrow(
      /TOTAL_SPLITS_WEIGHT/
    );

    // Nothing was submitted for any invalid configuration.
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects invalid receiver addresses and negative/non-integer weights", async () => {
    const client = new VestflowClient({ network: "testnet" });
    const spy = mockSubmitAndSettle(client);

    await expect(
      client.setSplits(ACCOUNT, [{ address: "not-an-address", weightBps: 10_000 }], signer)
    ).rejects.toThrow(/Stellar address/);

    await expect(
      client.setSplits(ACCOUNT, [{ address: RECEIVER_A, weightBps: -10_000 }], signer)
    ).rejects.toThrow(/weightBps/);

    await expect(
      client.setSplits(ACCOUNT, [{ address: RECEIVER_A, weightBps: 9_999.5 }], signer)
    ).rejects.toThrow(/weightBps/);

    expect(spy).not.toHaveBeenCalled();
  });
});
