# AEON Bank Interview — Performance & Scale

### "500k Users, Laggy Transaction Screen" — Full 15-Minute Script

---

## ⏱️ Timing Overview

| Section                                                | Time        |
| ------------------------------------------------------ | ----------- |
| Reframe: Diagnose first, fix second                    | ~60 sec     |
| Root cause 1: Loading 10k items upfront                | ~90 sec     |
| Fix 1: Keyset pagination                               | ~2 min      |
| Root cause 2: FlatList rendering everything            | ~60 sec     |
| Fix 2: FlashList + tuning                              | ~2 min      |
| Root cause 3: Re-renders on every store change         | ~60 sec     |
| Fix 3: Memoization (React.memo, useCallback, reselect) | ~2 min      |
| Fix 4: TanStack Query caching                          | ~90 sec     |
| Fix 5: Merchant logo image optimization                | ~60 sec     |
| Fix 6: UX — skeleton loading                           | ~30 sec     |
| Measure before and after                               | ~60 sec     |
| Trade-offs I'd name proactively                        | ~60 sec     |
| **Total**                                              | **~15 min** |

---

## 🎙️ The Script

---

### OPENING — Diagnose First _(~60 sec)_

"Before I jump to solutions, I want to diagnose properly. Because if you just throw FlashList at the problem without understanding the root cause, you might fix 30% of the lag and miss the rest."

"In my experience, when a transaction list feels laggy with large data, there are usually three things happening at the same time — and they compound each other."

"First: you're loading too much data upfront and holding it all in memory."

"Second: FlatList is trying to render all of it, even the rows the user can't see."

"Third: the list is re-rendering on every state change — even when the transaction data hasn't actually changed."

"So my approach is: fix the data layer first, then fix the rendering layer, then fix the re-render layer. In that order."

---

### ROOT CAUSE 1 — Loading 10k Items Upfront _(~90 sec)_

"The backend can give us 10,000 transactions at a time. If I load all 10,000 on mount — that's 10,000 JavaScript objects sitting in memory. Each one has a merchant name, logo URL, amount, date, status, category. That's a lot of data for a mobile device to hold."

"And the problem gets worse over time. The user scrolls down, loads more — now it's 20,000 objects. Then 30,000. Memory pressure builds, GC kicks in more frequently, and that's where you start seeing frame drops — not just from rendering, but from garbage collection pauses."

"So the first fix is: stop loading everything upfront. Paginate aggressively."

---

### FIX 1 — Keyset Pagination _(~2 min)_

"Now, most developers reach for offset pagination first — page one is offset zero, page two is offset fifty, and so on. But offset pagination has a serious problem at scale."

"Here's the issue: if a new transaction comes in while the user is scrolling, everything shifts by one. So when they load page two, they either see a duplicate transaction or they skip one. At 500,000 users doing this simultaneously, that's happening constantly."

"The fix is keyset pagination — also called cursor-based pagination."

"Instead of saying 'give me rows 0 to 50', I say 'give me the 50 transactions that come _after_ this specific transaction ID'. The cursor is the last item's ID or timestamp from the previous page."

"This is stable. New transactions coming in don't affect it. The user always gets a clean, continuous scroll."

"On the React Native side, I implement this in the `onEndReached` handler of the list. When the user scrolls to the bottom, I fire the next query using the last transaction's cursor. I show a small loading spinner at the bottom while it fetches."

"And critically — I keep the page size small. Not 10,000. More like 50 items per page. Load fast, render fast, don't hold unnecessary data in memory."

"The trade-off here is that keyset pagination doesn't support random access — you can't jump to 'page 47'. But for a transaction history screen, users scroll linearly. They don't jump to the middle. So this trade-off is acceptable."

---

### ROOT CAUSE 2 — FlatList Rendering Everything _(~60 sec)_

"Even if I paginate to 50 items, FlatList still has performance issues at scale. The default FlatList in React Native doesn't recycle cells efficiently. As the user scrolls, it keeps mounting and unmounting components, which is expensive."

"It also doesn't know the height of each row upfront, so it can't pre-calculate layout — it measures each row lazily as it comes into view, which causes layout thrashing."

"This is where FlashList comes in."

---

### FIX 2 — FlashList + Tuning _(~2 min)_

"FlashList is a drop-in replacement for FlatList built by Shopify. The key difference is cell recycling — instead of unmounting a row when it scrolls off screen, it reuses that cell for the next row that comes into view. Much less work for the JavaScript thread."

