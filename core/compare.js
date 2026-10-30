// Picking the comparisons around the user's number.

/**
 * Entries sorted ascending by value; returns `below` smaller entries and `above`
 * larger entries around `value`, plus whether more exist on either side.
 * `key` reads the value to compare (e.g. a converted amount).
 */
export function windowAround(sorted, value, below, above, key = (e) => e.value_original) {
  let i = 0;
  while (i < sorted.length && key(sorted[i]) < value) i++;
  const start = Math.max(0, i - below);
  const end = Math.min(sorted.length, i + above);
  return {
    smaller: sorted.slice(start, i),
    larger: sorted.slice(i, end),
    moreSmaller: start > 0,
    moreLarger: end < sorted.length,
  };
}
