// scripts/test_phase5_tool_router.mjs
/**
 * Test script to verify Phase 5 Tool Router:
 * 1. Action permissions gating (permitted vs forbidden tools per tenant)
 * 2. Idempotency enforcement (preventing duplicate lead generation on double-clicks)
 * 3. Execution of mock `create_service_request`
 */

import { executeAction, isToolPermittedForTenant } from "../src/lib/toolRouter.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Testing Phase 5: Tool Registry & Action Router");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  // Mock Tenant 1: Permitted only service requests (Cool Breeze policy)
  const tenantRestricted = {
    tenant_id: "tenant_cool_breeze_02",
    name: "Cool Breeze Heating",
    client_config: {
      actions: ["create_service_request"],
      booking_rules: { allow_direct_booking: false },
    },
  };

  // Mock Tenant 2: Full enterprise actions (Apex Air policy)
  const tenantFull = {
    tenant_id: "tenant_apex_air_01",
    name: "Apex Air Solutions",
    client_config: {
      actions: ["create_service_request", "create_booking"],
      booking_rules: { allow_direct_booking: true },
    },
  };

  // Mock Session
  const session = {
    session_id: `test_sess_${Date.now()}`,
    current_state: "QUALIFYING",
    context: {},
  };

  // Mock ApiLogger
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  // TEST 1: Tenant Permission Gating - Forbidden Tool
  console.log("Test 1: Tenant Permission Gating (Forbidden Action)...");
  const forbiddenResult = await executeAction({
    toolName: "create_booking",
    toolArgs: { name: "Bob", date: "Oct 24, 2026", time: "10:00 AM" },
    tenant: tenantRestricted,
    session,
    apiLogger: mockLogger,
  });

  if (forbiddenResult.error === "TOOL_NOT_PERMITTED" && forbiddenResult.success === false) {
    console.log("✅ PASS: Blocked unpermitted tool 'create_booking' for restricted tenant.\n");
    passed++;
  } else {
    console.error("❌ FAIL: Tool should have been blocked:", forbiddenResult);
    failed++;
  }

  // TEST 2: Tenant Permission Gating - Allowed Tool Execution
  console.log("Test 2: Tenant Permission Gating & Mock Execution (Permitted Action)...");
  const testArgs = {
    name: "Alice Johnson",
    phone: "555-0199",
    email: "alice@test.com",
    category: "ac_repair",
    problem_description: "AC blowing lukewarm air during summer heat",
    urgency: "High",
  };

  const allowedResult = await executeAction({
    toolName: "create_service_request",
    toolArgs: testArgs,
    tenant: tenantRestricted,
    session,
    apiLogger: mockLogger,
  });

  if (allowedResult.success === true && allowedResult.service_request_id && allowedResult.idempotency_key) {
    console.log(`✅ PASS: Service request created successfully (#${allowedResult.service_request_id}).\n`);
    passed++;
  } else {
    console.error("❌ FAIL: Service request failed:", allowedResult);
    failed++;
  }

  // TEST 3: Idempotency Enforcement (Replay with same idempotency key)
  console.log("Test 3: Idempotency Enforcement (Duplicate Prevention)...");
  const replayResult = await executeAction({
    toolName: "create_service_request",
    toolArgs: testArgs,
    tenant: tenantRestricted,
    session,
    apiLogger: mockLogger,
    idempotencyKey: allowedResult.idempotency_key, // Exact same idempotency key
  });

  if (replayResult.is_idempotent_replay === true && replayResult.service_request_id === allowedResult.service_request_id) {
    console.log("✅ PASS: Idempotency key matched! Cached result returned without duplicate DB writes.\n");
    passed++;
  } else {
    console.error("❌ FAIL: Idempotency replay did not return cached result:", replayResult);
    failed++;
  }

  console.log(`=================================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`=================================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
