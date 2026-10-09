// Deterministic presentation scenarios. These are not detector predictions.
export const scenarios = {
  impersonation: {
    title: "Voice impersonation",
    description:
      "A caller requests an urgent ₹8 lakh transfer. Simulated risk rises as the call continues.",
    points: [
      0.12, 0.16, 0.14, 0.22, 0.31, 0.48, 0.69, 0.84, 0.91, 0.94, 0.89, 0.93,
    ],
  },
  genuine: {
    title: "Routine finance call",
    description:
      "A low-risk scenario still requires independent transaction approval.",
    points: [
      0.12, 0.09, 0.15, 0.11, 0.08, 0.13, 0.1, 0.16, 0.12, 0.09, 0.11, 0.08,
    ],
  },
  missed: {
    title: "Detector misses the attack",
    description:
      "A deliberately low simulated score shows why voice alone must never authorize a transfer.",
    points: [
      0.08, 0.11, 0.14, 0.12, 0.16, 0.14, 0.18, 0.16, 0.12, 0.15, 0.18, 0.13,
    ],
  },
};
export function demoSample(scenario, tick) {
  const points = scenarios[scenario].points;
  return {
    risk: points[Math.min(Math.floor(tick / 5), points.length - 1)],
    source: "simulation",
    status: "monitoring",
    inference_ms: null,
  };
}
export function demoDecision(transfer, approve, now = Date.now()) {
  if (transfer.status !== "pending" || transfer.expires * 1000 <= now)
    throw new Error("Transfer is expired or already decided.");
  return {
    ...transfer,
    status: approve ? "approved" : "rejected",
    approved_by: "demo-approver",
  };
}
export function demoExecute(transfer, now = Date.now()) {
  if (transfer.status !== "approved" || transfer.expires * 1000 <= now)
    throw new Error("Independent, unexpired approval is required.");
  return { ...transfer, status: "executed" };
}
