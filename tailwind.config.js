/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // The site ships a hand-written global stylesheet; Tailwind's base reset would fight it.
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
