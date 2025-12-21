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
        // SLAB Thermal Camera Theme
        // Cool/Background colors (like thermal camera cold zones)
        "thermal-deep": "#0a0a2e",      // Very dark blue-black
        "thermal-dark": "#16213e",      // Dark navy blue
        "thermal-blue": "#1a1a4d",      // Deep blue
        "thermal-purple": "#2d1b69",    // Dark purple

        // Warm/Hot colors (like thermal camera heat signatures)
        "thermal-red": "#ff0844",       // Bright red
        "thermal-orange": "#ff5733",    // Vibrant orange
        "thermal-yellow": "#ffdd00",    // Bright yellow
        "thermal-gold": "#ffd700",      // Golden glow

        // Mid-tone transitions
        "thermal-magenta": "#9d4edd",   // Purple-magenta
        "thermal-cyan": "#00d9ff",      // Bright cyan accent

        // Legacy SLAB colors (keeping for compatibility)
        "midnight-blue": "#2c3e50",
        "steel-gray": "#34495e",
        "success-gold": "#f39c12",
        "pure-white": "#FFFFFF",
        "charcoal": "#1a1a1a",

        // Legacy variables for compatibility
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        'thermal-glow': '0 0 20px rgba(255, 221, 0, 0.6), 0 0 40px rgba(255, 221, 0, 0.4)',
        'thermal-glow-red': '0 0 20px rgba(255, 8, 68, 0.6), 0 0 40px rgba(255, 8, 68, 0.4)',
        'thermal-glow-orange': '0 0 20px rgba(255, 87, 51, 0.6), 0 0 40px rgba(255, 87, 51, 0.4)',
      },
      animation: {
        'thermal-pulse': 'thermalPulse 2s ease-in-out infinite',
        'thermal-flicker': 'thermalFlicker 3s ease-in-out infinite',
        'scroll': 'scroll 30s linear infinite',
      },
      keyframes: {
        thermalPulse: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        thermalFlicker: {
          '0%, 100%': { opacity: '1' },
          '10%': { opacity: '0.9' },
          '20%': { opacity: '1' },
          '30%': { opacity: '0.95' },
          '40%': { opacity: '1' },
          '50%': { opacity: '0.92' },
          '60%': { opacity: '1' },
        },
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
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
