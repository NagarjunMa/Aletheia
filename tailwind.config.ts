import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        brand: ["var(--font-flaviotte)", "Georgia", "serif"],
      },
      fontSize: {
        "fluid-xs": "clamp(0.75rem, calc(0.7rem + 0.25vw), 0.875rem)",
        "fluid-sm": "clamp(0.875rem, calc(0.8rem + 0.375vw), 1rem)",
        "fluid-base": "clamp(1rem, calc(0.9rem + 0.5vw), 1.125rem)",
        "fluid-lg": "clamp(1.125rem, calc(1rem + 0.625vw), 1.25rem)",
        "fluid-xl": "clamp(1.25rem, calc(1.1rem + 0.75vw), 1.5rem)",
        "fluid-2xl": "clamp(1.5rem, calc(1.3rem + 1vw), 2rem)",
        "fluid-3xl": "clamp(1.875rem, calc(1.6rem + 1.375vw), 2.5rem)",
        "fluid-4xl": "clamp(2.25rem, calc(1.9rem + 1.75vw), 3.5rem)",
        "fluid-5xl": "clamp(3rem, calc(2.5rem + 2.5vw), 4.5rem)",
        "fluid-6xl": "clamp(3.75rem, calc(3rem + 3.75vw), 6rem)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Compatibility aliases, remapped to the canonical Phthalo palette.
        aletheia: {
          primary: "#10291F",
          "primary-light": "#285D49",
          "primary-dark": "#020403",
          accent: "#5A9D82",
          "accent-light": "#F7FAF9",
          "accent-dark": "#285D49",

          // Glass Morphism Colors
          glass: "rgba(255, 255, 255, 0.05)",
          "glass-dark": "rgba(0, 0, 0, 0.1)",
          "glass-border": "rgba(255, 255, 255, 0.1)",

          // Background System
          bg: "#020403",
          "bg-light": "#091814",
          "bg-lighter": "#10291F",

          // Text System
          text: "#F7FAF9",
          "text-muted": "#AEBDB7",
          "text-dim": "#7E9189",

          // Surface Colors
          surface: "#091814",
          "surface-light": "#10291F",
          "surface-hover": "#1E4938",

          // Status Colors
          success: "#10b981", // Emerald
          warning: "#f59e0b", // Amber
          error: "#ef4444", // Red
          info: "#5A9D82",
        },

        // Deprecated names retained until all legacy class names are removed.
        ambient: {
          blue: "#5A9D82",
          "blue-light": "#F7FAF9",
          "blue-dark": "#285D49",
        },

        // Aletheia Chat UI Theme
        aletheia2: {
          accent: "#5A9D82",
          "accent-light": "#F7FAF9",
          "accent-dark": "#285D49",
          bg: "#020403",
          "bg-light": "#091814",
          "bg-dark": "#10291F",
          text: "#F7FAF9",
          "text-muted": "#F7FAF9B3",
          "text-dim": "#F7FAF966",
          "text-faint": "#F7FAF933",
          glass: "rgba(0, 0, 0, 0.7)",
          "glass-border": "rgba(120, 180, 155, 0.18)",
        },
        cortex: {
          orange: "#FF6B35",
          "orange-hover": "#E55A2B",
          "orange-light": "#FF8C65",
          dark: "#0A0A0A",
          "dark-light": "#1A1A1A",
          gray: "#2A2A2A",
          "gray-light": "#666666",
          "gray-muted": "#999999",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        typing: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        blink: {
          "0%, 50%": { opacity: "1" },
          "51%, 100%": { opacity: "0" },
        },
        "globe-rotate": {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
        "binary-pulse": {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "slide-up": {
          from: {
            opacity: "0",
            transform: "translateY(30px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-in-left": {
          from: {
            opacity: "0",
            transform: "translateX(-30px)",
          },
          to: {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        "scale-in": {
          from: {
            opacity: "0",
            transform: "scale(0.95)",
          },
          to: {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        // Simple, stable animations
        "fade-in-up": {
          from: {
            opacity: "0",
            transform: "translateY(10px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        typing: "typing 2s steps(20) infinite",
        blink: "blink 1s infinite",
        "globe-rotate": "globe-rotate 20s linear infinite",
        "binary-pulse": "binary-pulse 2s ease-in-out infinite",
        "gradient-shift": "gradient-shift 3s ease-in-out infinite",
        "slide-up": "slide-up 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "slide-in-left":
          "slide-in-left 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "scale-in": "scale-in 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "delay-100":
          "slide-up 0.6s cubic-bezier(0.25, 1, 0.5, 1) 0.1s forwards",
        "delay-200":
          "slide-up 0.6s cubic-bezier(0.25, 1, 0.5, 1) 0.2s forwards",
        "delay-300":
          "slide-up 0.6s cubic-bezier(0.25, 1, 0.5, 1) 0.3s forwards",
        "delay-500":
          "slide-up 0.6s cubic-bezier(0.25, 1, 0.5, 1) 0.5s forwards",
        // Clean animations
        "fade-in-up": "fade-in-up 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
