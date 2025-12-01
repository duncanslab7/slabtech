import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SLAB Brand Colors
        "midnight-blue": "#2c3e50",
        "steel-gray": "#34495e",
        "success-gold": "#f39c12",
        "pure-white": "#FFFFFF",
        "charcoal": "#1a1a1a",

        // Legacy variables for compatibility
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      fontSize: {
        // Brand typography scale
        'heading-xl': ['36px', { lineHeight: '1.2', fontWeight: '700' }],
        'heading-lg': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        'tagline': ['20px', { lineHeight: '1.4', fontWeight: '700' }],
        'tagline-sm': ['16px', { lineHeight: '1.4', fontWeight: '700' }],
        'body': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
export default config;
