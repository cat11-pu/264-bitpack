// packrun.js：按打包预算打包并留账（基线：一律给空表）
import { maxValue, appendBits } from "./bits.js";

export function step(spec) {
  return { state: spec.state, packed: 0, pending_before: 0, pending_fields: [],
           judged: 0, judged_bound: 0 };
}

export function close(spec) {
  return { state: spec.state, catchup: 0 };
}
