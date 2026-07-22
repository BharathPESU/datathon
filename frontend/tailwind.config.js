/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: '#F8F6F1',
        navy: {
          DEFAULT: '#0E1B33',
          hover: '#16233F',
        },
        brand: {
          teal: '#14B8A6',
        },
        status: {
          successBg: '#DCFCE7', successText: '#16A34A',
          warnBg: '#FFEDD5',    warnText: '#D97706',
          dangerBg: '#FEE2E2',  dangerText: '#DC2626',
          infoBg: '#DBEAFE',    infoText: '#2563EB',
          specialBg: '#F3E8FF', specialText: '#7C3AED',
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
