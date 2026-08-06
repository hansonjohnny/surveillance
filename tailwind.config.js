/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-primary':   '#0A0A0F',
        'bg-secondary': '#111118',
        'bg-tertiary':  '#1A1A24',
        'bg-glass':     'rgba(255, 255, 255, 0.04)',

        // Accent
        accent:          '#00E5FF',
        'accent-dim':    '#00B8CC',
        'accent-glow':   'rgba(0, 229, 255, 0.15)',

        // Risk
        'risk-low':    '#00E676',
        'risk-medium': '#FFD740',
        'risk-high':   '#FF3D3D',

        // Text
        'text-primary':   '#F0F0F5',
        'text-secondary': '#8888A0',
        'text-tertiary':  '#555568',
        'text-inverse':   '#0A0A0F',

        // Borders (referenced by name in component styles)
        'border-subtle':  'rgba(255, 255, 255, 0.06)',
        'border-default': 'rgba(255, 255, 255, 0.10)',
        'border-accent':  'rgba(0, 229, 255, 0.30)',
      },

      fontFamily: {
        'display-bold': ['Outfit_700Bold'],
        'display-semi': ['Outfit_600SemiBold'],
        'body':         ['DMSans_400Regular'],
        'body-medium':  ['DMSans_500Medium'],
        'mono':         ['JetBrainsMono_400Regular'],
      },

      fontSize: {
        'display-lg': ['36px', { lineHeight: '44px', letterSpacing: '-0.5px' }],
        'display-md': ['28px', { lineHeight: '36px', letterSpacing: '-0.5px' }],
        'display-sm': ['22px', { lineHeight: '30px', letterSpacing: '-0.5px' }],
        'heading-lg': ['20px', { lineHeight: '28px' }],
        'heading-md': ['17px', { lineHeight: '24px' }],
        'heading-sm': ['15px', { lineHeight: '22px' }],
        'body-lg':    ['16px', { lineHeight: '26px' }],
        'body-md':    ['14px', { lineHeight: '22px' }],
        'body-sm':    ['12px', { lineHeight: '18px' }],
        'label-lg':   ['15px', { lineHeight: '20px', letterSpacing: '0.3px' }],
        'label-md':   ['13px', { lineHeight: '18px', letterSpacing: '0.3px' }],
        'label-sm':   ['11px', { lineHeight: '16px', letterSpacing: '0.3px' }],
        'data-lg':    ['16px', { lineHeight: '24px' }],
        'data-md':    ['13px', { lineHeight: '20px' }],
        'data-sm':    ['11px', { lineHeight: '16px' }],
      },

      spacing: {
        xs:    '4px',
        sm:    '8px',
        md:    '16px',
        lg:    '24px',
        xl:    '32px',
        xxl:   '48px',
        xxxl:  '64px',
        screen: '20px',
      },

      borderRadius: {
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