"To get the best performance from FlashList, I do a few things:"

"First, I provide `estimatedItemSize`. This tells FlashList the approximate height of each row — let's say 80 pixels for a transaction card. It uses this to pre-calculate layout and avoid measuring each item live."

"Second, I make sure the row component is stable. If the component reference changes on every render, FlashList can't recycle properly. So I wrap the row component in `React.memo`."

"Third, I set `keyExtractor` to use the transaction ID — not the index. Using index as a key breaks recycling when the list updates."

"Now, if I still need to use FlatList for some reason — maybe the project is already using it and a migration is risky — I tune it manually. I set `windowSize` to 5 (render 2.5 screens above and below viewport), set `maxToRenderPerBatch` to 10 so it doesn't batch too many at once, and I implement `getItemLayout` if all rows are the same height, so FlatList can skip measuring entirely."

"The trade-off with FlashList: it has some edge cases with heterogeneous row heights. If my transaction cards have different heights — let's say some have a promo banner — I need to handle that explicitly with `overrideItemType`."

---

### ROOT CAUSE 3 — Re-renders on Every Store Change _(~60 sec)_

"This is the one that's easy to miss. Even if the list is paginated and FlashList is recycling correctly, you can still get stutters from unnecessary re-renders."

"Here's the scenario: the user is on the transaction screen. Somewhere else in the app, the theme changes, or the language switches, or a modal opens. The global store updates. And because the transaction list selector is watching the whole store — not just the transactions slice — the entire list re-renders."

"With 50 rows on screen, that's 50 components re-rendering for a state change that has nothing to do with them."

---

### FIX 3 — Memoization _(~2 min)_

"I fix this at three levels."

"**Level one: the selector.**"
"Instead of a raw selector that runs on every store update, I use a memoized selector — either Reselect's `createSelector` for Redux, or Zustand's built-in equality function."

"A raw selector does this: every time the store changes, it extracts the transactions array and returns it. Even if the transactions didn't change, it returns a new array reference. So React sees a new reference and re-renders."

"A memoized selector does this: it checks if the _input_ — the transactions slice — changed. If it didn't, it returns the exact same reference as last time. React sees the same reference, skips the re-render."

"Concrete example: if the user's theme changes from light to dark, a memoized selector returns the same transactions array reference. The list doesn't re-render. Only the theme-consuming components re-render."

"**Level two: the row component.**"
"I wrap the transaction row component in `React.memo`. This means if the props for that specific row haven't changed, the row won't re-render even if the list's parent re-renders."

"**Level three: handlers.**"
"Any callback I pass into a row — like `onPress` for navigating to transaction detail — I wrap in `useCallback`. Without this, a new function reference is created on every render, which breaks `React.memo`'s prop comparison."

"Together, these three layers mean the list only re-renders when transaction data actually changes. Not when theme changes, not when a modal opens, not when another screen updates."

---

### FIX 4 — TanStack Query Caching _(~90 sec)_

"For the data fetching layer, I use TanStack Query instead of raw fetch or a manual useEffect."

"The reason is caching and deduplication. When the user navigates away from the transaction screen and comes back, TanStack Query returns the cached data immediately — the list appears instantly. Then in the background, it revalidates against the backend and updates if anything changed. This is the stale-while-revalidate pattern."

"Without this, every time the user navigates to the screen, they see a loading spinner. That feels slow even if the network is fast."

"TanStack Query also handles the pagination cursor automatically. I set up an infinite query where each page's result includes the cursor for the next page. When `onEndReached` fires, I call `fetchNextPage()` and TanStack Query handles the rest — deduplication, loading state, error state, appending to the existing list."

"The trade-off: TanStack Query adds bundle size and has a learning curve for junior engineers. But for a banking app with complex server state, it's worth it. The alternative — manually managing loading, error, cache, pagination, and retry states — is much more error-prone."

---

### FIX 5 — Merchant Logo Image Optimization _(~60 sec)_

"Each transaction card shows a merchant logo. At 50 rows, that's 50 images. If I'm not careful, this alone can cause memory pressure."

"A few things I do here:"

"First, I never load the full-size logo. I request a thumbnail — typically 48x48 or 64x64 pixels. No point loading a 512px logo to display it at 48px on screen."

"Second, I use `FastImage` instead of the built-in `Image` component. FastImage uses a native image cache — SDWebImage on iOS and Glide on Android. Images load faster, they're cached on disk, and they don't re-download every time the cell is recycled."

