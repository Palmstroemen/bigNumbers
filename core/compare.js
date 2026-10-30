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

/**
 * The `count` entries closest to `value`, measured as a factor (twice as large is as
 * far as half as large), split into smaller and larger ones, each ascending.
 * Entries more than `maxFactor` times larger or smaller are left out, unless that
 * would leave fewer than `min`; then the closest `min` are taken anyway.
 */
export function nearest(entries, value, { count = 6, maxFactor = 10, min = 2, key = (e) => e.value_original } = {}) {
  if (!(value > 0)) return { smaller: [], larger: [] };
  const byDistance = entries
    .filter((e) => key(e) > 0)
    .map((e) => ({ e, d: Math.abs(Math.log(key(e) / value)) }))
    .sort((a, b) => a.d - b.d);
  const close = byDistance.filter((x) => x.d <= Math.log(maxFactor));
  const chosen = (close.length >= min ? close : byDistance.slice(0, min)).slice(0, count)
    .map((x) => x.e).sort((a, b) => key(a) - key(b));
  return { smaller: chosen.filter((e) => key(e) < value), larger: chosen.filter((e) => key(e) >= value) };
}
