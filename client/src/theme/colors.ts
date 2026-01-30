/**
 * @file client/src/theme/colors.ts
 * @description Neo-brutalist color palette for Collab/FyndMate
 */

export const COLORS = {
  // Primary Colors
  primary: '#6366F1',       // Indigo
  primaryGradient: '#8B5CF6', // Purple (for gradients)
  
  // Secondary/Accent Colors
  accent: '#EC4899',        // Pink
  accentLight: '#F9A8D4',   // Light Pink
  accentDark: '#BE185D',    // Dark Pink
  
  yellow: '#FDE047',        // Yellow for stars/highlights
  
  // Backgrounds
  background: '#FAFAFA',    // Light background
  surface: '#FFFFFF',       // White cards
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  
  // Text Colors
  textPrimary: '#000000',   // Black
  textSecondary: '#374151', // Dark gray
  textMuted: '#6B7280',     // Gray
  textLight: '#9CA3AF',     // Light gray
  
  // Semantic Colors
  success: '#22C55E',       // Green
  successLight: '#BBF7D0',
  danger: '#DC2626',        // Red
  
  // Chip/Tag Colors
  skillBg: '#EDE9FE',       // Purple tint
  skillText: '#5B21B6',     // Dark purple
  lookingBg: '#FCE7F3',     // Pink tint
  lookingText: '#BE185D',   // Dark pink
  greenBg: '#F0FDF4',       // Green tint
  greenText: '#047857',     // Dark green
  
  // Neo-brutalist
  border: '#000000',        // Black borders
  shadow: '#000000',        // Black shadows
  
  // Navigation
  navBackground: '#FFFFFF',
  navActive: '#5B21B6',
  navInactive: '#9CA3AF',
};

// Neo-brutalist shadows
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
};

export const BORDERS = {
  thin: 2,
  medium: 3,
  thick: 4,
};

export const RADIUS = {
  small: 8,
  medium: 12,
  large: 16,
  xl: 20,
  full: 9999,
};
