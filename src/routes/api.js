const express = require('express');
const multer = require('multer');

const adminStore = require('../services/admin-store');
const bmkg = require('../services/bmkg');
const downloaders = require('../services/downloaders');
const anime = require('../services/anime');
const news = require('../services/news');
const search = require('../services/search');
const imageUpload = require('../services/image-upload');
const metrics = require('../services/metrics');
const publicData = require('../services/public-data');
const tools = require('../services/tools');
const removeBg = require('../services/remove-bg');
const { fail, ok } = require('../utils/respond');

const router = express.Router();
const allowedUploadMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/octet-stream']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!allowedUploadMimes.has(file.mimetype)) {
      const error = new Error('hanya file gambar jpg, jpeg, atau png yang diperbolehkan');
      error.status = 415;
      cb(error);
      return;
    }

    cb(null, true);
  }
});

const endpoints = [
  { path: '/api/health', query: '-', description: 'Cek status server' },
  { path: '/api/stats', query: 'x-api-key', description: 'Statistik runtime, user, dan request API' },
  { path: '/api/config', query: '-', description: 'Info konfigurasi public' },
  { path: '/api/me', query: 'x-api-key', description: 'Info akun user berdasarkan API key' },
  { path: '/api/tools/gempa', query: 'api_key', description: 'Info gempa terbaru BMKG' },
  { path: '/api/tools/weather/:province', query: 'province, api_key', description: 'Prakiraan cuaca BMKG per provinsi' },
  { path: '/api/tools/weather/:province/:city', query: 'province, city, api_key', description: 'Prakiraan cuaca BMKG per kota' },
  { path: '/api/tools/githubsearch', query: 'q, api_key', description: 'Search repository GitHub public' },
  { path: '/api/tools/yts', query: 'query, api_key', description: 'Search video YouTube via BTCH' },
  { path: '/api/tools/otakudesu', query: 'query, api_key', description: 'Search anime subtitle Indonesia via otakudesu.blog' },
  { path: '/api/tools/lyrics', query: 'title, artist optional, api_key', description: 'Search lirik lagu via LRCLIB' },
  { path: '/api/tools/ocr', query: 'multipart file, language, api_key', description: 'OCR gambar ke text lokal via Tesseract.js' },
  { path: '/api/tools/imgtourl', query: 'multipart file, api_key', description: 'Upload gambar ke telegra.ph dengan fallback qu.ax' },
  { path: '/api/tools/removebg', query: 'multipart file, api_key', description: 'Hapus background gambar lalu upload hasil PNG' },
  { path: '/api/anime/anichin/search', query: 'query, api_key', description: 'Search anime di Anichin' },
  { path: '/api/anime/auratail/search', query: 'query, api_key', description: 'Search anime di AuraTail' },
  { path: '/api/anime/komikindo/search', query: 'query, api_key', description: 'Search manga atau komik di Komikindo' },
  { path: '/api/anime/oploverz/search', query: 'query, api_key', description: 'Search anime di Oploverz' },
  { path: '/api/news', query: 'api_key', description: 'Daftar provider news' },
  { path: '/api/news/:provider', query: 'query, api_key', description: 'Search news provider' },
  { path: '/api/search/gsmarena', query: 'query, api_key', description: 'Search device di GSMArena' },
  { path: '/api/search/bimg', query: 'query, api_key', description: 'Search gambar via Bing Images' },
  { path: '/api/search/pinterest', query: 'query, api_key', description: 'Search pin bergambar di Pinterest' },
  { path: '/api/search/lk21', query: 'query, api_key', description: 'Search film atau series di LK21' },
  { path: '/api/search/lk21/popular', query: 'api_key', description: 'Daftar film atau series populer LK21' },
  { path: '/api/downloaders', query: 'api_key', description: 'Daftar provider downloader' },
  { path: '/api/download/:provider', query: 'url atau query, api_key', description: 'Downloader media via btch-downloader' },
  { path: '/api/github/stalk', query: 'username, api_key', description: 'Info profil GitHub public' },
  { path: '/api/instagram/stalk', query: 'username, api_key', description: 'Info profil Instagram public' },
  { path: '/api/pinterest/stalk', query: 'username, api_key', description: 'Info profil Pinterest public' },
  { path: '/api/roblox/stalk', query: 'username, api_key', description: 'Info profil Roblox public' },
  { path: '/api/tiktok/stalk', query: 'username, api_key', description: 'Info profil TikTok public' },
  { path: '/api/threads/stalk', query: 'username, api_key', description: 'Info profil Threads public' },
  { path: '/api/x/stalk', query: 'username, api_key', description: 'Info profil X atau Twitter public' },
  { path: '/api/youtube/stalk', query: 'username, api_key', description: 'Info channel YouTube public' },
  { path: '/api/repository/stalk', query: 'package, api_key', description: 'Info package NPM public' },
  { path: '/api/wikipedia', query: 'query, api_key', description: 'Search ringkas Wikipedia Indonesia' }
];

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function extractApiKey(req) {
  return req.headers['x-api-key'] || req.query.api_key || req.body?.api_key;
}

