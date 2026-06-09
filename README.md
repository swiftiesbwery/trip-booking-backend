# Trip Booking Backend

Backend API mode user untuk aplikasi booking trip wisata menggunakan Node.js,
Express, MongoDB/Mongoose, JWT, bcryptjs, dan Multer.

## Menjalankan Project

```bash
npm install
npm run migrate:trip-destinations
npm start
```

Isi `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/trip_booking
JWT_SECRET=ganti_dengan_secret_yang_aman
JWT_EXPIRES_IN=7d
```

Gunakan header berikut untuk endpoint yang membutuhkan login:

```http
Authorization: Bearer <token>
```

## Endpoint User

### Auth

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/auth/register` | Tidak | Registrasi user |
| POST | `/api/auth/login` | Tidak | Login dan mendapat JWT |
| GET | `/api/auth/me` | Ya | Data user dari `req.user` |

Register:

```json
{
  "name": "Budi Santoso",
  "email": "budi@email.com",
  "password": "rahasia123",
  "phone": "081234567890"
}
```

Login:

```json
{
  "email": "budi@email.com",
  "password": "rahasia123"
}
```

### Explore Trip dan Destinasi

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/trips` | Tidak | Daftar trip aktif yang belum berangkat |
| GET | `/api/trips/:id` | Tidak | Detail trip dan ringkasan rating |
| GET | `/api/trips/:id/reviews` | Tidak | Review pada trip |
| POST | `/api/trips` | Admin | Membuat trip dengan banyak destinasi |
| PATCH | `/api/trips/:id` | Admin | Memperbarui trip dan destinasinya |
| GET | `/api/destinations` | Tidak | Daftar destinasi |
| GET | `/api/destinations/:id` | Tidak | Detail destinasi dan trip aktifnya |

Contoh filter:

```text
/api/trips?search=komodo&destination=ntt&minPrice=500000&maxPrice=3000000&minDays=2&maxDays=7&sort=price_asc&page=1&limit=9
/api/trips?destination_id=<destination_id>
/api/destinations?search=bali&page=1&limit=20
```

Nilai `sort`: `departure_date`, `price_asc`, `price_desc`, atau `newest`.

Format `destinations` pada create/update trip:

```json
{
  "destinations": [
    {
      "destination_id": "64abc123...",
      "visit_order": 1,
      "notes": "Hari pertama"
    },
    {
      "destination_id": "64abc456...",
      "visit_order": 2,
      "notes": "Hari kedua"
    }
  ]
}
```

### Booking dan Pembayaran

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/bookings` | Ya | Membuat booking berstatus `pending` |
| GET | `/api/bookings/my` | Ya | Riwayat booking milik user |
| GET | `/api/bookings/:id` | Ya | Detail booking milik user |
| POST | `/api/bookings/:id/payment` | Ya | Submit pembayaran booking milik user |

Booking:

```json
{
  "trip_id": "64abc123...",
  "num_participants": 2
}
```

Pembayaran sederhana menggunakan JSON:

```json
{
  "payment_method": "transfer",
  "amount": 1500000,
  "payment_proof": "https://example.com/bukti-transfer.jpg"
}
```

`amount` boleh tidak dikirim dan otomatis menggunakan total booking. Nilai
`payment_method`: `transfer`, `ewallet`, atau `cash`.

Pembayaran juga dapat dikirim sebagai `multipart/form-data`:

```text
proof: file JPG/PNG maksimal 2MB
payment_method: transfer
amount: 1500000
```

### Review

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/reviews` | Ya | Review trip yang pernah dibooking user |
| GET | `/api/reviews/my` | Ya | Daftar review milik user |

Review:

```json
{
  "booking_id": "64abc456...",
  "rating": 5,
  "comment": "Trip sangat menyenangkan."
}
```

`trip_id` boleh ikut dikirim dan akan divalidasi terhadap booking. Satu user
hanya dapat membuat satu review untuk trip yang sama. Booking yang dibatalkan
tidak dapat direview.

## Migrasi Relasi Trip

Jalankan satu kali untuk mengubah data lama `destination_id` menjadi array
`destinations` tanpa menghapus trip yang sudah ada:

```bash
npm run migrate:trip-destinations
```

## Catatan Data

Trip dan destinasi diasumsikan sudah tersedia di database. Implementasi ini
berfokus pada mode user; route CRUD admin belum ditambahkan.
