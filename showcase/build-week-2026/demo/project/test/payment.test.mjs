// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Executable evidence for approve_payment and its receipt_id guarantee.

import assert from "node:assert/strict";
import test from "node:test";

import { confirmPayment } from "../src/payment.mjs";

test("approve_payment returns the contracted receipt_id", () => {
  const result = confirmPayment({
    payment_id: "pay_demo_2026",
    amount_cents: 4200,
  });

  assert.deepEqual(result, {
    approved: true,
    receipt_id: "receipt_pay_demo_2026_4200",
  });
});

test("approve_payment rejects a non-positive amount", () => {
  assert.throws(
    () => confirmPayment({ payment_id: "pay_demo_2026", amount_cents: 0 }),
    /positive integer/,
  );
});
