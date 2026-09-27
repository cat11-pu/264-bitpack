// packrun.js：按打包预算打包，预算用尽连名字位宽值压账，收尾不限预算清账
import { maxValue, appendBits } from "./bits.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function freshState(state) {
  const src = state || {};
  return {
    bytes: (src.bytes || []).slice(),
    acc: src.acc || 0,
    used: src.used || 0,
    names: (src.names || []).slice(),
    pending: (src.pending || []).map(function (row) { return row.slice(); }),
    applied: (src.applied || []).slice()
  };
}

function packField(state, name, width, value) {
  const next = appendBits(state, value, width);
  state.bytes = next.bytes;
  state.acc = next.acc;
  state.used = next.used;
  state.names.push(name);
  state.applied.push(name);
}

export function step(spec) {
  const state = freshState(spec.state);
  const events = spec.events || [];
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  let packed = 0;
  let judged = 0;

  const carry = [];
  for (const row of state.pending) {
    if (budget > 0) {
      packField(state, row[0], row[1], row[2]);
      budget -= 1;
      packed += 1;
    } else {
      carry.push(row);
    }
  }
  state.pending = carry;

  for (const event of events) {
    judged += 1;
    if (!event || typeof event !== "object" || event.kind !== "field"
        || typeof event.name !== "string" || event.name.length === 0
        || typeof event.width !== "number" || typeof event.value !== "number") {
      fail(spec.event_error_code || "E_BAD_EVENT", "事件不合法");
    }
    let cap;
    try {
      cap = maxValue(event.width);
    } catch (error) {
      fail(spec.width_error_code || error.code || "E_BAD_WIDTH", error.message);
    }
    if (!Number.isInteger(event.value) || event.value < 0 || event.value > cap) {
      fail(spec.value_error_code || "E_VALUE_RANGE", "值超过位宽上限");
    }
    if (state.applied.indexOf(event.name) !== -1) {
      continue;
    }
    if (state.names.indexOf(event.name) !== -1) {
      fail(spec.field_error_code || "E_DUPLICATE_FIELD", "字段名已经出现过: " + event.name);
    }
    if (budget > 0) {
      packField(state, event.name, event.width, event.value);
      budget -= 1;
      packed += 1;
    } else {
      state.pending.push([event.name, event.width, event.value]);
    }
  }

  return { state: state, packed: packed,
           pending_before: state.pending.length,
           pending_fields: state.pending.map(function (row) { return row.slice(); }),
           judged: judged, judged_bound: events.length };
}

export function close(spec) {
  const state = freshState(spec.state);
  let catchup = 0;
  for (const row of state.pending) {
    packField(state, row[0], row[1], row[2]);
    catchup += 1;
  }
  state.pending = [];
  return { state: state, catchup: catchup };
}
