export const lightColors = {
  primary: '#7B1FA2',
  primaryDark: '#4A148C',
  accent: '#E91E63',
  background: '#F8F6FB',
  surface: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  success: '#138A36',
  successBg: '#EAF7EE',
  danger: '#C2410C',
  dangerBg: '#FFF1E8',
  border: '#E5E7EB',
} as const;

export const darkColors = {
  primary: '#CE93D8',
  primaryDark: '#AB47BC',
  accent: '#F48FB1',
  background: '#15111A',
  surface: '#211827',
  textPrimary: '#F4F2F7',
  textSecondary: '#C9C1D2',
  textMuted: '#9B91A6',
  success: '#7DDC98',
  successBg: '#173623',
  danger: '#F6A57A',
  dangerBg: '#3A2118',
  border: '#3B3142',
} as const;

export type AppColors = typeof lightColors;
