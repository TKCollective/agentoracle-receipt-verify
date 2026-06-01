// Minimal example: verify a receipt issued by agentoracle.co.
//
// Run:  npx tsx examples/verify-receipt.ts <jws-receipt>
//
// Or, with a receipt fetched from the API:
//   curl -s https://agentoracle.co/evaluate -H 'content-type: application/json' \
//     -d '{"claim":"The capital of France is Paris"}' \
//     | jq -r .receipt \
//     | xargs npx tsx examples/verify-receipt.ts

import { verifyReceipt } from "../src/index.js";

const receipt = process.argv[2];
if (!receipt) {
  console.error("Usage: verify-receipt.ts <jws-receipt>");
  process.exit(2);
}

const result = await verifyReceipt(receipt);

if (result.valid) {
  console.log("✅ Receipt valid");
  console.log(`   Issuer:         ${result.issuer}`);
  console.log(`   Mapping:        ${result.mappingId}`);
  console.log(`   Verdict (raw):  ${result.payload?.v_verdict}`);
  console.log(`   Recommendation: ${result.payload?.v_recommendation}`);
  console.log(`   Gate:           ${result.payload?.v_gate}`);
  console.log(`   Confidence:     ${result.payload?.v_confidence}`);
  process.exit(0);
} else {
  console.error("❌ Receipt invalid");
  console.error(`   Reason: ${result.reason}`);
  console.error("   Checks:");
  for (const [k, v] of Object.entries(result.checks)) {
    console.error(`     - ${k}: ${v ? "pass" : "FAIL"}`);
  }
  process.exit(1);
}
