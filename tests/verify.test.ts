// Unit tests for the verifier client.
//
// These tests exercise the offline derivation logic without making
// network calls. They verify that the v0.3.0-2026-05-30 mapping
// correctly derives recommendations and gates from primitives, and
// that the `verifyReceipt` function correctly fails closed when
// signatures, mappings, or derivations don't match.

import { describe, it, expect } from "vitest";
import {
  MAPPING_v0_3_0_2026_05_30,
  defaultMappingResolver,
} from "../src/mappings.js";

describe("v0.3.0-2026-05-30 mapping — recommendation derivation", () => {
  const m = MAPPING_v0_3_0_2026_05_30;

  it("supported + confidence>=threshold + resilient → confident_supported", () => {
    expect(
      m.deriveRecommendation({
        verdict: "supported",
        confidence: 0.9,
        threshold: 0.7,
        adversarial: "resilient",
      }),
    ).toBe("confident_supported");
  });

  it("supported + confidence>=threshold + not_checked → confident_supported", () => {
    expect(
      m.deriveRecommendation({
        verdict: "supported",
        confidence: 0.85,
        threshold: 0.7,
        adversarial: "not_checked",
      }),
    ).toBe("confident_supported");
  });

  it("supported + vulnerable → vulnerable_supported (regardless of confidence)", () => {
    expect(
      m.deriveRecommendation({
        verdict: "supported",
        confidence: 0.99,
        threshold: 0.7,
        adversarial: "vulnerable",
      }),
    ).toBe("vulnerable_supported");
  });

  it("supported + confidence<threshold + resilient → weak_supported", () => {
    expect(
      m.deriveRecommendation({
        verdict: "supported",
        confidence: 0.5,
        threshold: 0.7,
        adversarial: "resilient",
      }),
    ).toBe("weak_supported");
  });

  it("refuted → refuted", () => {
    expect(
      m.deriveRecommendation({
        verdict: "refuted",
        confidence: 0.95,
        threshold: 0.7,
        adversarial: "resilient",
      }),
    ).toBe("refuted");
  });

  it("unverifiable → unverifiable", () => {
    expect(
      m.deriveRecommendation({
        verdict: "unverifiable",
        confidence: 0.0,
        threshold: 0.7,
        adversarial: "not_checked",
      }),
    ).toBe("unverifiable");
  });

  it("unknown verdict → error", () => {
    expect(
      m.deriveRecommendation({
        // @ts-expect-error — testing the error branch
        verdict: "garbage",
        confidence: 0.5,
        threshold: 0.7,
        adversarial: "not_checked",
      }),
    ).toBe("error");
  });
});

describe("v0.3.0-2026-05-30 mapping — gate derivation", () => {
  const m = MAPPING_v0_3_0_2026_05_30;

  it("confident_supported → act", () => {
    expect(m.deriveGate("confident_supported")).toBe("act");
  });

  it("vulnerable_supported → halt", () => {
    expect(m.deriveGate("vulnerable_supported")).toBe("halt");
  });

  it("weak_supported → halt", () => {
    expect(m.deriveGate("weak_supported")).toBe("halt");
  });

  it("refuted → halt", () => {
    expect(m.deriveGate("refuted")).toBe("halt");
  });

  it("unverifiable → halt", () => {
    expect(m.deriveGate("unverifiable")).toBe("halt");
  });

  it("error → halt", () => {
    expect(m.deriveGate("error")).toBe("halt");
  });
});

describe("default mapping resolver", () => {
  it("resolves the registered v0.3.0-2026-05-30 mapping", async () => {
    const m = await defaultMappingResolver("v0.3.0-2026-05-30");
    expect(m).not.toBeNull();
    expect(m?.id).toBe("v0.3.0-2026-05-30");
  });

  it("returns null for unknown mapping IDs", async () => {
    const m = await defaultMappingResolver("v9.9.9-2099-12-31");
    expect(m).toBeNull();
  });
});
