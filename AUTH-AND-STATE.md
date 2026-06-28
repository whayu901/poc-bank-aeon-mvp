# Authentication & State Management Architecture

## Executive Summary

This document demonstrates a production-ready authentication and state management system for a React Native banking application. The implementation follows OWASP Mobile security guidelines and modern architectural patterns, providing a robust foundation for secure financial services.

---

## 🔐 Authentication Layer

### 1. Secure Token Storage

**Implementation**: `src/services/SecureStorageService.ts`

**OWASP Mobile**: M9 - Insecure Data Storage

**Interview Question**: "How do you securely store sensitive tokens in a mobile banking app?"

**Defense**: "I use hardware-backed encryption via expo-secure-store, which leverages iOS Keychain and Android Keystore. Access tokens stay in memory while refresh tokens are hardware-encrypted with WHEN_UNLOCKED_THIS_DEVICE_ONLY access control."

### 2. Token Rotation & Auto-Refresh

**Implementation**: `src/services/TokenManager.ts`

**OWASP Mobile**: M3 - Insufficient Authentication/Authorization

**Interview Question**: "How do you handle token expiry without disrupting user experience?"

**Defense**: "I implement single-use refresh token rotation with automatic 401 interception. The TokenManager prevents thundering herd with a singleton in-flight refresh promise, ensuring only one refresh occurs even with concurrent 401s."

### 3. Biometric Authentication Gate

**Implementation**: `src/screens/biometricLock/BiometricLockScreen.tsx`

**OWASP Mobile**: M3 - Insufficient Authentication/Authorization

**Interview Question**: "How do you add an extra layer of security for sensitive operations?"

**Defense**: "I implement Face ID/Touch ID using expo-local-authentication with fallback to passcode. After 3 failed attempts, the session is terminated and the user must re-authenticate completely."

### 4. Four-State Auth Model

**Implementation**: `src/store/authStore.ts`

**OWASP Mobile**: M3 - Insufficient Authentication/Authorization

**Interview Question**: "How do you manage different authentication states in the app?"

**Defense**: "I use a four-state model: unauthenticated, authenticating, authenticated, and locked. This enables granular control over navigation, biometric re-authentication, and session management."

### 5. Activity-Based Auto-Logout

**Implementation**: `src/services/TokenManager.ts:trackActivity()`

**OWASP Mobile**: M3 - Insufficient Authentication/Authorization

**Interview Question**: "How do you ensure inactive sessions don't remain open?"

**Defense**: "I track user activity with a 5-minute timeout. Any API call resets the timer, but inactivity triggers automatic logout with secure token cleanup."

---

## 🏗️ API Security Layer

### 6. Typed API Client with Interceptors

**Implementation**: `src/api/ApiClient.ts`

**OWASP Mobile**: M5 - Insufficient Cryptography

**Interview Question**: "How do you ensure consistent security across all API calls?"

**Defense**: "I built a typed fetch wrapper with request/response interceptors for automatic auth header injection, error normalization, and timeout handling via AbortController."

### 7. Certificate Pinning Hook

**Implementation**: `src/api/ApiClient.ts:applyCertificatePinning()`

**OWASP Mobile**: M5 - Insufficient Cryptography

**Interview Question**: "How do you prevent MITM attacks in a banking app?"

**Defense**: "I implement certificate pinning to validate the server's SSL certificate against known fingerprints. This prevents attackers from intercepting traffic even with compromised CAs."

### 8. Comprehensive Error Model

**Implementation**: `src/models/AppError.ts`

**OWASP Mobile**: M10 - Insufficient Binary Protection

**Interview Question**: "How do you handle errors without exposing sensitive information?"

**Defense**: "I use a typed AppError model that normalizes all errors, strips sensitive data, and provides consistent error codes while maintaining stack traces in development only."

### 9. Mock Backend Service

**Implementation**: `src/services/MockBackendService.ts`

**OWASP Mobile**: N/A (Development Tool)

**Interview Question**: "How do you develop auth features without a real backend?"

**Defense**: "I built a mock backend that simulates real delays, token expiry, and error conditions. This enables parallel frontend development and comprehensive testing of edge cases."

---

## 📊 State Management Architecture

### 10. Server State via TanStack Query

**Implementation**: `src/lib/queryClient.ts`, `src/hooks/useTransactionQueries.ts`

**OWASP Mobile**: M5 - Insufficient Cryptography (caching sensitive data)

