// Registered, immutable mapping documents.
//
// Each mapping document defines (a) how the canonical recommendation is
// derived from signed primitives, and (b) how the binary gate is derived
// from the recommendation. Mapping documents are IMMUTABLE after
// publication. New rules ship as new mapping IDs (e.g. v0.4.0-...);
// receipts signed under a previous mapping ID continue to validate
// against the original document forever.
//
// Canonical published source (markdown):
//   https://github.com/TKCollective/agentoracle-receipt-spec/tree/v0.3-binary-halt/mappings

import type {
  MappingDocument,
  Verdict,
  AdversarialResult,
  Recommendation,
  Gate,
} from "./types.js";

/**
 * Mapping document v0.3.0-2026-05-30.
 * First published mapping under the binary-halt collapse (ADR-001) and
 * canonical/derived/version-bound model (ADR-002).
 */
export const MAPPING_v0_3_0_2026_05_30: MappingDocument = {
  id: "v0.3.0-2026-05-30",
  documentUrl:
    "https://github.com/TKCollective/agentoracle-receipt-spec/blob/v0.3-binary-halt/mappings/v0.3.0-2026-05-30.md",
  deriveRecommendation: ({ verdict, confidence, threshold, adversarial }) => {
    const v = verdict?.toLowerCase() as Verdict;
    const a = adversarial?.toLowerCase() as AdversarialResult;
    if (v === "supported") {
      if (a === "vulnerable") return "vulnerable_supported";
      if (confidence >= threshold) return "confident_supported";
      return "weak_supported";
    }
    if (v === "refuted") return "refuted";
    if (v === "unverifiable" || v === "unknown") return "unverifiable";
    return "error";
  },
  deriveGate: (recommendation: Recommendation): Gate => {
    return recommendation === "confident_supported" ? "act" : "halt";
  },
};

/**
 * Built-in registry of known mapping documents.
 * Exported for inspection and to allow custom resolvers to compose
 * with the defaults.
 */
export const REGISTERED_MAPPINGS: Record<string, MappingDocument> = {
  [MAPPING_v0_3_0_2026_05_30.id]: MAPPING_v0_3_0_2026_05_30,
};

/**
 * Default mapping resolver. Looks up the requested mapping ID in the
 * built-in registry. Returns null when the mapping is not registered;
 * callers SHOULD treat this as a malformed receipt (gate → halt).
 *
 * To support newer mappings without upgrading this package, supply a
 * custom resolver via `verifyReceipt(receipt, { mappingResolver })`.
 */
export async function defaultMappingResolver(
  mappingId: string,
): Promise<MappingDocument | null> {
  return REGISTERED_MAPPINGS[mappingId] ?? null;
}
