// packrun.js：按打包预算打包，用尽预算的字段压在账上，收尾不限预算清账
import { maxValue, appendBits } from "./bits.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codeFor(spec, key, fallback) {
  return spec && typeof spec[key] === "string" ? spec[key] : fallback;
}

function freshState(source) {
  source = source || {};
  return {
    bytes: Array.isArray(source.bytes) ? source.bytes.slice() : [],
    acc: Number.isInteger(source.acc) ? source.acc : 0,
    used: Number.isInteger(source.used) ? source.used : 0,
    names: Array.isArray(source.names) ? source.names.slice() : [],
    pending: Array.isArray(source.pending)
      ? source.pending.map(function (row) { return row.slice(); })
      : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

function assertFieldEvent(event, spec) {
  if (!event || typeof event !== "object" || event.kind !== "field"
      || typeof event.name !== "string"
      || !Number.isInteger(event.width)
      || !Number.isInteger(event.value)) {
    fail(codeFor(spec, "event_error_code", "E_BAD_EVENT"), "事件不合法");
  }
}

export function step(spec) {
  spec = spec || {};
  const state = freshState(spec.state);
  let events;
  if (Array.isArray(spec.events)) events = spec.events;
  else if (spec.events === undefined) events = [];
  else fail(codeFor(spec, "event_error_code", "E_BAD_EVENT"), "事件表不合法");
  let remaining = Number.isFinite(spec.budget) ? Math.max(0, Math.floor(spec.budget)) : 0;
  let packed = 0;
  let judged = 0;

  const markOf = function (event, index) {
    if (event && Object.prototype.hasOwnProperty.call(event, "id")) return "id:" + event.id;
    return "at:" + index;
  };
  const absorb = function (value, width) {
    const next = appendBits(state, value, width);
    state.bytes = next.bytes;
    state.acc = next.acc;
    state.used = next.used;
  };

  // 残位连游标带出下一轮：先把上轮压在账上的字段按序补打包（名字入账时已登记）
  while (remaining > 0 && state.pending.length > 0) {
    const row = state.pending.shift();
    absorb(row[2], row[1]);
    remaining -= 1;
    packed += 1;
  }

  events.forEach(function (event, index) {
    const mark = markOf(event, index);
    if (state.applied.indexOf(mark) !== -1) return;
    judged += 1;
    state.applied.push(mark);

    assertFieldEvent(event, spec);
    if (state.names.indexOf(event.name) !== -1) {
      fail(codeFor(spec, "field_error_code", "E_DUPLICATE_FIELD"),
        "字段名重复：" + event.name);
    }
    if (event.width < 1 || event.width > 16) {
      fail(codeFor(spec, "width_error_code", "E_BAD_WIDTH"), "位宽非法：" + event.width);
    }
    if (event.value < 0 || event.value > maxValue(event.width)) {
      fail(codeFor(spec, "value_error_code", "E_VALUE_RANGE"),
        "值 " + event.value + " 超出 " + event.width + " 位上限");
    }

    if (remaining <= 0) {
      state.pending.push([event.name, event.width, event.value]);
      state.names.push(event.name);
      return;
    }
    absorb(event.value, event.width);
    state.names.push(event.name);
    remaining -= 1;
    packed += 1;
  });

  return {
    state: state,
    packed: packed,
    pending_before: state.pending.length,
    pending_fields: state.pending.map(function (row) { return row.slice(); }),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  spec = spec || {};
  const state = freshState(spec.state);
  let catchup = 0;
  while (state.pending.length > 0) {
    const row = state.pending.shift();
    const next = appendBits(state, row[2], row[1]);
    state.bytes = next.bytes;
    state.acc = next.acc;
    state.used = next.used;
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
