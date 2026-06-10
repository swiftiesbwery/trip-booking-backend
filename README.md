# Trip Booking Backend

REST API trip booking dengan mode user dan admin menggunakan Express, MongoDB,
Mongoose, JWT, bcryptjs, dan Multer.

## Menjalankan Project

```bash
npm install
npm start
```

Konfigurasi `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/trip_booking
JWT_SECRET=ganti_dengan_secret_yang_aman
JWT_EXPIRES_IN=7d
```

Endpoint privat memakai header:

```http
Authorization: Bearer <token>
```

## Relasi Data

- Trip menyimpan array `destinations` berisi referensi ke Destination. Ini
  mengimplementasikan relasi many-to-many trip-destination dan dapat dipopulate.
- Wishlist berisi salah satu `trip_id` atau `destination_id`.
- Booking berisi salah satu item berdasarkan `booking_type`.
- Payment terhubung ke satu booking dan satu user.

## Endpoint User

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/auth/register` | Registrasi user |
| POST | `/api/auth/login` | Login dan mendapat JWT |
| GET | `/api/auth/me` | Profil user login |
| GET | `/api/trips` | Explore trip |
| GET | `/api/trips/:id` | Detail trip dan destinations |
| GET | `/api/destinations` | Explore destination |
| GET | `/api/destinations/:id` | Detail destination |
| GET | `/api/wishlists` | Wishlist milik user |
| POST | `/api/wishlists` | Tambah wishlist |
| DELETE | `/api/wishlists/:id` | Hapus wishlist milik user |
| POST | `/api/bookings` | Buat booking trip/destination |
| GET | `/api/bookings/my` | Riwayat booking, dapat difilter status |
| GET | `/api/bookings/:id` | Detail booking milik user |
| PATCH | `/api/bookings/:id/cancel` | Cancel booking pending |
| POST | `/api/bookings/:id/payment` | Submit payment dan bukti |
| GET | `/api/payments/my` | Payment milik user |

Filter explore:

```text
/api/trips?search=bali&minPrice=100000&maxPrice=2000000&startDate=2026-07-01&endDate=2026-12-31
/api/destinations?search=bandung
/api/bookings/my?status=pending
```

## Endpoint Admin

Semua endpoint berikut hanya dapat diakses user dengan role `admin`.

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET, POST | `/api/admin/trips` | Daftar dan create trip |
| GET, PATCH, DELETE | `/api/admin/trips/:id` | Detail, update, delete trip |
| GET, POST | `/api/admin/trips/:id/destinations` | Lihat/tambah relasi destination |
| DELETE | `/api/admin/trips/:id/destinations/:destinationId` | Hapus relasi destination |
| GET, POST | `/api/admin/destinations` | Daftar dan create destination |
| GET, PATCH, DELETE | `/api/admin/destinations/:id` | Detail, update, delete destination |
| GET | `/api/admin/bookings` | Semua booking dan filter |
| GET | `/api/admin/bookings/:id` | Detail booking |
| PATCH | `/api/admin/bookings/:id/status` | Update status booking |
| GET | `/api/admin/payments` | Semua payment |
| GET | `/api/admin/payments/:id` | Detail payment |
| PATCH | `/api/admin/payments/:id/status` | Update status payment |
| GET | `/api/admin/users` | Semua user |
| GET | `/api/admin/users/:id` | Detail user |
| PATCH | `/api/admin/users/:id/verification` | Update `is_verified` |

Filter booking admin:

```text
/api/admin/bookings?status=pending&booking_type=trip&user_id=<user_id>&trip_id=<trip_id>
```

## Contoh Request Postman

Register:

```json
{
  "name": "Budi Santoso",
  "email": "budi@email.com",
  "password": "rahasia123",
  "phone": "081234567890"
}
```

Create destination oleh admin:

```json
{
  "city": "Labuan Bajo",
  "province": "Nusa Tenggara Timur",
  "country": "Indonesia",
  "image_url": "https://example.com/labuan-bajo.jpg",
  "price": 500000
}
```

Create trip oleh admin:

```json
{
  "title": "Explore Komodo",
  "image_url": "https://example.com/komodo.jpg",
  "price": 2500000,
  "quota": 20,
  "start_date": "2026-08-10",
  "end_date": "2026-08-13",
  "destinations": ["<destination_id_1>", "<destination_id_2>"]
}
```

Tambah relasi destination ke trip:

```json
{
  "destination_id": "<destination_id>",
  "notes": "Tujuan hari pertama"
}
```

Tambah wishlist trip:

```json
{
  "trip_id": "<trip_id>"
}
```

Tambah wishlist destination:

```json
{
  "destination_id": "<destination_id>"
}
```

Booking trip:

```json
{
  "booking_type": "trip",
  "trip_id": "<trip_id>",
  "qty": 2,
  "visit_date": "2026-08-10"
}
```

Booking destination:

```json
{
  "booking_type": "destination",
  "destination_id": "<destination_id>",
  "qty": 2,
  "visit_date": "2026-08-10"
}
```

Submit payment:

```json
{
  "method": "QRIS",
  "payment_proof": "https://example.com/payment-proof.jpg"
}
```

Update status payment oleh admin:

```json
{
  "status": "verified"
}
```

Update status booking oleh admin:

```json
{
  "status": "completed"
}
```

Verifikasi user oleh admin:

```json
{
  "is_verified": true
}
```
