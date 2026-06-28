import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

/**
 * UI Store - Client-side state only
 *
 * PRINCIPLE: This store contains ONLY UI/CLIENT state
 * Server state (transactions, user data) is managed by TanStack Query
 *
 * What belongs here:
 * - UI preferences (theme, language, layout)
 * - Form state (filters, search terms)
 * - UI toggles (sidebar open, modal visible)
 * - Temporary UI state
 *
 * What does NOT belong here:
 * - Data from API (use TanStack Query)
 * - Anything that needs background refresh
 * - Anything that multiple components fetch
 */

/**
 * Transaction filters (UI state)
 */
export interface TransactionFilters {
  search: string;
  type: 'all' | 'incoming' | 'outgoing';
  dateRange: 'week' | 'month' | 'all';
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

/**
 * UI preferences
 */
export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'en' | 'ms';
  compactView: boolean;
  showBalances: boolean; // Hide/show sensitive info
  animations: boolean;
}

/**
 * UI state interface
 */
interface UIStore {
  // Transaction UI state
  transactionFilters: TransactionFilters;
  setTransactionFilters: (filters: Partial<TransactionFilters>) => void;
  resetTransactionFilters: () => void;

  // UI preferences
  preferences: UIPreferences;
  setPreferences: (prefs: Partial<UIPreferences>) => void;

  // Sidebar/navigation state
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Modal state
  activeModal: string | null;
  openModal: (modalId: string) => void;
  closeModal: () => void;

  // Temporary UI state
  isRefreshing: boolean;
  setRefreshing: (refreshing: boolean) => void;

  // Notification state
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: number;
  }>;
  addNotification: (notification: Omit<UIStore['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

/**
 * Default filter values
 */
const defaultFilters: TransactionFilters = {
  search: '',
  type: 'all',
  dateRange: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
};

/**
 * Default preferences
 */
const defaultPreferences: UIPreferences = {
  theme: 'auto',
  language: 'en',
  compactView: false,
  showBalances: true,
  animations: true,
};

/**
 * UI store with persistence for preferences only
 */
export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Transaction filters (not persisted - reset on app restart)
        transactionFilters: defaultFilters,

        setTransactionFilters: (filters) =>
          set(
            (state) => ({
              transactionFilters: { ...state.transactionFilters, ...filters },
            }),
            false,
            'setTransactionFilters'
          ),

        resetTransactionFilters: () =>
          set({ transactionFilters: defaultFilters }, false, 'resetTransactionFilters'),

        // UI preferences (persisted)
        preferences: defaultPreferences,

        setPreferences: (prefs) =>
          set(
            (state) => ({
              preferences: { ...state.preferences, ...prefs },
            }),
            false,
            'setPreferences'
          ),

        // Sidebar state
        isSidebarOpen: false,

        toggleSidebar: () =>
          set((state) => ({ isSidebarOpen: !state.isSidebarOpen }), false, 'toggleSidebar'),

        setSidebarOpen: (open) =>
          set({ isSidebarOpen: open }, false, 'setSidebarOpen'),

        // Modal state
        activeModal: null,

        openModal: (modalId) =>
          set({ activeModal: modalId }, false, 'openModal'),

        closeModal: () =>
          set({ activeModal: null }, false, 'closeModal'),

        // Refresh state
        isRefreshing: false,

        setRefreshing: (refreshing) =>
          set({ isRefreshing: refreshing }, false, 'setRefreshing'),

        // Notifications
        notifications: [],

        addNotification: (notification) => {
          const id = `notification-${Date.now()}-${Math.random()}`;
          const newNotification = {
            ...notification,
            id,
            timestamp: Date.now(),
          };

          set(
            (state) => ({
              notifications: [...state.notifications, newNotification],
            }),
            false,
            'addNotification'
          );

          // Auto-remove after 5 seconds
          setTimeout(() => {
            get().removeNotification(id);
          }, 5000);
        },

        removeNotification: (id) =>
          set(
            (state) => ({
              notifications: state.notifications.filter((n) => n.id !== id),
            }),
            false,
            'removeNotification'
          ),

        clearNotifications: () =>
          set({ notifications: [] }, false, 'clearNotifications'),
      }),
      {
        name: 'ui-preferences', // Storage key
        partialize: (state) => ({
          // Only persist preferences
          preferences: state.preferences,
        }),
      }
    ),
    {
      name: 'ui-store',
    }
  )
);

/**
 * Memoized selectors for performance
 * Prevents unnecessary re-renders
 */

// Select transaction filters with shallow comparison
export const useTransactionFilters = () =>
  useUIStore((state) => state.transactionFilters, shallow);

// Select specific filter
export const useTransactionSearch = () =>
  useUIStore((state) => state.transactionFilters.search);

export const useTransactionType = () =>
  useUIStore((state) => state.transactionFilters.type);

// Select preferences with shallow comparison
export const useUIPreferences = () =>
  useUIStore((state) => state.preferences, shallow);

// Select specific preference
export const useTheme = () =>
  useUIStore((state) => state.preferences.theme);

export const useLanguage = () =>
  useUIStore((state) => state.preferences.language);

export const useShowBalances = () =>
  useUIStore((state) => state.preferences.showBalances);

// Select sidebar state
export const useIsSidebarOpen = () =>
  useUIStore((state) => state.isSidebarOpen);

// Select modal state
export const useActiveModal = () =>
  useUIStore((state) => state.activeModal);

// Select notifications
export const useNotifications = () =>
  useUIStore((state) => state.notifications);

// Select refresh state
export const useIsRefreshing = () =>
  useUIStore((state) => state.isRefreshing);

/**
 * Action selectors
 */
export const useUIActions = () =>
  useUIStore(
    (state) => ({
      setTransactionFilters: state.setTransactionFilters,
      resetTransactionFilters: state.resetTransactionFilters,
      setPreferences: state.setPreferences,
      toggleSidebar: state.toggleSidebar,
      openModal: state.openModal,
      closeModal: state.closeModal,
      setRefreshing: state.setRefreshing,
      addNotification: state.addNotification,
    }),
    shallow
  );