**Interview Question**: "How do you manage server state differently from UI state?"

**Defense**: "Server state has unique needs: background refresh, request deduplication, and cache invalidation. TanStack Query handles these automatically with stale-while-revalidate, providing instant UI updates with eventual consistency."

### 11. Client State via Zustand

**Implementation**: `src/store/uiStore.ts`

**OWASP Mobile**: M9 - Insecure Data Storage

**Interview Question**: "What belongs in client state versus server state?"

**Defense**: "Client state includes UI preferences, form inputs, and temporary state. Only non-sensitive preferences are persisted. Server data never goes in Zustand - it's managed by React Query for proper cache invalidation."

### 12. Stale-While-Revalidate Pattern

**Implementation**: `src/lib/queryClient.ts:staleTime`

**OWASP Mobile**: N/A (Performance Pattern)

**Interview Question**: "How do you balance data freshness with performance?"

**Defense**: "I use 30-second stale time with background refetch. Users see cached data instantly while fresh data loads behind the scenes, providing both speed and accuracy."

### 13. Smart Retry Logic

**Implementation**: `src/lib/queryClient.ts:retry`

**OWASP Mobile**: M8 - Security Misconfiguration

**Interview Question**: "How do you handle transient failures vs permanent errors?"

**Defense**: "I don't retry 4xx errors except 401 (handled by TokenManager). Network errors retry with exponential backoff capped at 30 seconds, preventing server overload while maintaining resilience."

### 14. Request Deduplication

**Implementation**: TanStack Query built-in

**OWASP Mobile**: N/A (Performance Pattern)

**Interview Question**: "How do you prevent duplicate API calls from multiple components?"

**Defense**: "TanStack Query automatically deduplicates identical requests. If multiple components request the same data, only one network call occurs, with all components receiving the result."

### 15. Optimistic Updates

**Implementation**: `src/hooks/useTransactionQueries.ts:useCreateTransaction`

**OWASP Mobile**: N/A (UX Pattern)

**Interview Question**: "How do you make the app feel faster for user actions?"

**Defense**: "I implement optimistic updates that immediately reflect changes in the UI, then rollback if the server request fails. This provides instant feedback while maintaining data integrity."

---

## 🧪 Testing Strategy

### 16. Comprehensive Test Coverage

**Implementation**: `__tests__` directories throughout

**OWASP Mobile**: M10 - Insufficient Binary Protection

**Interview Question**: "How do you ensure your auth system is bulletproof?"

**Defense**: "I maintain 80%+ test coverage with unit tests for business logic, integration tests for auth flows, and specific tests for edge cases like token refresh races and network failures."

### 17. Mock-First Development

**Implementation**: All test files use mocked dependencies

**OWASP Mobile**: N/A (Development Practice)

**Interview Question**: "How do you test auth flows without hitting real APIs?"

**Defense**: "I mock at the repository boundary, allowing full testing of business logic and error handling without network dependencies. This enables fast, reliable tests that catch regressions early."

---

## 🎯 Architecture Principles

### MVVM Pattern

**Structure**: View → ViewModel (hook) → Store → Repository → Data

**Interview Question**: "Why MVVM for a banking app?"

**Defense**: "MVVM separates concerns cleanly: Views handle UI, ViewModels manage state and logic, and Repositories abstract data sources. This enables parallel development, easier testing, and maintainable code."

### Separation of Concerns

- **Server State**: TanStack Query (caching, syncing, background refresh)
- **Auth State**: Zustand auth store (session management)
- **UI State**: Zustand UI store (filters, preferences)
- **Secure Storage**: Hardware-encrypted for sensitive data

**Interview Question**: "How do you decide what goes where?"

**Defense**: "Server data uses React Query for automatic sync. Auth state needs global access via Zustand. UI state that doesn't persist stays local. Sensitive data uses hardware encryption."

### Security-First Design

- Tokens never in AsyncStorage
- Single-use refresh tokens
- Hardware-backed encryption
- Certificate pinning ready
- Biometric authentication
- Activity tracking
- Secure session management

**Interview Question**: "What makes this implementation production-ready?"

**Defense**: "Every decision prioritizes security: hardware encryption for tokens, biometric gates for sensitive operations, certificate pinning for MITM protection, and comprehensive audit logging. The architecture follows OWASP Mobile guidelines throughout."

---

## 📈 Performance Optimizations

