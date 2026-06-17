# Wanderly Frontend

React + Vite frontend untuk Trip Booking Backend.

## Menjalankan

Pastikan backend berjalan pada `http://localhost:3000`, lalu:

```bash
cd frontend
npm install
npm run dev
```

Frontend tersedia pada `http://localhost:5173`.

Admin dan user menggunakan halaman login yang sama:

```text
http://localhost:5173/login
```

Setelah login, role `admin` diarahkan ke `/admin`, sedangkan role `user`
diarahkan ke halaman explore `/`. Akun admin default dibuat dari folder backend:

```bash
npm run seed:admin
```

## Build

```bash
npm run build
```

JWT dan data user login disimpan di `localStorage`. Konfigurasi Axios berada di
`src/services/api.js`.
