# AEON Bank Interview — Mobile Security

### "First Security Concern in a Banking App" — Full 15-Minute Script

---

## ⏱️ Timing Overview

| Section                                                        | Time        |
| -------------------------------------------------------------- | ----------- |
| Opening: Frame with OWASP                                      | ~60 sec     |
| Layer 1: Data at rest — where sensitive data lives             | ~3 min      |
| Layer 2: Authentication — tokens, PIN, biometric               | ~3 min      |
| Layer 3: Device integrity — root & jailbreak detection         | ~2 min      |
| Layer 4: Data in transit — certificate pinning                 | ~2 min      |
| Layer 5: Runtime protection — screenshots, clipboard, keyboard | ~90 sec     |
| Layer 6: App integrity — Play Integrity & AppAttest            | ~90 sec     |
| Trade-offs I'd name proactively                                | ~60 sec     |
| **Total**                                                      | **~15 min** |

---

## 🎙️ The Script

---

### OPENING — Frame With OWASP _(~60 sec)_

"When I think about security for a banking app, I don't start with a random list of features. I start with the OWASP Mobile Top 10 — it's the industry-standard threat model for mobile applications. It tells me where the real attack surfaces are."

"For a banking app, the threats I care most about are:"

"M1 — Improper credential usage. Storing tokens or secrets in the wrong place."
"M2 — Inadequate supply chain security. Third-party SDKs with vulnerabilities."
"M3 — Insecure authentication. Weak token handling, no biometric, no session limits."
"M4 — Insufficient input/output validation. Injection attacks."
"M9 — Insecure data storage. The most common mistake — storing sensitive data in AsyncStorage or plain files."

"I think of the full security posture as six layers. Data at rest, authentication, device integrity, data in transit, runtime protection, and app integrity. Let me walk through each one."

---

### LAYER 1 — Data at Rest _(~3 min)_

"The first question I ask is: what sensitive data does this app hold, and where does it actually live on the device?"

"For a banking app, the sensitive data is: access token, refresh token, PIN, biometric keys, and cached financial data like account balance and transaction history."

"Let me go through each one."

---

**Access Token**

"The access token lives in memory only. I never write it to disk. It's a JavaScript variable in the API client module — it exists while the app is running and disappears the moment the app is killed."

"Why memory only? Because anything written to disk can potentially be read — especially on a rooted or jailbroken device. The access token is short-lived — 15 minutes maximum — so even if someone somehow captures it, the window for abuse is small."

"The trade-off: if the app crashes or is force-closed, the access token is gone. The user needs to refresh silently on next launch. That's acceptable — it's a minor UX cost for a significant security gain."

---

**Refresh Token**

"The refresh token is different. It's longer-lived — up to 7 days — so I need to persist it so the user doesn't have to log in every time they open the app. But it cannot go in AsyncStorage."

"AsyncStorage is a plain text key-value store. On Android, it's literally an SQLite database in the app's data directory. On a rooted device, any app can read it. That's OWASP M9 — insecure data storage."

"Instead, I store the refresh token in Keychain on iOS and Keystore-backed storage on Android. In React Native, I use Expo SecureStore or `react-native-keychain` — both are wrappers around the OS-level secure storage."

"Here's what makes this secure: the key material never touches the file system as plain text. It's encrypted and stored inside the OS secure enclave — the Secure Enclave on iOS, the Trusted Execution Environment on Android. Even if someone extracts the SQLite databases from the device, they can't read the stored secret without the device's hardware key."

"I also set the access control flag to `whenUnlockedThisDeviceOnly`. This means: the secret is only accessible when the device is unlocked, and it cannot be backed up to iCloud or transferred to another device. So even a full device backup doesn't expose the refresh token."

---

**Cached Financial Data**

"Transaction history and account balance are cached for offline viewing. I store this in an encrypted database — either SQLCipher or the Expo SQLite equivalent with encryption. The encryption key is derived from the device's secure hardware, so the data is only readable on this specific device."

"I also apply data minimization — I only cache what the user actually needs for offline access. I don't cache full transaction history going back years. Typically the last 30 days is enough. Less sensitive data on disk means a smaller attack surface."

---

### LAYER 2 — Authentication _(~3 min)_

**PIN**

"I never store the PIN on the device. Not in SecureStore, not in memory, nowhere."

"Here's why: a PIN is typically 4 to 6 digits. That's a maximum of one million possible values. If I store the PIN hash on the device, an attacker with physical access can run an offline brute force — no network needed, no rate limiting, just try all one million combinations locally. At modern computation speeds, that takes seconds."

"So the PIN is verified server-side only. The user enters the PIN, I send it over a secure connection to the backend — never logged, never cached — the server validates it, and returns a session token. All rate limiting and lockout logic lives on the server: three failed attempts locks the account, and only a full re-authentication flow unlocks it."

---

**Biometric Authentication**

