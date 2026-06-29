# AEON Bank Interview — "Project I'm Proud Of"

### HM Asset Health Management — Full 5-Minute Script

---

## ⏱️ Timing Overview

| Section                | Time       |
| ---------------------- | ---------- |
| Set the scene          | ~30 sec    |
| Business problem       | ~45 sec    |
| My role                | ~30 sec    |
| The solution           | ~45 sec    |
| Sensor 1 & 2 challenge | ~60 sec    |
| FLIR challenge         | ~90 sec    |
| Impact                 | ~30 sec    |
| **Total**              | **~5 min** |

---

## 🎙️ The Script

### 1. Set the Scene _(~30 sec)_

"So the project I'm most proud of is called HM Asset Health Management. I built it for an industrial client in Indonesia — specifically a paper and tissue manufacturing company. They operate large, heavy machinery 24/7, and the big risk for them is machine failure. If a critical machine breaks down unexpectedly, the production line stops — and that's very expensive downtime."

"So their goal was simple: catch failing machines _before_ they break. And to do that, they monitor three things — temperature, vibration, and thermal imaging."

---

### 2. The Business Problem _(~45 sec)_

"Now, the way they were doing this before was with industrial thermal guns. These are professional devices — accurate, reliable — but extremely expensive. Each unit costs around 300 million Rupiah. They had ten of them across the factory floor. That's 3 billion Rupiah worth of equipment they had to maintain, insure, and eventually replace."

"On top of that, the workflow was manual. A technician picks up the gun, walks to a machine, takes a reading, writes it down, walks back. No centralized data, no history, no trend analysis."

"So the company asked us: can you replace this workflow with something cheaper, faster, and smarter?"

---

### 3. My Role _(~30 sec)_

"I was brought in as the sole mobile engineer. My responsibility was to build the entire React Native app from scratch — the UI, the sensor integrations, the data flow to the backend, everything on the mobile side. I owned it end to end."

---

### 4. The Solution _(~45 sec)_

"The solution we came up with was to replace the thermal guns with FLIR One — a small thermal camera attachment that plugs directly into a phone via USB. It costs a fraction of the industrial guns but captures the same thermal data."

"Combined with two other sensors for vibration and temperature, we could give technicians a single app that captures all three readings in one workflow. They walk up to a machine, open the app, connect the sensors, capture the data, and it goes straight to the backend. The system then analyzes trends over time and flags machines that are at risk."

---

### 5. The Hardest Problem — Sensor 1 & 2 _(~60 sec)_

"Now here's where it got hard. Two of the three sensors had no English documentation at all. They came from a Chinese manufacturer — the docs were entirely in Chinese."

"I had to translate the documentation myself using a combination of Google Translate and just... reading the code. The manufacturer provided an example project, but it was in Flutter — not React Native. So I had to understand what the Flutter code was doing at the native level and then re-implement that logic in a React Native native module for Android."

"That was my first time doing a full native module from scratch for a hardware sensor. It took me about a week of trial and error, but eventually I got stable readings for both temperature and vibration coming through to JavaScript."

---

### 6. The Hardest Problem — FLIR _(~90 sec)_

"But the biggest challenge was the FLIR integration. FLIR does provide an SDK — but the only example they had was for Android in Java. No React Native example, no documentation for bridging, nothing."

"So I started by building a proof of concept. I read through the Java example carefully, understood the connection lifecycle — how the camera connects over USB, how it signals when it's ready, how to start and stop the data stream."

"Then I built a native module in Java that wraps the FLIR SDK, and exposed it to React Native via the bridge."

"But then I hit a performance problem. The thermal camera was streaming image frames continuously — and I was naively sending every single frame across the bridge to JavaScript. The memory usage spiked, the app became unstable, and in some cases it crashed."

"So I had to rethink the architecture. I moved the frame buffering entirely to the native side. Instead of sending every frame to JavaScript, I capture everything natively, but I only send the _last_ frame per second across the bridge. That one change fixed the memory issue completely."

"For the thermal image itself, I also had to handle resolution. The raw output was too high — around 1080p — and that was too heavy for real-time display. I downscaled it to 720p on the native side before bridging, which gave us a good balance between image quality and performance."

---

### 7. Impact _(~30 sec)_

"The end result was an app that replaced 3 billion Rupiah worth of thermal guns with a phone attachment and a React Native app. Technicians now have a single tool that captures thermal images, temperature, and vibration — all in one workflow — and all the data flows into a centralized backend where the client can track machine health trends over time."

"For me personally, this project pushed me deep into native module development, hardware bridging, and performance optimization under real constraints. It's the project I'm most proud of because I had to figure out almost everything from scratch."

---

## 🆘 Safety Net — If You Blank

Memorize these 5 sentences. They will carry you through:

1. _"They were spending 3 billion Rupiah a year on thermal guns. I helped replace that with a phone attachment."_
2. _"Two sensors had no English docs. I translated Chinese documentation myself."_
3. _"The FLIR SDK had no React Native example. I built the native module from scratch."_
4. _"Streaming frames crashed the app. I fixed it by buffering natively and only sending one frame per second to JavaScript."_
5. _"I owned the entire mobile side — from scratch to production."_

---

## 🧠 Structure to Remember

> **Context → Business Problem → My Role → Solution → Hardest Problem → Impact**

Always say **"I"** not **"we"** — your contribution must be clear.

---

## ⚠️ Common Mistakes to Avoid

- ❌ Don't say "we" when you mean "I did this"
- ❌ Don't start with technical details — start with the business problem
- ❌ Don't rush — pause between sections
- ❌ Don't skip the impact — always end with what changed because of your work