"Third, I always set explicit `width` and `height` on images. Without explicit dimensions, React Native has to measure the image after load, which causes a layout shift and a re-render."

"For failed logo loads — merchant logo URL is broken or missing — I have a fallback: a placeholder with the first letter of the merchant name on a colored background. Never a broken image icon."

---

### FIX 6 — Skeleton Loading UX _(~30 sec)_

"While the first page is loading, I show a skeleton screen — placeholder cards with a shimmer animation — instead of a spinner. This makes the app feel faster because the user sees the layout immediately, even before data arrives."

"For subsequent pages loading at the bottom, I show a small activity indicator at the end of the list — not a full-page loader."

---

### MEASURE BEFORE AND AFTER _(~60 sec)_

"I don't optimize blind. Before and after every change, I measure."

"The tools I use:"

"**React Native Performance Monitor** — the built-in FPS counter. Before optimization I'd see it dropping to 30-40 FPS during scroll. Target is a stable 60 FPS, ideally 90 FPS on newer devices."

"**Flipper with the React DevTools plugin** — shows me which components are re-rendering and how often. This is how I catch unnecessary re-renders from selectors."

"**Xcode Instruments and Android Profiler** — for memory tracking. I watch for memory that keeps growing as the user scrolls, which indicates a memory leak or cells not being recycled."

"**Detox for automated scroll testing** — I write a test that scrolls through 500 items and measures frame drops. This becomes a regression test so future changes don't reintroduce the lag."

"Concrete target: before optimization — scroll FPS drops to 40, cold start to first render is 3 seconds. After optimization — stable 60 FPS scroll, cold start under 1 second with cached data."

---

### TRADE-OFFS I'D NAME PROACTIVELY _(~60 sec)_

"A few trade-offs I'd flag to the team before implementing:"

"**Keyset pagination vs. offset:** Keyset is more stable but doesn't support jumping to a specific page. Acceptable for transaction history, not acceptable for a search results screen."

"**FlashList vs. FlatList:** FlashList is faster but less mature. Edge cases with variable row heights need explicit handling. Worth it for this use case."

"**Aggressive caching vs. data freshness:** TanStack Query's stale-while-revalidate means a user might see slightly stale transaction data for a second before it updates. For most transactions that's fine. But for a transaction that was _just_ submitted, I need to ensure the cache is invalidated immediately after the POST succeeds — I do this with `queryClient.invalidateQueries`."

"**Small page size vs. network calls:** 50 items per page means more network requests as the user scrolls. But each request is fast and lightweight. The alternative — 10,000 items upfront — is one heavy request that blocks everything. I'd rather have many fast requests than one slow one."

---

## 🆘 Safety Net — If You Blank

These 6 sentences will carry you:

1. _"I diagnose first. Three root causes: too much data upfront, FlatList rendering everything, re-renders on unrelated state changes."_
2. _"I fix the data layer with keyset pagination — 50 items per page, cursor-based, stable under concurrent writes."_
3. _"I fix the rendering layer with FlashList — cell recycling, estimatedItemSize, React.memo on the row component."_
4. _"I fix re-renders with memoized selectors — same input, same reference, list doesn't re-render."_
5. _"TanStack Query gives me stale-while-revalidate — cached data shows instantly, revalidates in background."_
6. _"I measure before and after. Target: stable 60 FPS scroll, cold start under 1 second."_

---

## 🧠 Structure to Remember

> **Diagnose → Data layer → Render layer → Re-render layer → Caching → Images → UX → Measure → Trade-offs**

---

## ⚠️ Senior Signals to Drop

Say these naturally — they show you think beyond just "making it work":

- _"I wouldn't optimize blind — I'd measure first."_
- _"The trade-off with keyset pagination is no random access. But for this use case, linear scroll is the pattern."_
- _"Aggressive caching has a freshness trade-off — I handle that by invalidating the query immediately after a successful transaction POST."_
- _"This becomes a regression test in Detox so future changes don't reintroduce the lag."_

---

## ❌ Common Mistakes to Avoid

- Don't jump straight to FlashList without diagnosing first
- Don't forget to mention _why_ offset pagination breaks at scale
- Don't skip the trade-offs — naming them is a senior signal
- Don't forget image optimization — it's easy to miss and it matters
- Always end with measurement — "I measure before and after" shows engineering discipline
