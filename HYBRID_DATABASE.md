# Hybrid Database

Project ini menggunakan pendekatan hybrid database dengan dual write. MongoDB
tetap menjadi primary database aplikasi agar seluruh endpoint, flow frontend,
dan fitur yang sudah berjalan tidak berubah. MySQL digunakan sebagai relational
mirror database untuk merepresentasikan data terstruktur dan relasi antar
entitas.

Setelah operasi MongoDB berhasil, backend menyalin data relasional terkait ke
MySQL. Jika mirror SQL gagal, operasi utama MongoDB dan response aplikasi tetap
berjalan. Error mirror dicatat di log server dengan prefix `[SQL mirror]`.

## Pembagian Data

MySQL digunakan untuk data terstruktur dan berelasi:

- `users`, termasuk role `admin`
- `trips`
- `destinations`
- `trip_destinations` sebagai relasi many-to-many
- `bookings`
- `payments`
- `booking_history`

MongoDB digunakan untuk kebutuhan aplikasi yang sudah berjalan dan data yang
lebih fleksibel, terutama:

- `reviews`
- rating
- foto atau dokumentasi trip
- feedback dengan struktur yang dapat berkembang
- `wishlists` tetap disimpan di MongoDB karena schema SQL saat ini tidak
  menyediakan tabel wishlist

Kolom `mongo_id` pada tabel SQL menghubungkan row mirror dengan `_id` dokumen
MongoDB. Penulisan menggunakan upsert sehingga sinkronisasi ulang tidak membuat
row duplikat.

## Alur Dual Write

1. Controller memvalidasi request dan menyimpan data ke MongoDB.
2. Setelah MongoDB berhasil, service `src/services/sqlMirrorService.js`
   meng-upsert salinan relasional ke MySQL.
3. Dependency foreign key seperti user, trip, dan destination ikut disinkronkan.
4. Perubahan status booking disimpan ke `booking_history`.
5. Kegagalan MySQL hanya menghasilkan log dan tidak membatalkan operasi MongoDB.

Dual write diterapkan pada:

- registrasi user dan perubahan verifikasi user
- create/update trip serta relasi `trip_destinations`
- create/update destination
- create booking dan perubahan status booking
- create/update payment

## Menjalankan MongoDB

Pastikan `MONGODB_URI` di `.env` mengarah ke MongoDB lokal atau MongoDB Atlas,
lalu jalankan backend seperti biasa:

```bash
npm install
npm start
```

MongoDB tetap wajib tersedia karena merupakan database utama aplikasi.

## Menjalankan MySQL

1. Jalankan service MySQL.
2. Sesuaikan konfigurasi SQL di `.env`:

```env
SQL_HOST=localhost
SQL_USER=root
SQL_PASSWORD=
SQL_DATABASE=trip_booking_sql
SQL_PORT=3306
```

3. Buat database dan tabel dengan schema:

```bash
mysql -u root -p < database/schema.sql
```

Jika user MySQL tidak memiliki password, jalankan tanpa opsi `-p`.

Untuk database yang dibuat sebelum fitur dual write, jalankan migrasi:

```bash
mysql -u root -p < database/dual_write_migration.sql
```

## Endpoint SQL

- `GET /api/sql/health` memeriksa koneksi MySQL.
- `GET /api/sql/summary` menampilkan jumlah baris pada seluruh tabel SQL.

Contoh response health yang berhasil:

```json
{
  "message": "SQL connected successfully"
}
```

Endpoint SQL tidak mengganti endpoint lama dan tidak dipakai oleh frontend.

- `GET /api/sql/mirror-check` membandingkan jumlah data MongoDB dan SQL untuk
  `users`, `destinations`, `trips`, `bookings`, dan `payments`.

## Test Dual Write

Dengan backend berjalan pada port `3001`, jalankan:

```bash
npm run test:dual-write
```

Script membuat data test melalui endpoint aplikasi dan memastikan user,
destination, trip, relasi trip-destination, booking, payment, dan
booking-history tersedia di SQL berdasarkan `mongo_id`.
