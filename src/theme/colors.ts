export const colors = {
  // Base backgrounds — dark-first
  bg: {
    primary:   '#0A0A0F',
    secondary: '#111118',
    tertiary:  '#1A1A24',
    glass:     'rgba(255, 255, 255, 0.04)',
  },

  // Electric cyan — the single brand accent
  accent:          '#00E5FF',
  accentDim:       '#00B8CC',
  accentGlow:      'rgba(0, 229, 255, 0.15)',
  accentGlowSoft:  'rgba(0, 229, 255, 0.06)',

  // Risk — semantic only, never decorative
  risk: {
    low:       '#00E676',
    lowGlow:   'rgba(0, 230, 118, 0.12)',
    lowBorder: 'rgba(0, 230, 118, 0.30)',
    medium:    '#FFD740',
    high:      '#FF3D3D',
    highGlow:  'rgba(255, 61, 61, 0.20)',
  },

  // Text
  text: {
    primary:   '#F0F0F5',
    secondary: '#8888A0',
    tertiary:  '#555568',
    inverse:   '#0A0A0F',
  },

  // Borders
  border: {
    subtle:  'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    accent:  'rgba(0, 229, 255, 0.30)',
  },
} as const;
