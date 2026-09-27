import fs from "node:fs";
import { maxValue, appendBits } from "./bits.js";
import { step, close } from "./packrun.js";

// 验收断言：上面每条值收进 emit，最后与期望值逐项比对，不符就非零退出。
const __lines = [];
function emit(label, value) { __lines.push([String(label).replace(/ =$/, ""), value]); }


const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/fields.json", "utf8"));
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

emit("收尾后字节流 =", hex(closed.state.bytes));
emit("收尾后残位数 =", closed.state.used);
emit("首轮打包字段数 =", first.packed);
emit("二档打包字段数 =", wide.packed);
emit("两个预算档打包不同 =", first.packed !== wide.packed);
emit("收尾前待打包账 =", first.pending_before);
emit("压在账上的字段 =", JSON.stringify(first.pending_fields));
emit("收尾补齐条数 =", closed.catchup);
emit("收尾后待打包账 =", closed.state.pending.length);
emit("拆两轮中间态不同 =", fingerprint(r2.state) !== fingerprint(first.state));
emit("拆两轮收尾态一致 =", fingerprint(closedTwo.state) === fingerprint(closed.state));
emit("重放新打包 =", replay.packed);
emit("工作计数未超上界 =", first.judged <= first.judged_bound);
emit("与全量对照差异 =", fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1);


// ---- 异常路径探针：真调用实现，看它报出什么码（不是从样例里抄）----
try {
  step(Object.assign({}, { budget: 2,
    state: { bytes: [], acc: 0, used: 0, names: [], pending: [], applied: [] },
    events: [{ id: 1, kind: "field", name: "a", width: 0, value: 1 }] }));
  emit("位宽非法报码", "没有报错");
} catch (error) {
  emit("位宽非法报码", error && error.code ? error.code : String(error.message));
}
try {
  step(Object.assign({}, { budget: 2,
    state: { bytes: [], acc: 0, used: 0, names: [], pending: [], applied: [] },
    events: [{ id: 1, kind: "field", name: "a", width: 3, value: 8 }] }));
  emit("值超范围报码", "没有报错");
} catch (error) {
  emit("值超范围报码", error && error.code ? error.code : String(error.message));
}
try {
  step(Object.assign({}, { budget: 2,
    state: { bytes: [], acc: 0, used: 0, names: ["a"], pending: [], applied: [] },
    events: [{ id: 1, kind: "field", name: "a", width: 3, value: 1 }] }));
  emit("重复字段报码", "没有报错");
} catch (error) {
  emit("重复字段报码", error && error.code ? error.code : String(error.message));
}
try {
  step(Object.assign({}, { budget: 2,
    state: { bytes: [], acc: 0, used: 0, names: [], pending: [], applied: [] },
    events: [{ id: 1, kind: "peek", name: "a" }] }));
  emit("事件不合法报码", "没有报错");
} catch (error) {
  emit("事件不合法报码", error && error.code ? error.code : String(error.message));
}


// ---- 期望值（参考模型算出，与题面给的验收数值一致）----
const EXPECTED = {
  "收尾后字节流": "4d 8c",
  "收尾后残位数": 6,
  "首轮打包字段数": 2,
  "二档打包字段数": 4,
  "两个预算档打包不同": true,
  "收尾前待打包账": 3,
  "压在账上的字段": [
    [
      "c",
      4,
      12
    ],
    [
      "d",
      8,
      200
    ],
    [
      "e",
      2,
      3
    ]
  ],
  "收尾补齐条数": 3,
  "收尾后待打包账": 0,
  "拆两轮中间态不同": true,
  "拆两轮收尾态一致": true,
  "重放新打包": 0,
  "工作计数未超上界": true,
  "与全量对照差异": 0,
  "位宽非法报码": "E_BAD_WIDTH",
  "值超范围报码": "E_VALUE_RANGE",
  "重复字段报码": "E_DUPLICATE_FIELD",
  "事件不合法报码": "E_BAD_EVENT"
};
// 有的值在收进来之前已经 stringify 过，比较前先试着解析回来，避免类型错配把正确实现判成不过。
function __same(got, want) {
  if (typeof got === "string") {
    try { const parsed = JSON.parse(got); if (JSON.stringify(parsed) === JSON.stringify(want)) return true; } catch (error) { /* 不是 JSON 就按原文比 */ }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  const got = found[1];
  if (__same(got, want)) { console.log("一致 " + label + " = " + JSON.stringify(got)); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(got)); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
