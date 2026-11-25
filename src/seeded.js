export function seedValue(seed, salt) {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function seededShuffle(items, seed, salt) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = seedValue(seed, salt + index) % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
