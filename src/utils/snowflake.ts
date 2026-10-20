/** X post IDs are Snowflake IDs since November 2010: the top bits encode the creation time. */
const TWITTER_EPOCH = 1288834974657n;
/** First snowflake IDs appeared around this value; older numeric IDs carry no timestamp. */
const MIN_SNOWFLAKE = 29_700_000_000_000_000n;

export function snowflakeToDate(id: string): Date | null {
  if (!/^\d{15,25}$/.test(id)) return null;
  const value = BigInt(id);
  if (value < MIN_SNOWFLAKE) return null;
  const ms = Number((value >> 22n) + TWITTER_EPOCH);
  const date = new Date(ms);
  // Reject nonsense values (in the future by more than a day, or before 2010).
  if (Number.isNaN(ms) || ms > Date.now() + 86_400_000 || ms < Date.UTC(2010, 10, 1)) return null;
  return date;
}

/** Compares two numeric IDs (string) without precision loss. */
export function compareIds(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}
