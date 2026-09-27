import assert from "node:assert";
import { maxValue, appendBits } from "../bits.js";
import { step, close } from "../packrun.js";
import { render } from "../app.js";

const base = {
  budget: 2,
  state: { bytes: [], acc: 0, used: 0, names: [], pending: [], applied: [] },
  events: [],
  width_error_code: "E_BAD_WIDTH", value_error_code: "E_VALUE_RANGE",
  field_error_code: "E_DUPLICATE_FIELD", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("maxValue returns a number", () => {
  assert.strictEqual(typeof maxValue(3), "number");
});

check("appendBits returns a state", () => {
  assert.ok(appendBits(base.state, 1, 1) !== null);
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
