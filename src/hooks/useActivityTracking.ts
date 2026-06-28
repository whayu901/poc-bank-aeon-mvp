import { useEffect } from 'react';
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
  const authService = AuthService.getInstance();

  // Track activity when screen gains focus
  useFocusEffect(() => {
    authService.trackActivity();
  });

  // Return a function that components can call on user interaction
  const trackActivity = () => {
    authService.trackActivity();
  };

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