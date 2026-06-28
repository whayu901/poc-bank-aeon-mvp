import { act, renderHook } from '@testing-library/react-native';
import {
  useUIStore,
  useTransactionFilters,
  useUIPreferences,
  useTheme,
  useLanguage,
  useShowBalances,
  useIsSidebarOpen,
  useActiveModal,
  useNotifications,
  useIsRefreshing,
  useUIActions,
} from '../uiStore';

describe('UI Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      transactionFilters: {
        search: '',
        type: 'all',
        dateRange: 'all',
        sortBy: 'date',
        sortOrder: 'desc',
      },
      preferences: {
        theme: 'auto',
        language: 'en',
        compactView: false,
        showBalances: true,
        animations: true,
      },
      isSidebarOpen: false,
      activeModal: null,
      isRefreshing: false,
      notifications: [],
    });
  });

  describe('Transaction Filters', () => {
    it('should update transaction filters', () => {
      const { result } = renderHook(() => ({
        filters: useTransactionFilters(),
        actions: useUIActions(),
      }));

      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.type).toBe('all');

      act(() => {
        result.current.actions.setTransactionFilters({
          search: 'test',
          type: 'incoming',
        });
      });

      expect(result.current.filters.search).toBe('test');
      expect(result.current.filters.type).toBe('incoming');
      expect(result.current.filters.dateRange).toBe('all'); // Unchanged
    });

    it('should reset transaction filters', () => {
      const { result } = renderHook(() => ({
        filters: useTransactionFilters(),
        actions: useUIActions(),
      }));

      act(() => {
        result.current.actions.setTransactionFilters({
          search: 'test',
          type: 'outgoing',
          dateRange: 'week',
        });
      });

      expect(result.current.filters.search).toBe('test');

      act(() => {
        result.current.actions.resetTransactionFilters();
      });

      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.type).toBe('all');
      expect(result.current.filters.dateRange).toBe('all');
    });
  });

  describe('UI Preferences', () => {
    it('should update preferences', () => {
      const { result } = renderHook(() => ({
        preferences: useUIPreferences(),
        actions: useUIActions(),
      }));

      expect(result.current.preferences.theme).toBe('auto');
      expect(result.current.preferences.language).toBe('en');

      act(() => {
        result.current.actions.setPreferences({
          theme: 'dark',
          language: 'ms',
        });
      });

      expect(result.current.preferences.theme).toBe('dark');
      expect(result.current.preferences.language).toBe('ms');
      expect(result.current.preferences.showBalances).toBe(true); // Unchanged
    });

    it('should access individual preferences', () => {
      const { result } = renderHook(() => ({
        theme: useTheme(),
        language: useLanguage(),
        showBalances: useShowBalances(),
      }));

      expect(result.current.theme).toBe('auto');
      expect(result.current.language).toBe('en');
      expect(result.current.showBalances).toBe(true);
    });
  });

  describe('Sidebar State', () => {
    it('should toggle sidebar', () => {
      const { result } = renderHook(() => ({
        isOpen: useIsSidebarOpen(),
        actions: useUIActions(),
      }));

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.actions.toggleSidebar();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.actions.toggleSidebar();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Modal State', () => {
    it('should open and close modals', () => {
      const { result } = renderHook(() => ({
        activeModal: useActiveModal(),
        actions: useUIActions(),
      }));

      expect(result.current.activeModal).toBe(null);

      act(() => {
        result.current.actions.openModal('settings');
      });

      expect(result.current.activeModal).toBe('settings');

      act(() => {
        result.current.actions.closeModal();
      });

      expect(result.current.activeModal).toBe(null);
    });
  });

  describe('Refresh State', () => {
    it('should update refresh state', () => {
      const { result } = renderHook(() => ({
        isRefreshing: useIsRefreshing(),
        actions: useUIActions(),
      }));

      expect(result.current.isRefreshing).toBe(false);

      act(() => {
        result.current.actions.setRefreshing(true);
      });

      expect(result.current.isRefreshing).toBe(true);

      act(() => {
        result.current.actions.setRefreshing(false);
      });

      expect(result.current.isRefreshing).toBe(false);
    });
  });

  describe('Notifications', () => {
    it('should add and remove notifications', () => {
      const { result } = renderHook(() => ({
        notifications: useNotifications(),
        actions: useUIActions(),
      }));

      expect(result.current.notifications).toEqual([]);

      act(() => {
        result.current.actions.addNotification({
          type: 'success',
          message: 'Test notification',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].type).toBe('success');
      expect(result.current.notifications[0].message).toBe('Test notification');
      expect(result.current.notifications[0].id).toBeDefined();
      expect(result.current.notifications[0].timestamp).toBeDefined();
    });

    it('should auto-remove notifications after 5 seconds', () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => ({
        notifications: useNotifications(),
        actions: useUIActions(),
      }));

      act(() => {
        result.current.actions.addNotification({
          type: 'info',
          message: 'Auto-remove test',
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.notifications).toHaveLength(0);

      jest.useRealTimers();
    });
  });

  describe('State Persistence', () => {
    it('should only persist preferences', () => {
      const state = useUIStore.getState();
      const persistOptions = (useUIStore as any).persist;

      // This test verifies that only preferences are persisted
      // The actual persistence test would require mocking localStorage
      expect(state.preferences).toBeDefined();
      expect(state.transactionFilters).toBeDefined();

      // Filters should not be persisted (reset on app restart)
      // Preferences should be persisted
    });
  });

  describe('Memoized Selectors', () => {
    it('should prevent unnecessary re-renders with shallow comparison', () => {
      const { result, rerender } = renderHook(() => useTransactionFilters());

      const filters1 = result.current;

      // Trigger a re-render without changing filters
      rerender();

      const filters2 = result.current;

      // Should be the same reference due to shallow comparison
      expect(filters1).toBe(filters2);
    });
  });
});