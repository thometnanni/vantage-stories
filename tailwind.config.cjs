/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        panel: '#f5f5f4',
        ink: '#1f2937'
      },
      boxShadow: {
        panel: '0 12px 30px rgba(17, 24, 39, 0.18)'
      }
    }
  },
  plugins: []
}
