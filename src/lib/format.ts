const eurFormatter = new Intl.NumberFormat("en-LU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatPrice(price: number): string {
  return eurFormatter.format(price);
}

export function formatPriceShort(price: number): string {
  if (price >= 1_000_000) {
    return `€${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (price >= 1_000) {
    return `€${Math.round(price / 1000)}k`;
  }
  return `€${price}`;
}

export function formatListedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Listed today";
  if (days === 1) return "Listed yesterday";
  if (days < 30) return `Listed ${days} days ago`;
  const months = Math.round(days / 30);
  return `Listed ${months} month${months === 1 ? "" : "s"} ago`;
}
