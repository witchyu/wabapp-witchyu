import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    // เรียก /api จากหน้าเว็บ แล้วให้ Vite ส่งต่อไป backend (ไม่ต้องเปิดพอร์ต 4000 สู่ภายนอก และไม่ติด CORS)
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      // แชตเรียลไทม์ (Socket.IO / WebSocket) ผ่านพอร์ตเดียวกัน
      '/socket.io': { target: 'http://localhost:4000', changeOrigin: true, ws: true },
    },
  },
})
