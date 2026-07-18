// SEMA-GOVERNED: sema.showcase.build_week_2026.demo
// Contract: contratos/sema/build_week_demo.sema
// Final implementation after the semantic rename is completed.

export function confirmPayment({ payment_id, amount_cents }) {
  if (typeof payment_id !== "string" || payment_id.trim() === "") {
    throw new TypeError("payment_id must be a non-empty string");
  }

  if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
    throw new TypeError("amount_cents must be a positive integer");
  }

  return {
    approved: true,
    receipt_id: `receipt_${payment_id}_${amount_cents}`,
  };
}
