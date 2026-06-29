// Built once and reused — see the note in utils/date.ts. Constructing an
// Intl.NumberFormat per row was a per-frame cost during scroll.
const currencyFormatter = new Intl.NumberFormat('en-MY', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '+';
  const absoluteAmount = Math.abs(amount);
  const formattedAmount = currencyFormatter.format(absoluteAmount);

  return `${sign} RM ${formattedAmount}`;
}
