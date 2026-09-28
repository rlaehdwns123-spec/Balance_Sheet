/**
 * DART 금액 문자열 → number.
 * "1,234" → 1234, "-1,234" → -1234, "(1,234)" → -1234, ""/"-"/공백/undefined → null
 */
export function parseAmount(value: string | null | undefined): number | null {
  if (value == null) return null;
  let s = value.trim().replace(/,/g, "");
  if (s === "" || s === "-") return null;

  let sign = 1;
  if (s.startsWith("(") && s.endsWith(")")) {
    sign = -1;
    s = s.slice(1, -1).trim();
  }

  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? sign * n : null;
}
