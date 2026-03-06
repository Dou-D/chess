/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 12px 30px -15px rgba(28, 25, 23, 0.35)",
      },
    },
  },
  plugins: [],
};
