import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic colors backed by CSS variables for runtime theming
        primary: 'hsl(var(--color-primary))',
        onprimary: 'hsl(var(--color-on-primary))',
        bg: 'hsl(var(--color-bg))',
        text: 'hsl(var(--color-text))',
        surface: 'hsl(var(--color-surface))',
        border: 'hsl(var(--color-border))',
        // Optional accents
        accent: 'hsl(var(--color-accent))',
      },
    },
  },
  plugins: [],
} satisfies Config;
