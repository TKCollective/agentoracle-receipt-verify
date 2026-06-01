// Core verification logic for AgentOracle JWS receipts (spec v0.3).
//
// Verification protocol (per ADR-002):
//
//   1. Verify JWS signature against the issuer's published JWKS.
//   2. Resolve `v_gate_mapping` to the named, immutable mapping document.
//   3. Recompute candidate_recommendation from the signed primitives.
//   4. Assert candidate_recommendation == receipt.v_recommendation.
//   5. Compute candidate_gate = mapping(recommendation).
//   6. Assert candidate_gate == receipt.v_gate.
//
// Any failure → receipt is malformed; relying parties MUST treat the
// decision as `halt`.

import {
  jwtVerify,
  createRemoteJWKSet,
  createLocalJWKSet,
  type JWTVerifyResult,
} from "jose";
import type {
  ReceiptPayload,
  VerifyOptions,
  VerifyResult,
} from "./types.js";
import { defaultMappingResolver } from "./mappings.js";

/**
 * Verify an AgentOracle JWS receipt offline.
 *
 * @param receipt   The JWS-encoded receipt string (compact serialization).
 * @param options   Optional overrides (custom JWKS URL, mapping resolver, etc.).
 * @returns         A VerifyResult. Inspect `.valid` for the overall outcome.
 *
 * @example
 *   import { verifyReceipt } from "@agentoracle/receipt-verify";
 *
 *   const result = await verifyReceipt(receipt);
 *   if (result.valid && result.payload?.v_gate === "act") {
 *     // safe to proceed
 *   } else {
 *     // halt — log result.reason for diagnostics
 *   }
 */
export async function verifyReceipt(
  receipt: string,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const checks = {
    signature: false,
    recommendationMatch: false,
    gateMatch: false,
    mappingResolved: false,
    notExpired: false,
  };

  // ---------------------------------------------------------------- step 1
  // JWS signature verification. We resolve the JWKS either from the
  // explicit option, a derived `${iss}/.well-known/jwks.json`, or a
  // pre-supplied trusted key set.
  let verifyResult: JWTVerifyResult;
  let payload: ReceiptPayload;
  let issuer: string | undefined;
  try {
    // First parse the payload without verification to extract `iss`.
    const peeked = peekPayload(receipt);
    issuer = peeked.iss;

    const jwks = options.trustedKeys
      ? createLocalJWKSet(options.trustedKeys)
      : createRemoteJWKSet(
          new URL(
            options.jwksUrl ??
              (issuer
                ? new URL("/.well-known/jwks.json", issuer).toString()
                : ""),
          ),
        );

    verifyResult = await jwtVerify(receipt, jwks, {
      clockTolerance: options.clockToleranceSeconds ?? 30,
    });
    payload = verifyResult.payload as unknown as ReceiptPayload;
    checks.signature = true;
    checks.notExpired = true;
  } catch (err) {
    return {
      valid: false,
      checks,
      issuer,
      reason: `signature verification failed: ${(err as Error).message}`,
    };
  }

  // ---------------------------------------------------------------- step 2
  // Resolve the named mapping document. Mappings are immutable; an
  // unknown mapping ID is a malformed-receipt condition.
  const resolver = options.mappingResolver ?? defaultMappingResolver;
  const mapping = await resolver(payload.v_gate_mapping);
  if (!mapping) {
    return {
      valid: false,
      checks,
      payload,
      issuer,
      reason: `unknown mapping: ${payload.v_gate_mapping}. Supply a custom mappingResolver if this is a newer mapping.`,
    };
  }
  checks.mappingResolved = true;

  // ---------------------------------------------------------------- step 3-4
  // Recompute the canonical recommendation from signed primitives and
  // assert it matches the receipt's signed recommendation.
  const candidateRecommendation = mapping.deriveRecommendation({
    verdict: payload.v_verdict,
    confidence: payload.v_confidence,
    threshold: payload.v_gate_threshold,
    adversarial: payload.v_adversarial_result,
  });
  if (candidateRecommendation !== payload.v_recommendation) {
    return {
      valid: false,
      checks,
      payload,
      mappingId: mapping.id,
      issuer,
      reason: `recommendation mismatch: signed=${payload.v_recommendation} computed=${candidateRecommendation}`,
    };
  }
  checks.recommendationMatch = true;

  // ---------------------------------------------------------------- step 5-6
  // Recompute the binary gate from the recommendation and assert.
  const candidateGate = mapping.deriveGate(candidateRecommendation);
  if (candidateGate !== payload.v_gate) {
    return {
      valid: false,
      checks,
      payload,
      mappingId: mapping.id,
      issuer,
      reason: `gate mismatch: signed=${payload.v_gate} computed=${candidateGate}`,
    };
  }
  checks.gateMatch = true;

  // ----------------------------------------------------------------- pass
  return {
    valid: true,
    checks,
    payload,
    mappingId: mapping.id,
    issuer,
  };
}

/**
 * Peek at a JWS payload without verifying the signature.
 * Used internally to discover the issuer for JWKS resolution. Never use
 * the returned payload for any decision — it is unverified.
 */
function peekPayload(jws: string): ReceiptPayload {
  const parts = jws.split(".");
  if (parts.length < 2) {
    throw new Error("invalid JWS: expected at least header.payload");
  }
  const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
  const decoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(padded, "base64").toString("utf-8")
      : atob(padded);
  return JSON.parse(decoded) as ReceiptPayload;
}