### Memoized Selectors

**Implementation**: `src/store/uiStore.ts:useTransactionFilters`

**Benefit**: Prevents unnecessary re-renders with shallow comparison

### Prefetching on Hover

**Implementation**: `src/hooks/useTransactionQueries.ts:usePrefetchTransaction`

**Benefit**: Instant navigation by loading data before user clicks

### Background Refresh

**Implementation**: `src/lib/queryClient.ts:refetchInterval`

**Benefit**: Fresh data without manual refresh

### Query Key Factory

**Implementation**: `src/lib/queryClient.ts:queryKeys`

**Benefit**: Type-safe cache invalidation and prevention of key collisions

---

## 🚀 Production Readiness Checklist

✅ **Authentication**
- [x] Hardware-backed token storage
- [x] Refresh token rotation
- [x] Biometric authentication
- [x] Activity-based logout
- [x] Single in-flight refresh

✅ **API Security**
- [x] Certificate pinning hook
- [x] Request/response interceptors
- [x] Comprehensive error handling
- [x] Timeout management
- [x] 401 auto-retry

✅ **State Management**
- [x] Server/client state separation
- [x] Stale-while-revalidate
- [x] Request deduplication
- [x] Optimistic updates
- [x] Smart retry logic

✅ **Testing**
- [x] Unit tests for auth flow
- [x] Integration tests for token refresh
- [x] Edge case coverage
- [x] Mocked dependencies
- [x] Error scenario testing

✅ **Performance**
- [x] Memoized selectors
- [x] Prefetching strategy
- [x] Background sync
- [x] Minimal re-renders
- [x] Efficient cache management

---

## 📝 Interview Answer Templates

### Q: "Walk me through your authentication flow"

**A**: "Users authenticate with credentials, receiving access and refresh tokens. Access tokens are kept in memory with a 15-minute expiry. Refresh tokens are stored in hardware-encrypted storage. On app resume, biometric authentication is required. The TokenManager handles 401s automatically, using single-use refresh tokens to get new access tokens. After 5 minutes of inactivity, the session ends."

### Q: "How do you handle concurrent 401 errors?"

**A**: "The TokenManager implements a singleton refresh promise. When the first 401 arrives, it starts the refresh. Subsequent 401s find the promise already exists and await the same result. This prevents multiple refresh attempts and token rotation race conditions."

### Q: "Why separate server and client state?"

**A**: "Server state needs background refresh, cache invalidation, and request deduplication - all handled by React Query. Client state like UI preferences needs different patterns - persistence, memoization, and global access via Zustand. Mixing them creates unnecessary complexity and re-render issues."

### Q: "How do you ensure this scales?"

**A**: "The architecture separates concerns clearly. New features add new query hooks and stores without touching existing code. The interceptor pattern allows cross-cutting concerns without modifying endpoints. Type safety catches errors at compile time. Comprehensive tests ensure refactoring safety."

### Q: "What security vulnerabilities does this prevent?"

**A**: "M3 (Insufficient Auth) - prevented by token rotation and biometric gates. M5 (Insufficient Crypto) - prevented by hardware encryption and certificate pinning. M9 (Insecure Storage) - prevented by never using AsyncStorage for sensitive data. The implementation follows OWASP Mobile Top 10 throughout."

---

## 🎓 Learning Resources

1. **OWASP Mobile Top 10**: https://owasp.org/www-project-mobile-top-10/
2. **TanStack Query**: https://tanstack.com/query/latest
3. **Zustand**: https://github.com/pmndrs/zustand
4. **Expo Secure Store**: https://docs.expo.dev/versions/latest/sdk/securestore/
5. **Expo Local Authentication**: https://docs.expo.dev/versions/latest/sdk/local-authentication/

---

## 📌 Key Takeaways

1. **Security is not optional** - Every decision should consider security implications
2. **State has different needs** - Don't put server state in client state stores
3. **User experience matters** - Optimistic updates and prefetching make apps feel instant
4. **Testing enables confidence** - Comprehensive tests catch issues before production
5. **Architecture enables scale** - Clean separation allows parallel development

This implementation demonstrates not just knowledge of React Native, but understanding of:
- Mobile security best practices
- Modern state management patterns
- Performance optimization techniques
- Production-ready error handling
- Scalable architecture design

The code is interview-defensible because every decision has a clear rationale based on security, performance, or maintainability requirements typical of banking applications.