"Biometric data — fingerprint or Face ID — never leaves the secure hardware. The OS handles it entirely. What I do is:"

"I create a cryptographic key in the Keychain or Keystore, bound to biometric authentication. Bound means the OS will only release this key if the biometric check passes."

"When the user authenticates with biometric, the OS performs the check internally. If it passes, the OS releases the key to my app. I use that key to decrypt the session secret or sign a challenge. I never see the fingerprint or face data — only the key that was released."

"This is important: I'm not doing my own biometric check. I'm delegating entirely to the OS, which is hardened and audited. Rolling my own biometric check would be a serious mistake."

"I also handle the case where biometrics change — the user adds a new fingerprint or re-enrolls Face ID. The OS invalidates the key in that case. My app detects this on the next auth attempt and forces the user to re-authenticate with their PIN to re-create the biometric key. This prevents an attacker from adding their own fingerprint to bypass authentication."

---

**Token Rotation**

"Every time the refresh token is used, the backend issues a new one and invalidates the old one. This is critical for a banking app. If a refresh token is stolen — through a compromised device or a backup leak — rotation means the attacker can only use it once. The moment the legitimate client refreshes, the stolen token is dead."

"I pair this with reuse detection on the backend: if an already-invalidated refresh token is presented, it means either a bug or a replay attack. The backend invalidates the entire token family for that user and forces a full logout — across all devices."

---

### LAYER 3 — Device Integrity _(~2 min)_

"On a rooted Android device or a jailbroken iOS device, the OS security model is broken. The Keystore and Keychain can potentially be bypassed. Certificate pinning can be bypassed. All the security I've built assumes a trustworthy OS — and root removes that trust."

"So I implement root and jailbreak detection as an early check when the app launches."

"For this I use a library like `react-native-device-info` combined with native checks. On Android I check for common root indicators: presence of the `su` binary, known root management apps like Magisk or SuperSU, write access to system partitions, test keys in the build configuration. On iOS I check for presence of Cydia, write access outside the app sandbox, and suspicious dylibs."

"But I don't rely solely on JavaScript-level checks. A sophisticated attacker can hook into the JavaScript runtime and spoof these checks. So I also use Play Integrity API on Android and DeviceCheck on iOS — which I'll cover in the app integrity layer."

"Now — what do I do when I detect a compromised device? I don't silently fail. I show a clear message: 'For your security, this app cannot run on a modified device.' And I block access. No half-measures."

"The trade-off: some legitimate users root their devices for valid reasons — custom ROMs, better battery management. We will block them. That's a deliberate product decision. In banking, security takes precedence over accommodating rooted devices. I'd document this policy clearly in the app store listing."

---

### LAYER 4 — Data in Transit _(~2 min)_

"All communication is over HTTPS — that's the baseline, not the achievement. The real security here is certificate pinning."

"Here's the problem without pinning: HTTPS trusts any certificate signed by any trusted Certificate Authority. There are hundreds of CAs in the system trust store. A nation-state attacker, a corporate proxy, or malware that installs a rogue CA can perform a man-in-the-middle attack — they present a valid certificate signed by a compromised CA, and the device trusts it. The attacker sees all your API traffic in plain text."

"Certificate pinning says: I don't trust all CAs. I only trust this specific certificate, or this specific public key, for this specific domain."

"In React Native, I implement this at the native networking layer — not in JavaScript. JavaScript-level pinning can be bypassed by hooking the fetch API. I use TrustKit on iOS and OkHttp's certificate pinner on Android, configured via a native module."

"I pin to the public key rather than the full certificate. Here's why: certificates expire and rotate. If I pin the full certificate and it rotates, my app stops working for all users until they update. If I pin the public key — which typically stays stable across certificate renewals — I avoid that problem."

"I also implement a backup pin — a secondary public key I can fall back to if the primary is compromised. And I have a monitoring endpoint: if pinning fails — meaning someone is trying to intercept traffic — the app reports this to our security monitoring before blocking the request."

"The operational trade-off: if the server's certificate changes in a way that invalidates the pin, we have an outage until users update the app. This requires tight coordination between mobile and backend teams before any certificate rotation."

---

### LAYER 5 — Runtime Protection _(~90 sec)_

"There are several runtime attack surfaces that are easy to overlook."

"**Screenshot prevention.**"
"Banking screens — balance, transactions, transfer confirmation — should not be capturable in screenshots or the app switcher preview. On Android, I set `FLAG_SECURE` on the window. On iOS, I overlay a blur view on the sensitive screens when the app goes to background. In React Native, I handle this in the `AppState` listener."

"**Clipboard protection.**"
"When the user copies an account number or a transaction reference, I clear the clipboard after 60 seconds. A malicious app running in the background can read the clipboard at any time — limiting the window reduces the risk."

