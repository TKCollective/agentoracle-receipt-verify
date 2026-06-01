// @agentoracle/receipt-verify — public entry point.
//
// Offline verifier for AgentOracle JWS verification receipts (spec v0.3,
// binary-halt gate, canonical/derived/version-bound mapping).
//
// Quick start:
//
//   import { verifyReceipt } from "@agentoracle/receipt-verify";
//
//   const result = await verifyReceipt(receipt);
//   if (result.valid && result.payload?.v_gate === "act") {
//     // safe to proceed
//   } else {
//     // halt — inspect result.reason
//   }
//
// Receipt spec: https://github.com/TKCollective/agentoracle-receipt-spec/tree/v0.3-binary-halt

export { verifyReceipt } from "./verify.js";
export {
  MAPPING_v0_3_0_2026_05_30,
  REGISTERED_MAPPINGS,
  defaultMappingResolver,
} from "./mappings.js";
export type {
  Verdict,
  AdversarialResult,
  Recommendation,
  Gate,
  ReceiptPayload,
  VerifyResult,
  VerifyOptions,
  MappingDocument,
  JsonWebKeySet,
} from "./types.js";
