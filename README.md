# Lhuciver-rest-api

Clean Express REST API dashboard milik Lhuciver, dengan endpoint tester langsung dari browser dan response JSON yang mudah dibaca.

## Run

```bash
npm install
npm start
```

Default URL:

```text
http://localhost:8080
```

Dashboard di URL utama sudah bisa dipakai untuk test endpoint langsung dari browser. User bisa memilih endpoint, mengubah parameter, menekan `Send Request`, lalu melihat status HTTP, durasi response, ukuran response, URL request, dan body JSON.

## Scripts

```bash
npm run check
npm run test:api
npm run dev
npm start
```

`npm run test:api` akan memanggil endpoint satu per satu dan menampilkan URL, status HTTP, waktu response, serta body JSON. Default target adalah `http://localhost:8080`.

Untuk mengetes server lain:

```bash
API_BASE_URL=http://localhost:3000 npm run test:api
```

## Endpoints

```text
GET /api/health
GET /api/stats
GET /api/config
POST /api/tools/imgtourl
POST /api/tools/removebg
GET /api/tools/gempa
GET /api/tools/weather/jawa-barat
GET /api/tools/weather/jawa-barat/bandung
GET /api/downloaders
GET /api/download/instagram?url=https://www.instagram.com/p/ByxKbUSnubS/
GET /api/download/tiktok?url=https://www.tiktok.com/@omagadsus/video/7025456384175017243
GET /api/download/facebook?url=https://www.facebook.com/watch/?v=1393572814172251
GET /api/download/twitter?url=https://twitter.com/gofoodindonesia/status/1229369819511709697
GET /api/download/youtube?url=https://youtube.com/watch?v=C8mJ8943X80
GET /api/download/yts?query=Somewhere%20Only%20We%20Know
GET /api/github/stalk?username=octocat
GET /api/instagram/stalk?username=cristiano
GET /api/tiktok/stalk?username=charlidamelio
GET /api/repository/stalk?package=express
GET /api/wikipedia?query=Indonesia
GET /api/news/liputan6
GET /api/news/antara
GET /api/news/berita-indo
GET /api/news/tempo
GET /api/news/cnbc
```

Downloader yang tersedia: Instagram, TikTok, Facebook, Twitter/X, YouTube, MediaFire, CapCut, Google Drive, Pinterest, AIO, Douyin, Xiaohongshu, SnackVideo, Cocofun, Spotify, YT Search, SoundCloud, Threads, dan Kuaishou.

News provider yang tersedia: Liputan6, ANTARA News, Berita-indo.id, Tempo, CNBC Indonesia, Merdeka, CNN Indonesia, Detik, dan Kompas.

## Notes

Dashboard memakai logo di `public/logo.png` sebagai logo halaman dan favicon browser.
