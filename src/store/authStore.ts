import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Authentication states for the app
 */
export type AuthState =
  | "unauthenticated" // No session, user needs to login
  | "authenticating" // Login in progress
  | "authenticated" // Valid session, full access
  | "locked"; // Session exists but needs biometric unlock

/**
 * User information from auth
 */
export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  lastLogin: Date;
}

/**
 * Auth store state interface
 */
interface AuthStoreState {
  // State
  authState: AuthState;
  user: AuthUser | null;
  accessToken: string | null; // Kept in memory only, never persisted
  tokenExpiresAt: number | null; // Timestamp when token expires
  biometricEnabled: boolean;
  lastActivity: number; // Timestamp of last user activity

  // Actions
  setAuthState: (state: AuthState) => void;
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null, expiresIn?: number) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  updateLastActivity: () => void;

  // Complex actions
  login: (user: AuthUser, accessToken: string, expiresIn: number) => void;
  logout: () => void;
  lockSession: () => void;
  unlockSession: () => void;

  // Helpers
  isTokenExpired: () => boolean;
  isSessionActive: () => boolean;
  shouldRequireBiometric: () => boolean;
}

/**
 * Auth store for managing authentication state
 *
 * Security principles:
 * - Access token stored in memory only (never persisted)
 * - Refresh token in SecureStore (hardware-backed)
 * - Session lock state for biometric re-authentication
 * - Activity tracking for auto-logout
 */
export const useAuthStore = create<AuthStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state
      authState: "unauthenticated",
      user: null,
      accessToken: null,
      tokenExpiresAt: null,
      biometricEnabled: false,
      lastActivity: Date.now(),

      // Basic setters
      setAuthState: (authState) => set({ authState }, false, "setAuthState"),

      setUser: (user) => set({ user }, false, "setUser"),

      setAccessToken: (accessToken, expiresIn) => {
        const tokenExpiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

        set({ accessToken, tokenExpiresAt }, false, "setAccessToken");
      },

      setBiometricEnabled: (biometricEnabled) =>
        set({ biometricEnabled }, false, "setBiometricEnabled"),

      updateLastActivity: () =>
        set({ lastActivity: Date.now() }, false, "updateLastActivity"),

      // Complex actions
      login: (user, accessToken, expiresIn) => {
        const tokenExpiresAt = Date.now() + expiresIn * 1000;

        set(
          {
            authState: "authenticated",
            user,
            accessToken,
            tokenExpiresAt,
            lastActivity: Date.now(),
          },
          false,
          "login",
        );
      },

      logout: () => {
        set(
          {
            authState: "unauthenticated",
            user: null,
            accessToken: null,
            tokenExpiresAt: null,
            lastActivity: Date.now(),
          },
          false,
          "logout",
        );
      },

      lockSession: () => {
        // Keep user and token info but require biometric
        set(
          {
            authState: "locked",
            accessToken: null, // Clear from memory for security
          },
          false,
          "lockSession",
        );
      },

      unlockSession: () => {
        // Restore session after biometric success
        // Note: Access token needs to be refreshed after unlock
        set(
          {
            authState: "authenticated",
            lastActivity: Date.now(),
          },
          false,
          "unlockSession",
        );
      },

      // Helper methods
      isTokenExpired: () => {
        const state = get();
        if (!state.tokenExpiresAt) return true;

        // Add 5 second buffer to avoid edge cases
        return Date.now() >= state.tokenExpiresAt - 5000;
      },

      isSessionActive: () => {
        const state = get();
        return state.authState === "authenticated" && !state.isTokenExpired();
      },

      shouldRequireBiometric: () => {
        const state = get();
        return state.biometricEnabled && state.authState === "locked";
      },
    }),
    {
      name: "auth-store",
    },
  ),
);

// Selector hooks for common use cases
// Using stable selectors to avoid re-renders
const selectIsAuthenticated = (state: AuthStoreState) =>
  state.authState === "authenticated";
const selectIsLocked = (state: AuthStoreState) => state.authState === "locked";
const selectAuthUser = (state: AuthStoreState) => state.user;
const selectAuthState = (state: AuthStoreState) => state.authState;
const selectSetAuthState = (state: AuthStoreState) => state.setAuthState;

export const useIsAuthenticated = () => useAuthStore(selectIsAuthenticated);
export const useIsLocked = () => useAuthStore(selectIsLocked);
export const useAuthUser = () => useAuthStore(selectAuthUser);
export const useAuthState = () => useAuthStore(selectAuthState);
export const useSetAuthState = () => useAuthStore(selectSetAuthState);
