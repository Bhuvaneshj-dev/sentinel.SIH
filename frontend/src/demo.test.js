import test from "node:test";
import assert from "node:assert/strict";
import { demoDecision, demoExecute, demoSample } from "./demo.js";
test("simulation is labelled and missed attack stays below threshold", () => {
  for (let i = 0; i < 100; i++) {
    const d = demoSample("missed", i);
    assert.equal(d.source, "simulation");
    assert.ok(d.risk < 0.8);
  }
});
test("approval required, expires, and cannot execute twice", () => {
  const t = { status: "pending", expires: 100 };
  assert.throws(() => demoExecute(t, 0));
  const approved = demoDecision(t, true, 0);
  assert.equal(demoExecute(approved, 0).status, "executed");
  assert.throws(() => demoExecute(approved, 100001));
  assert.throws(() => demoExecute(demoExecute(approved, 0), 0));
  assert.throws(() => demoDecision(t, true, 100001));
});