"**Keyboard caching prevention.**"
"iOS and Android both cache keyboard input for autocorrect and predictive text. For sensitive fields — PIN entry, account number, transfer amount — I set `secureTextEntry={true}` and `autoCorrect={false}`. This disables keyboard caching for those fields."

"**Overlay attack prevention.**"
"On Android, a malicious app can draw an invisible overlay on top of the banking app — the user thinks they're tapping a 'Confirm Transfer' button but they're actually tapping something the malicious app controls. I check for `Settings.canDrawOverlays` permission on sensitive screens and warn the user if another app has this permission active."

---

### LAYER 6 — App Integrity _(~90 sec)_

"The last layer is verifying that the app itself hasn't been tampered with."

"An attacker can take the APK or IPA, disassemble it, modify the security checks — remove root detection, disable certificate pinning — repackage it, and distribute it as a fake banking app. Users who install this modified app are completely compromised."

"On Android, I use the Play Integrity API. This is Google's system for verifying three things: the device is genuine hardware, the OS hasn't been modified, and this specific app binary matches what was published on the Play Store. I call this API on app launch and on sensitive actions like login and transfer. The result is a signed token I send to the backend — the backend verifies it server-side before processing the request."

"On iOS, I use AppAttest and DCAppAttestService — Apple's equivalent. It generates a cryptographic attestation that this app is a genuine, unmodified copy running on real Apple hardware."

"The trade-off: both APIs require network connectivity. If the user is offline, attestation can't be performed. I handle this gracefully — I don't block the user from viewing their balance offline, but I do require a successful attestation before any write operation like transfers."

---

### TRADE-OFFS I'D NAME PROACTIVELY _(~60 sec)_

"A few honest trade-offs I'd flag to the team before shipping any of this:"

"**Security vs. developer experience.** Certificate pinning breaks debugging — Charles Proxy and Flipper both work by intercepting HTTPS traffic. I'd build a debug build variant that disables pinning, and a release build that enforces it. Never ship a release build without pinning."

"**Root detection vs. user inclusivity.** Blocking rooted devices excludes a small but real segment of legitimate users. I'd document this decision and make it visible in the app store description."

"**Biometric convenience vs. security level.** Biometric auth is convenient but has edge cases — identical twins, sleeping users. For high-value actions — transfers above a threshold — I'd require biometric plus PIN, not just biometric alone. Defense in depth."

"**Attestation availability vs. offline access.** Play Integrity and AppAttest require connectivity. For a banking app, I'd allow read-only offline access but gate all write operations on a successful attestation."

---

## 🆘 Safety Net — If You Blank

These 7 sentences will carry you:

1. _"I think in six layers: data at rest, authentication, device integrity, data in transit, runtime protection, and app integrity."_
2. _"Access token in memory only — never persisted. Refresh token in Keychain or Keystore — hardware-backed, never plain text."_
3. _"AsyncStorage is plain text on disk. That's OWASP M9. It cannot store anything sensitive in a banking app."_
4. _"PIN is never stored. Verified server-side only with rate limiting. Offline brute force must be impossible."_
5. _"Biometric keys live in the secure enclave. The OS releases the key only after a successful biometric check. I never see the biometric data."_
6. _"Certificate pinning on the public key — not the full certificate — so it survives cert rotation."_
7. _"On a rooted or jailbroken device, I block access entirely. The OS security model is broken — I can't build on a broken foundation."_

---

## 🧠 Structure to Remember

> **OWASP frame → Data at rest (access token / refresh token / cached data) → Auth (PIN / biometric / rotation) → Device integrity (root detection) → Data in transit (cert pinning) → Runtime (screenshot / clipboard / keyboard) → App integrity (Play Integrity / AppAttest) → Trade-offs**

---

## ⚠️ Senior Signals to Drop Naturally

- _"I don't start with a random list of features — I start with the OWASP Mobile Top 10."_
- _"AsyncStorage is plain text on disk. That's OWASP M9 — insecure data storage. It's the most common mistake I see."_
- _"I pin to the public key, not the full certificate — so it survives certificate rotation without an app update."_
- _"On a rooted device, I block entirely. I'd document this policy in the app store listing so users know upfront."_
- _"For transfers above a threshold, I'd require biometric plus PIN — not just biometric. Defense in depth."_
- _"Play Integrity and AppAttest require connectivity — I'd allow read-only offline but gate all writes on attestation."_

---

## ❌ Common Mistakes to Avoid

- ❌ Never say "jailbreak" as "jellybreak" — practice saying it clearly: **jail-break**
- ❌ Don't say "we use HTTPS" like it's an achievement — it's the baseline, not the security
- ❌ Don't skip the PIN reasoning — "server-side only" needs the explanation of why (offline brute force)
- ❌ Don't implement your own biometric check — always delegate to the OS
- ❌ Don't pin the full certificate — pin the public key so cert rotation doesn't break the app
- ❌ Don't block the user completely on attestation failure if they're offline — gate writes, allow reads
