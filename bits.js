// bits.js：位宽上限与位串拼接（低位先进，凑满八位吐字节，残位留游标）
function badWidth(width) {
  const error = new Error("位宽不是一到十六: " + width);
  error.code = "E_BAD_WIDTH";
  return error;
}

export function maxValue(width) {
  if (!Number.isInteger(width) || width < 1 || width > 16) {
    throw badWidth(width);
  }
  return (1 << width) - 1;
}

export function appendBits(state, value, width) {
  const mask = maxValue(width);
  const used = state.used | 0;
  let acc = (state.acc | 0) | ((value & mask) << used);
  let rest = used + width;
  const bytes = (state.bytes || []).slice();
  while (rest >= 8) {
    bytes.push(acc & 255);
    acc = acc >>> 8;
    rest -= 8;
  }
  return Object.assign({}, state, { bytes: bytes, acc: acc, used: rest });
}
