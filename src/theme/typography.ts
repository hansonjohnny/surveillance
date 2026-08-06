import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  // Display — onboarding headlines and major screens
  displayLarge:  { fontFamily: 'Outfit_700Bold',         fontSize: 36, lineHeight: 44, letterSpacing: -0.5 },
  displayMedium: { fontFamily: 'Outfit_700Bold',         fontSize: 28, lineHeight: 36, letterSpacing: -0.5 },
  displaySmall:  { fontFamily: 'Outfit_600SemiBold',     fontSize: 22, lineHeight: 30, letterSpacing: -0.5 },

  // Headings — screen titles, section headers
  headingLarge:  { fontFamily: 'Outfit_600SemiBold',     fontSize: 20, lineHeight: 28 },
  headingMedium: { fontFamily: 'Outfit_600SemiBold',     fontSize: 17, lineHeight: 24 },
  headingSmall:  { fontFamily: 'DMSans_500Medium',       fontSize: 15, lineHeight: 22 },

  // Body — paragraphs, descriptions, card content
  bodyLarge:     { fontFamily: 'DMSans_400Regular',      fontSize: 16, lineHeight: 26 },
  bodyMedium:    { fontFamily: 'DMSans_400Regular',      fontSize: 14, lineHeight: 22 },
  bodySmall:     { fontFamily: 'DMSans_400Regular',      fontSize: 12, lineHeight: 18 },

  // Labels — buttons, tags, badges
  labelLarge:    { fontFamily: 'DMSans_500Medium',       fontSize: 15, lineHeight: 20, letterSpacing: 0.3 },
  labelMedium:   { fontFamily: 'DMSans_500Medium',       fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
  labelSmall:    { fontFamily: 'DMSans_500Medium',       fontSize: 11, lineHeight: 16, letterSpacing: 0.3 },

  // Data — timestamps, coordinates, risk scores
  dataLarge:     { fontFamily: 'JetBrainsMono_400Regular', fontSize: 16, lineHeight: 24 },
  dataMedium:    { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, lineHeight: 20 },
  dataSmall:     { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, lineHeight: 16 },
};

export const fontFamilies = {
  displayBold:    'Outfit_700Bold',
  displaySemi:    'Outfit_600SemiBold',
  bodyRegular:    'DMSans_400Regular',
  bodyMedium:     'DMSans_500Medium',
  mono:           'JetBrainsMono_400Regular',
} as const;
