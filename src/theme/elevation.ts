import { ViewStyle } from 'react-native';

export const elevation: Record<string, ViewStyle> = {
  // Standard card lift — barely visible
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },

  // Active states, shield pulse, live indicators
  glowAccent: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 0,
  },

  // High-risk alerts
  glowDanger: {
    shadowColor: '#FF3D3D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 0,
  },
};
