/**
 * Pinned to "en-US" rather than the viewer's locale: this is an internal HR
 * tool, and different staff should see the same employee's numbers formatted
 * identically regardless of OS locale (avoids 1/7 vs 7/1 date ambiguity, etc).
 */
const LOCALE = "en-US";

export function formatCurrency(amount: number | string, currency: string) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatCompactCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