function requireApiKey(options = {}) {
  return (req, res, next) => {
    try {
      const user = options.consume === false
        ? adminStore.getPublicUserByApiKey(extractApiKey(req))
        : adminStore.consumeCredit(extractApiKey(req), options.cost || 1);

      req.apiUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

router.get('/', (req, res) => {
  res.json(ok({ endpoints }, 'REST API siap digunakan'));
});

router.get('/health', (req, res) => {
  res.json(ok({
    uptime: metrics.getStats().uptime_seconds,
    timestamp: new Date().toISOString(),
    node: process.version
  }));
});

router.get('/stats', requireApiKey({ consume: false }), (req, res) => {
  res.json(ok(metrics.getStats()));
});

router.get('/config', (req, res) => {
  const settings = adminStore.getSettings();

  res.json(ok({
    app_name: settings.app_name_override || process.env.APP_NAME || 'Lhuciver-restapis',
    prefix: '/api',
    creator: settings.app_creator_override || process.env.APP_CREATOR || 'Lhuciver',
    downloader_library: 'btch-downloader',
    maintenance_mode: settings.maintenance_mode,
    public_notice: settings.public_notice,
    default_daily_credit: settings.default_daily_credit
  }));
});

router.get('/me', requireApiKey({ consume: false }), (req, res) => {
  res.json(ok(req.apiUser));
});

router.use(requireApiKey());

router.get('/downloaders', (req, res) => {
  res.json(ok(downloaders.listDownloaders()));
});

router.get('/news', asyncRoute(async (req, res) => {
  res.json(ok(await news.listNewsProviders()));
}));

router.get('/news/:provider', asyncRoute(async (req, res) => {
  res.json(ok(await news.newsSearch(req.params.provider, req.query.query || req.query.q || req.query.text)));
}));

router.get('/search/gsmarena', asyncRoute(async (req, res) => {
  res.json(ok(await search.gsmArenaSearch(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/search/bimg', asyncRoute(async (req, res) => {
  res.json(ok(await search.bingImageSearch(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/search/pinterest', asyncRoute(async (req, res) => {
  res.json(ok(await search.pinterestSearch(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/search/lk21', asyncRoute(async (req, res) => {
  res.json(ok(await search.lk21Search(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/search/lk21/popular', asyncRoute(async (req, res) => {
  res.json(ok(await search.lk21Popular()));
}));

router.get('/download/:provider', asyncRoute(async (req, res) => {
  res.json(ok(await downloaders.runDownloader(req.params.provider, req.query)));
}));

async function handleImageToUrl(req, res) {
  if (!req.file) {
    const error = new Error('masukan file gambar dengan field name file');
    error.status = 406;
    throw error;
  }

  const result = await imageUpload.uploadImage(req.file.buffer, req.file.mimetype);

  res.json(ok({
    provider: result.provider,
    url: result.url,
    display_url: result.url,
    file: {
      original_name: req.file.originalname,
      mime: result.file_type.mime,
      ext: result.file_type.ext,
      client_mime: req.file.mimetype,
      size: req.file.size
    },
    raw: result.raw
  }));
}

router.post('/tools/imgtourl', upload.single('file'), asyncRoute(handleImageToUrl));

router.post('/tools/removebg', upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) {
    const error = new Error('masukan file gambar dengan field name file');
    error.status = 406;
    throw error;
  }

  const output = await removeBg.removeImageBackground(req.file.buffer, req.file.mimetype);
  const result = await imageUpload.uploadImage(output, 'image/png');

  res.json(ok({
    provider: result.provider,
    url: result.url,
    display_url: result.url,
    output: {
      mime: 'image/png',
      ext: 'png',
      size: output.length
    },
    input: {
      original_name: req.file.originalname,
      client_mime: req.file.mimetype,
      size: req.file.size
    },
    raw: result.raw
  }));
}));

router.post('/tools/ocr', upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) {
    const error = new Error('masukan file gambar dengan field name file');
    error.status = 406;
    throw error;
  }

  const language = req.body?.language || req.query?.language || 'eng';
  const result = await tools.ocrImage(req.file.buffer, req.file.mimetype, language);

  res.json(ok({
    provider: result.provider,
    language: result.language,
    text: result.text,
    confidence: result.confidence,
    detected_language: result.detected_language,
    input: {
      original_name: req.file.originalname,
      client_mime: req.file.mimetype,
      size: req.file.size
    }
  }));
}));

router.get('/tools/gempa', asyncRoute(async (req, res) => {
  res.json(ok(await bmkg.latestQuake()));
}));

router.get('/tools/weather/:province', asyncRoute(async (req, res) => {
  res.json(ok(await bmkg.weatherByProvince(req.params.province)));
}));

router.get('/tools/weather/:province/:city', asyncRoute(async (req, res) => {
  res.json(ok(await bmkg.weatherByCity(req.params.province, req.params.city)));
}));

router.get('/tools/githubsearch', asyncRoute(async (req, res) => {
  res.json(ok(await tools.githubRepositorySearch(req.query.q || req.query.query || req.query.text)));
}));

router.get('/tools/yts', asyncRoute(async (req, res) => {
  res.json(ok(await tools.youtubeSearch(req.query.query || req.query.q || req.query.text || req.query.title)));
}));

router.get('/tools/otakudesu', asyncRoute(async (req, res) => {
  res.json(ok(await tools.otakudesuSearch(req.query.query || req.query.q || req.query.text || req.query.title)));
}));

router.get('/tools/lyrics', asyncRoute(async (req, res) => {
  res.json(ok(await tools.lyricsSearch(
    req.query.title || req.query.q || req.query.query,
    req.query.artist || req.query.artist_name || req.query.singer
  )));
}));

router.get('/anime/anichin/search', asyncRoute(async (req, res) => {
  res.json(ok(await anime.anichinSearch(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/anime/auratail/search', asyncRoute(async (req, res) => {
  res.json(ok(await anime.auratailSearch(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/anime/komikindo/search', asyncRoute(async (req, res) => {
  res.json(ok(await anime.komikindoSearch(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/anime/oploverz/search', asyncRoute(async (req, res) => {
  res.json(ok(await anime.oploverzSearch(req.query.query || req.query.q || req.query.text || req.query.name)));
}));

router.get('/github/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.githubUser(req.query.username)));
}));

router.get('/instagram/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.instagramUser(req.query.username || req.query.user || req.query.name)));
}));

router.get('/pinterest/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.pinterestUser(req.query.username || req.query.user || req.query.name || req.query.q)));
}));

router.get('/roblox/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.robloxUser(req.query.username || req.query.user || req.query.name)));
}));

router.get('/tiktok/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.tiktokUser(req.query.username || req.query.user || req.query.name)));
}));

router.get('/threads/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.threadsUser(req.query.username || req.query.user || req.query.name || req.query.q)));
}));

router.get('/x/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.xUser(req.query.username || req.query.user || req.query.name)));
}));

router.get('/youtube/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.youtubeUser(req.query.username || req.query.user || req.query.name)));
}));

router.get('/repository/stalk', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.npmPackage(req.query.package || req.query.repo || req.query.name)));
}));

router.get('/wikipedia', asyncRoute(async (req, res) => {
  res.json(ok(await publicData.wikipedia(req.query.query || req.query.q)));
}));

router.use((err, req, res, next) => {
  res.status(err.status || 500).json(fail(err.message, err.status || 500));
});

module.exports = router;
