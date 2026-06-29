// Constructing an Intl formatter is expensive (it loads locale data). In a long
// transaction list this used to run once per row, per render — the single
// biggest cause of dropped frames while scrolling. We build it ONCE at module
// load and reuse it for every call; `.format()` itself is cheap.
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Kuala_Lumpur',
});

export function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return dateFormatter.format(date).replace(',', '');
}
