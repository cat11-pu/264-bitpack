// app.js：渲染结果
import { maxValue, appendBits } from "./bits.js";
import { step, close } from "./packrun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      bytes: state.bytes, acc: state.acc, used: state.used, names: state.names,
      pending: state.pending.map(function (row) { return row.join(":"); }),
      applied: state.applied.length
    });
  };
  const hex = function (bytes) {
    return bytes.map(function (byte) {
      const text = byte.toString(16);
      return text.length === 1 ? "0" + text : text;
    }).join(" ");
  };
  return { hex: hex(closed.state.bytes), bytes: closed.state.bytes,
           tail_bits: closed.state.used, packed_first: first.packed, packed_wide: wide.packed,
           pair_differs: first.packed !== wide.packed,
           pending_before: first.pending_before, pending_fields: first.pending_fields,
           catchup: closed.catchup, pending_after: closed.state.pending.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.packed, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count: events.length, tail: maxValue(3) > 7 ? 1 : 0 };
}
