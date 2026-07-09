/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{ts,tsx,html}", "./dist/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        brand: { 50:"#0b1220",100:"#0f182a",200:"#121d33",300:"#15243f",400:"#1b2f54",
                 500:"#21396a",600:"#2b4b8f",700:"#3360b8",800:"#3a70db",900:"#4a84ff" }
      },
      boxShadow: { soft: "0 6px 20px rgba(0,0,0,.25)" },
      borderRadius: { xl: "14px" },
      spacing: { 'xs':'0.375rem' }
    }
  },
  plugins: []
}