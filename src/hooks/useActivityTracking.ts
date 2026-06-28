import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AuthService } from '@/services/AuthService';

/**
 * Custom hook to track user activity in React Native
 *
 * Usage:
 * - Add to screens to track navigation
 * - Add to interactive components to track user interactions
 *
 * This replaces browser event listeners that don't exist in React Native
 */
export function useActivityTracking() {
  // Track activity when screen gains focus
  // Must use useCallback to avoid infinite loops
  useFocusEffect(
    useCallback(() => {
      // Get instance inside the callback to avoid re-renders
      const authService = AuthService.getInstance();
      authService.trackActivity();
      // No cleanup needed
    }, [])
  );

  // Return a memoized function that components can call on user interaction
  const trackActivity = useCallback(() => {
    const authService = AuthService.getInstance();
    authService.trackActivity();
  }, []);

  return { trackActivity };
}

/**
 * Hook to track activity on component mount
 * Use this for components that don't need navigation focus tracking
 */
export function useActivityTrackingOnMount() {
  const authService = AuthService.getInstance();

  useEffect(() => {
    authService.trackActivity();
  }, []);

  const trackActivity = () => {
    authService.trackActivity();
  };

  return { trackActivity };
}