# Transaction List Performance — Interview Notes

> **The question.** AEON has 500,000 active users. The transaction history screen
> lets users scroll through months of transactions — each row is a card with a
> merchant logo, amount, date, and status. The backend can hand over 10,000
> transactions at a time. But the app feels laggy: frames drop, scrolling
> stutters. **What's your diagnosis, and what's your fix?**

This is my answer, written so I can explain it out loud.

---

## 1. The first thing I'd say (the reframe)

Most people hear "10,000 rows" and assume the problem is *too many cards on
screen*. That's **not** it.

React Native lists (`FlatList`) are **virtualized** — they only keep about
10–20 rows actually mounted at any moment, no matter whether the data has 100
rows or 10,000. The rows you've scrolled past get unmounted; the rows below
aren't built yet.

So if raw row count isn't the problem, what is? **Work happening on the
JavaScript thread on every frame while you scroll.**

> A phone screen refreshes ~60 times a second. That gives me **~16 milliseconds
> per frame** to do everything. If my code spends 20ms preparing a row, the
> phone misses that frame → that's a "dropped frame" → that's the stutter the
> user feels.

So my diagnosis is: *something expensive is running per-row, per-frame.* Let me
find it.

---

## 2. Diagnosis — what's actually eating the frame budget

I found three culprits, in order of impact.

### Culprit #1 — Rebuilding date/currency formatters for every row (the big one)

To show "15 Jan 2024" and "+ RM 1,500.00", the code used `Intl.DateTimeFormat`
and `Intl.NumberFormat`. The problem: it created a **brand-new formatter every
single time**, inside the function that runs per row.

> Analogy: it's like buying a new oven every time you want to toast one slice of
> bread, then throwing the oven away. Building the oven (`new Intl.*`) is slow;
> using it (`.format()`) is fast.

As you scroll, the list builds new rows in batches, and each row was building
**two ovens from scratch**. That alone can blow the 16ms budget.

### Culprit #2 — Every row re-rendering even when nothing changed

The row component (`TransactionCard`) wasn't memoized, and it rebuilt its
styles on every render. So whenever the screen re-rendered — a search keystroke,
the auto-refresh every 60s, a pull-to-refresh — **all visible rows re-rendered**,
even the ones whose data hadn't changed at all.

### Culprit #3 — Loading everything at once

The screen fetched **all** transactions in one call and kept them all in memory.
"Months of history" is unbounded, so this grows forever, and the first screen
takes longer to appear because it's parsing a huge response before showing
anything.

---

## 3. The fix — three layers

### Layer A — Stop rebuilding the formatters (biggest win, smallest change)

Build each `Intl` formatter **once** when the file loads, and reuse it for every
row.

```ts
// Before: a new formatter on every call (per row, per frame)
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {...}).format(new Date(value));
}

// After: built once, reused forever
const dateFormatter = new Intl.DateTimeFormat('en-GB', {...});
export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}
```

Same idea for currency. **One oven, kept on the counter.** This removes most of
the stutter on its own.

### Layer B — Make rows skip work when their data hasn't changed

Two small things:

1. **Wrap the row in `React.memo`** — now a row only re-renders if *its own*
   transaction changed. The 60-second refresh no longer re-renders rows that
   look identical.
2. **Memoize the styles** — build the style object once per theme, not once per
   render.

There was one subtle trap. `React.memo` only helps if the props are *stable*
between renders. The screen was passing a fresh "on press" function to every
row on every render:

```tsx
// Before: a new arrow function per row, every render → memo is defeated
<TransactionCard onPress={() => openTransaction(item.refId)} />

// After: pass one stable function; the card passes its own id back
<TransactionCard onPress={openTransaction} />   // openTransaction is memoized once
```

> Talking point: "Memoization is only as good as the stability of what you feed
> it. A new function each render looks like a changed prop, so React re-renders
> anyway. Fixing the callback is what *activates* the memo."

### Layer D — Page the data instead of loading all of it

Instead of "give me everything," the screen now asks for **one page at a time**
and loads the next page as the user scrolls. This is what TanStack Query's
**infinite query** is built for.

