// Type definitions for AgentOracle verification receipts (spec v0.3).
//
// Spec reference: https://github.com/TKCollective/agentoracle-receipt-spec/tree/v0.3-binary-halt
// ADR-001 (binary-halt gate): https://github.com/TKCollective/agentoracle-receipt-spec/blob/v0.3-binary-halt/adr/ADR-001-binary-halt-gate.md
// ADR-002 (canonical/derived/version-bound): https://github.com/TKCollective/agentoracle-receipt-spec/blob/v0.3-binary-halt/adr/ADR-002-canonical-derived-version-binding.md

/**
 * Raw truth label produced by the verifier pipeline.
 * Signed primitive in the receipt; provenance, not the gate.
 */
export type Verdict =
  | "supported"
  | "refuted"
  | "unverifiable"
  | "unknown";

/**
 * Adversarial probe result. `not_checked` is opt-out.
 */
export type AdversarialResult =
  | "resilient"
  | "vulnerable"
  | "not_checked";

/**
 * Canonical recommendation enum. The signed input to the gate function.
 * Derived deterministically from (verdict, confidence, threshold, adversarial)
 * under the named mapping; verifiers MUST recompute and assert match.
 */
export type Recommendation =
  | "confident_supported"
  | "vulnerable_supported"
  | "weak_supported"
  | "refuted"
  | "unverifiable"
  | "error";

/**
 * Binary fail-closed gate. The signed output. Consumed by relying parties.
 * Anything other than "act" → halt.
 */
export type Gate = "act" | "halt";

/**
 * Receipt payload as it appears inside the JWS envelope.
 * All fields are signed; verifier recomputes recommendation and gate from
 * primitives under the named mapping.
 */
export interface ReceiptPayload {
  // Canonical input (signed primitives)
  v_verdict: Verdict;
  v_confidence: number;          // [0, 1]
  v_gate_threshold: number;      // [0, 1]
  v_adversarial_result: AdversarialResult;

  // Canonical recommendation (signed, derived from primitives)
  v_recommendation: Recommendation;

  // Derived output (signed, derived from recommendation under mapping)
  v_gate: Gate;

  // Binding: stable identifier of the mapping document used at issuance.
  // The mapping document is immutable after publication.
  v_gate_mapping: string;        // e.g. "v0.3.0-2026-05-30"

  // Provenance (signed, not gating)
  v_method?: string;
  v_calibration?: {
    anchor_dataset?: string;
    anchor_seed?: string;
    valid_until?: string;
  };
  v_sources_used?: string[];
  v_evidence?: string;           // optional URI pointer

  // Optional claim binding
  v_claim?: {
    text?: string;
    hash?: string;               // hex-encoded SHA-256 when text is omitted
  };

  // Standard JWT claims
  iss?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  nbf?: number;
}

/**
 * Result of receipt verification. `valid: true` iff signature checks AND
 * the recomputed recommendation and gate match the signed values under
 * the named mapping.
 */
export interface VerifyResult {
  /** Overall validity. True only if every assertion passed. */
  valid: boolean;

  /** Per-step assertions that contributed to the overall result. */
  checks: {
    signature: boolean;
    recommendationMatch: boolean;
    gateMatch: boolean;
    mappingResolved: boolean;
    notExpired: boolean;
  };

  /** The parsed (and verified, if valid) receipt payload. */
  payload?: ReceiptPayload;

  /** The mapping document used to recompute the derivation. */
  mappingId?: string;

  /** Issuer identifier from the JWS header or payload. */
  issuer?: string;

  /** First failure reason if invalid (human-readable). */
  reason?: string;
}

/**
 * Options for the verify call.
 */
export interface VerifyOptions {
  /**
   * Issuer's JWKS URL. Defaults to `${issuer}/.well-known/jwks.json`
   * when the issuer (`iss`) claim is present in the receipt.
   */
  jwksUrl?: string;

  /**
   * Override the mapping resolver. By default, uses the embedded
   * registered mappings (currently: v0.3.0-2026-05-30).
   * Provide a custom resolver to support newer mappings.
   */
  mappingResolver?: (mappingId: string) => Promise<MappingDocument | null>;

  /**
   * Maximum acceptable clock skew when validating exp/nbf (seconds).
   * Defaults to 30 seconds.
   */
  clockToleranceSeconds?: number;

  /**
   * Pass an explicit list of trusted JWKS to skip remote fetch.
   * Useful for air-gapped verification and tests.
   */
  trustedKeys?: JsonWebKeySet;
}

export interface JsonWebKeySet {
  keys: JsonWebKey[];
}

/**
 * Machine-readable form of a published mapping document.
 *
 * The canonical published form is the immutable markdown document at
 * mappings/<id>.md in the receipt-spec repository. This interface is the
 * structured form the verifier consumes; it MUST agree with the markdown.
 */
export interface MappingDocument {
  /** Stable identifier, e.g. "v0.3.0-2026-05-30". Immutable after publication. */
  id: string;

  /**
   * Recommendation derivation rules.
   * Returns the canonical recommendation given the signed primitives.
   */
  deriveRecommendation: (input: {
    verdict: Verdict;
    confidence: number;
    threshold: number;
    adversarial: AdversarialResult;
  }) => Recommendation;

  /**
   * Gate derivation rules.
   * Returns the binary act/halt gate given the recommendation.
   */
  deriveGate: (recommendation: Recommendation) => Gate;

  /** Optional human-readable mapping document URL. */
  documentUrl?: string;
}
