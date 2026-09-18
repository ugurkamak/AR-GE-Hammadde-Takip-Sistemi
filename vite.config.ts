import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages icin base yolu: https://KULLANICIADI.github.io/arge-hammadde/
// Depo adini degistirirsen burayi da degistir.
export default defineConfig({
  plugins: [react()],
  base: '/arge-hammadde/',
})