```
Load page 1 (20 rows)  →  user scrolls near the bottom
   →  load page 2 (next 20)  →  scroll  →  page 3 …  →  until there are no more
```

- **First screen appears instantly** (20 rows, not 10,000).
- **Memory stays bounded** — we hold what's been scrolled, not all of history.
- The backend tells us the **cursor** for the next page, and says "that's the
  end" by returning nothing — that's how the app knows to stop.

I also moved **filtering and search to the server** (the page request carries
`search`, `type`, `dateRange`), and **debounced the search by 300ms** so typing
fires *one* request when you pause, not one per letter.

---

## 4. How TanStack Query fits (in case they ask)

The key mental model: an infinite query doesn't store a flat array — it stores a
list of **pages**.

```
data.pages = [
  { data: [...20 rows], nextCursor: 20 },
  { data: [...20 rows], nextCursor: 40 },
  { data: [...20 rows], nextCursor: null },   // null = no more pages
]
```

- `getNextPageParam` reads the last page's `nextCursor` to know what to fetch
  next. Returning "nothing" sets `hasNextPage = false`.
- Each filter combination is its own cached query. Switch from "incoming" back to
  "all" and the old pages are still warm — **instant**, no refetch.
- It also gives loading/error states, background refresh, and request
  de-duplication for free, so I'm not hand-rolling any of that.

---

## 5. How I'd prove it worked

Open the React Native performance monitor and watch the **JS thread frame rate**
specifically (the UI thread was never the problem here — it's the JS thread
that was starving).

- **Before:** JS FPS drops well below 60 while scrolling; blank cells flash.
- **After Layer A alone:** most of the drop is gone, because scrolling no longer
  builds formatters.
- **After B + D:** rows stop re-rendering needlessly, and we never hold more than
  a few pages in memory.

> Talking point: "I'd fix the cheapest, highest-impact thing first (the
> formatters), re-measure, and only then add the bigger structural change
> (pagination). Measure, fix, measure again — don't optimize blind."

---

## 6. The 30-second version (if they want the summary)

> "FlatList already virtualizes, so the problem isn't row count — it's per-row
> work on the JS thread. The worst offender was rebuilding date and currency
> formatters for every row on every frame; I build them once and reuse them.
> Then I memoized the row so unchanged rows don't re-render — which meant fixing
> an unstable callback prop so the memo actually engages. Finally, I switched
> from loading all 10,000 at once to paginating with an infinite query, with
> filtering moved server-side and search debounced. First paint is instant,
> memory is bounded, and scrolling stays at 60fps. I'd verify by watching the JS
> thread FPS before and after each change."

---

## 7. Cheat sheet

| Problem | Why it hurts | Fix |
|---|---|---|
| New `Intl` formatter per row | Building a formatter is slow; ran every frame | Build once at module load, reuse (**A**) |
| Rows re-render when unchanged | Refresh/keystroke re-renders the whole visible list | `React.memo` + memoized styles (**B**) |
| Unstable `onPress` per row | Defeats the memo above | Pass one stable callback (**B**) |
| Load all 10,000 at once | Slow first paint, unbounded memory | Infinite query, page on scroll (**D**) |
| Filter/search per keystroke | A request per letter | Server-side filter + 300ms debounce (**D**) |

**Files I touched:** `utils/date.ts`, `utils/currency.ts` (A) ·
`components/TransactionCard.tsx`, `components/AmountText.tsx`,
`screens/transactionList/TransactionListScreen.tsx` (B) ·
`hooks/useTransactionQueries.ts`, `repositories/ApiTransactionRepository.ts`,
`api/MockBackend.ts`, `screens/transactionList/useTransactionListViewModel.ts` (D)

**One honest caveat I'd mention:** the current rows don't actually load a merchant
*logo image* yet. If they did, that becomes a fourth culprit — I'd use
`expo-image` (built-in caching + downscaling) and serve correctly-sized
thumbnails, because decoding full-resolution images per row is its own source of
jank.
