export function stepIndex(index, direction, count) {
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(index) || ![-1, 1].includes(direction)) throw new RangeError('Invalid story navigation');
  return count === 0 ? null : Math.max(0, Math.min(count - 1, index + direction));
}

export function sourceUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
