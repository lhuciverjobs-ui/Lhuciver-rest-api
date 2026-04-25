# Lhuciver REST API

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)

REST API berbasis Express dengan dashboard bawaan untuk:

- manajemen user + API key
- endpoint tester langsung dari browser
- koleksi endpoint tools (downloaders, news, search, OCR, remove background, dan lainnya)

## Quick Navigation

- [Fitur Utama](#fitur-utama)
- [Quick Start](#quick-start)
- [Cara Dapat API Key](#cara-dapat-api-key)
- [Endpoint Ringkas](#endpoint-ringkas)
- [Penyimpanan Data Lokal](#penyimpanan-data-lokal)

## Fitur Utama

- Dashboard web di `/` untuk test endpoint (status, duration, response size, dan JSON viewer).
- Halaman admin di `/admin` untuk kelola user, credit harian, dan setting aplikasi.
- Auth public di `/api/auth/signup` dan `/api/auth/login`.
- Sistem API key + credit harian untuk endpoint protected.
- Integrasi banyak layanan: downloader, BMKG, search, anime, social/profile lookup, dan utilities.
- API response format konsisten via helper `ok(...)` / `fail(...)`.

| Area | Deskripsi |
| --- | --- |
| Dashboard | Test endpoint langsung dari browser |
| Authentication | Signup/login user + API key |
| Credit System | Pembatasan credit harian per user |
| Admin Panel | Kelola user, API key, dan pengaturan |
| Tools API | OCR, remove background, downloader, search, news |

## Tech Stack

- Node.js (CommonJS)
- Express 4
- Multer (upload file)
- Tesseract.js (OCR lokal)
- `@imgly/background-removal-node` (remove background)
- `btch-downloader` (multi provider downloader)

## Quick Start

1. Install dependency:

```bash
npm install
```

2. (Opsional tapi direkomendasikan) buat file `.env`:

```env
PORT=8080
APP_NAME=Lhuciver-restapis
APP_CREATOR=Lhuciver

# wajib untuk login admin (/api/admin/login)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=GantiPasswordKuat123

# opsional untuk fitur kirim email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_SECURE=false
```

3. Jalankan server:

```bash
npm start
```

Server default berjalan di:

```text
http://localhost:8080
```

## Scripts

```bash
npm start       # run production mode
npm run dev     # run with --watch
npm run check   # syntax check file utama
npm run test:api
```

`npm run test:api` akan memanggil kumpulan endpoint dan menampilkan status + response.

Target default:

```text
http://localhost:8080
```

Ganti target server:

```bash
API_BASE_URL=http://localhost:3000 npm run test:api
```

## Cara Dapat API Key

Sebagian besar endpoint `/api/*` butuh API key.

1. Signup user via:
   `POST /api/auth/signup`
2. Login user via:
   `POST /api/auth/login`
3. Ambil `api_key` dari response login/signup.
4. Kirim API key lewat salah satu cara:
   - header `x-api-key: <api_key>`
   - query `?api_key=<api_key>`

## Endpoint Ringkas

### Public Endpoint

- `GET /api`
- `GET /api/health`
- `GET /api/config`
- `POST /api/auth/signup`
- `POST /api/auth/login`

### API Key Required (Ringkas)

<details>
<summary>Lihat semua endpoint protected</summary>

- `GET /api/stats`
- `GET /api/me`
- `GET /api/downloaders`
- `GET /api/download/:provider`
- `GET /api/news`
- `GET /api/news/:provider`
- `GET /api/tools/gempa`
- `GET /api/tools/weather/:province`
- `GET /api/tools/weather/:province/:city`
- `GET /api/tools/githubsearch`
- `GET /api/tools/yts`
- `GET /api/tools/otakudesu`
- `GET /api/tools/lyrics`
- `POST /api/tools/imgtourl`
- `POST /api/tools/removebg`
- `POST /api/tools/ocr`
- `GET /api/search/gsmarena`
- `GET /api/search/bimg`
- `GET /api/search/pinterest`
- `GET /api/search/lk21`
- `GET /api/search/lk21/popular`
- `GET /api/anime/anichin/search`
- `GET /api/anime/auratail/search`
- `GET /api/anime/komikindo/search`
- `GET /api/anime/oploverz/search`
- `GET /api/github/stalk`
- `GET /api/instagram/stalk`
- `GET /api/pinterest/stalk`
- `GET /api/roblox/stalk`
- `GET /api/tiktok/stalk`
- `GET /api/threads/stalk`
- `GET /api/x/stalk`
- `GET /api/youtube/stalk`
- `GET /api/repository/stalk`
- `GET /api/wikipedia`

</details>

### Admin Endpoint

Semua endpoint berikut butuh session cookie admin:

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-credit`
- `POST /api/admin/users/:id/regenerate-apikey`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`

## Contoh Pemakaian Cepat

```bash
curl "http://localhost:8080/api/health"
```

```bash
curl -H "x-api-key: YOUR_API_KEY" "http://localhost:8080/api/me"
```

```bash
curl -H "x-api-key: YOUR_API_KEY" "http://localhost:8080/api/tools/gempa"
```

## Penyimpanan Data Lokal

State admin, user, dan session disimpan di:

```text
tmp/admin-state.json
```

File ini otomatis dibuat saat aplikasi berjalan.

## Catatan

- OCR memakai `eng.traineddata` dan `ind.traineddata` di root project.
- Logo dashboard/favicons memakai aset di `public/logo.png`.
- License: GPL-3.0-or-later.
