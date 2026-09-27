> **Archived, September 2026.** Superseded by [tanilo-receipt-verify](https://github.com/TKCollective/tanilo-receipt-verify) (PyPI `tanilo-receipt-verify`, 0.1.1). This repository holds the history of `agentoracle-receipt-verify` 0.1.0 and receives no further updates; the published 0.1.0 package is unchanged.

# @agentoracle/receipt-verify

[![npm](https://img.shields.io/npm/v/@agentoracle/receipt-verify)](https://www.npmjs.com/package/@agentoracle/receipt-verify)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Spec: v0.3](https://img.shields.io/badge/receipt--spec-v0.3-1f6feb)](https://github.com/TKCollective/agentoracle-receipt-spec/tree/v0.3-binary-halt)

**Offline verifier for AgentOracle JWS verification receipts.** Verify the gate decision was correctly derived from signed inputs under a named, immutable mapping — without trusting the issuer's runtime.

This is the reference verifier client for [AgentOracle receipt spec v0.3](https://github.com/TKCollective/agentoracle-receipt-spec/tree/v0.3-binary-halt) (binary-halt gate, canonical/derived/version-bound mapping). MIT licensed. No dependency on AgentOracle's servers at verification time.

## Why this exists

Verification receipts that you have to take an issuer's word for aren't really receipts. The whole point of the v0.3 spec is that a third party — auditor, regulator, downstream relying party — can independently verify that the gate decision in a receipt was correctly derived from its signed inputs under a versioned, immutable ruleset. This package is the canonical implementation of that protocol.

The design property: **the verifier never trusts the issuer's runtime.** The signature binds inputs, outputs, and mapping identifier together; the verifier recomputes locally.

## Install

```bash
npm install @agentoracle/receipt-verify
```

```bash
pnpm add @agentoracle/receipt-verify
```

```bash
yarn add @agentoracle/receipt-verify
```

## Quick start

```typescript
import { verifyReceipt } from "@agentoracle/receipt-verify";

const result = await verifyReceipt(receipt);

if (result.valid && result.payload?.v_gate === "act") {
  // Safe to proceed. Recommendation, gate, and mapping all verified.
} else {
  // Halt. Inspect result.reason for diagnostic detail.
  console.error(`Receipt invalid: ${result.reason}`);
}
```

That's it. The verifier:

1. Verifies the JWS signature using the issuer's published JWKS.
2. Resolves `v_gate_mapping` to the named immutable mapping document.
3. Recomputes the recommendation from signed primitives.
4. Asserts it matches the signed recommendation.
5. Computes the gate from the recommendation under the mapping.
6. Asserts it matches the signed gate.

Any failure → `valid: false` with a human-readable reason.

## Verification protocol (per ADR-002)

```
1. Verify JWS signature against issuer's published JWKS (RFC 7515).
2. Resolve v_gate_mapping → fetch the named immutable mapping document.
3. Recompute candidate_recommendation from
   (v_verdict, v_confidence, v_gate_threshold, v_adversarial_result)
   using the mapping's rules.
4. Confirm candidate_recommendation == v_recommendation.
5. Compute candidate_gate = mapping(v_recommendation).
6. Confirm candidate_gate == v_gate.
7. If all match → receipt is valid AND internally consistent under mapping.
   Any mismatch → malformed receipt; treat as halt.
```

## API

### `verifyReceipt(receipt: string, options?: VerifyOptions): Promise<VerifyResult>`

Verifies a JWS-encoded receipt and returns the result.

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `jwksUrl` | `string` | `${iss}/.well-known/jwks.json` | Override the JWKS endpoint. |
| `mappingResolver` | `(id: string) => Promise<MappingDocument \| null>` | Built-in resolver | Supply a custom resolver to support newer mappings. |
| `clockToleranceSeconds` | `number` | `30` | Clock skew tolerance for `exp` / `nbf` validation. |
| `trustedKeys` | `JsonWebKeySet` | — | Pre-supplied JWKS to skip remote fetch (air-gapped verification). |

**Result:**

```typescript
interface VerifyResult {
  valid: boolean;
  checks: {
    signature: boolean;
    recommendationMatch: boolean;
    gateMatch: boolean;
    mappingResolved: boolean;
    notExpired: boolean;
  };
  payload?: ReceiptPayload;
  mappingId?: string;
  issuer?: string;
  reason?: string;       // populated on failure
}
```

## Receipt shape (v0.3)

The receipt payload signs three structurally distinct field groups plus their bindings:

```json
{
  "v_verdict": "supported",
  "v_confidence": 0.87,
  "v_gate_threshold": 0.70,
  "v_adversarial_result": "resilient",
  "v_recommendation": "confident_supported",
  "v_gate": "act",
  "v_gate_mapping": "v0.3.0-2026-05-30",

  "v_method": "agentoracle-pipeline-v2.2",
  "v_calibration": { "anchor_dataset": "averitec", "anchor_seed": "...", "valid_until": "..." },
  "v_sources_used": ["sonar", "adversarial"],

  "iss": "agentoracle.co",
  "sub": "agent-id",
  "iat": 1748730000,
  "exp": 1748733600
}
```

Wrapped in a JWS envelope (RFC 7515). See [the receipt spec](https://github.com/TKCollective/agentoracle-receipt-spec/tree/v0.3-binary-halt) for the full normative definition.

## Custom mapping resolvers

When new mappings ship (e.g. `v0.4.0-...`), you can supply a custom resolver to support them without upgrading this package:

```typescript
import { verifyReceipt, REGISTERED_MAPPINGS } from "@agentoracle/receipt-verify";

const result = await verifyReceipt(receipt, {
  mappingResolver: async (id) => {
    if (id === "v0.4.0-2026-09-15") {
      return MY_CUSTOM_v0_4_MAPPING;
    }
    return REGISTERED_MAPPINGS[id] ?? null;
  },
});
```

Mapping documents are immutable after publication; receipts signed under any previously-published mapping continue to validate against the original rules forever.

## Air-gapped verification

For environments without internet access at verification time, supply a pre-fetched JWKS:

```typescript
const TRUSTED_JWKS = { keys: [/* fetch and store these out-of-band */] };

const result = await verifyReceipt(receipt, {
  trustedKeys: TRUSTED_JWKS,
});
```

The verifier will skip the remote JWKS fetch and use the supplied keys.

## Compliance positioning

The receipt format produced by AgentOracle and verified by this package is designed to support specific evidence requirements named by Anthropic's *Zero Trust for AI Agents* framework (Phase 8: Decision Explainability) and to satisfy the traceability and reconstructability requirements of EU AI Act Article 12 for high-risk AI systems.

This package is the open-source verifier — auditors, regulators, and downstream relying parties can use it to independently validate any AgentOracle-issued receipt without depending on AgentOracle's infrastructure.

## Development

```bash
npm install
npm run build
npm test
```

## Specification & references

- **Receipt spec v0.3** (binary-halt): https://github.com/TKCollective/agentoracle-receipt-spec/tree/v0.3-binary-halt
- **ADR-001** (binary-halt gate): https://github.com/TKCollective/agentoracle-receipt-spec/blob/v0.3-binary-halt/adr/ADR-001-binary-halt-gate.md
- **ADR-002** (canonical/derived/version-bound): https://github.com/TKCollective/agentoracle-receipt-spec/blob/v0.3-binary-halt/adr/ADR-002-canonical-derived-version-binding.md
- **Mapping v0.3.0-2026-05-30**: https://github.com/TKCollective/agentoracle-receipt-spec/blob/v0.3-binary-halt/mappings/v0.3.0-2026-05-30.md
- **Eval harness** (MIT, reproduces 57.6% AVeriTeC): https://github.com/TKCollective/agentoracle-eval-harness
- **Live API**: https://agentoracle.co
- **IETF Internet-Draft** (in active preparation, target submission June 2026): `draft-krausz-verification-state-00`

## License

MIT © TKCollective. See [LICENSE](./LICENSE).
