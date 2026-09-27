// bits.js：位宽上限与位串拼接（低位先进，凑满八位吐字节，残位连游标留下轮）
export function maxValue(width) {
  if (!Number.isInteger(width) || width < 1 || width > 16) {
    const error = new Error("位宽必须是 1 到 16 的整数，收到 " + String(width));
    error.code = "E_BAD_WIDTH";
    throw error;
  }
  return (1 << width) - 1;
}

export function appendBits(state, value, width) {
  const limit = maxValue(width);
  const source = state || {};
  const bytes = Array.isArray(source.bytes) ? source.bytes.slice() : [];
  let acc = Number.isInteger(source.acc) ? source.acc : 0;
  let used = Number.isInteger(source.used) ? source.used : 0;

  acc |= (Number(value) & limit) << used;
  used += width;
  while (used >= 8) {
    bytes.push(acc & 0xff);
    acc >>= 8;
    used -= 8;
  }
  return { bytes, acc, used };
}
