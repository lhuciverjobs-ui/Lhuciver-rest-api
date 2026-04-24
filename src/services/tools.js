const GITHUB_SEARCH_URL = 'https://api.github.com/search/repositories';
const LRCLIB_SEARCH_URL = 'https://lrclib.net/api/search';
const OTAKUDESU_BASE_URL = 'https://otakudesu.blog';
const btch = require('btch-downloader');
const cheerio = require('cheerio');
const { createWorker } = require('tesseract.js');

const ocrWorkers = new Map();

async function getJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'lhuciver-restapis/1.0',
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        data?.message || data?.error || `upstream ${response.status}`
      );
      error.status = response.status === 404 ? 404 : 502;
      error.details = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getText(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'lhuciver-restapis/1.0',
        ...(options.headers || {})
      }
    });

    const data = await response.text();

    if (!response.ok) {
      const error = new Error(`upstream ${response.status}`);
      error.status = response.status === 404 ? 404 : 502;
      error.details = data.slice(0, 300);
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeGithubRepo(repo) {
  return {
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    clone_url: repo.clone_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.watchers_count,
    open_issues: repo.open_issues_count,
    language: repo.language,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    owner: {
      login: repo.owner?.login || null,
      avatar_url: repo.owner?.avatar_url || null,
      html_url: repo.owner?.html_url || null
    }
  };
}

function normalizeLyricsItem(item) {
  return {
    id: item.id,
    name: item.name || item.trackName || null,
    track_name: item.trackName || item.track_name || item.name || null,
    artist_name: item.artistName || item.artist_name || null,
    album_name: item.albumName || item.album_name || null,
    duration: item.duration || null,
    instrumental: Boolean(item.instrumental),
    lang: item.lang || null,
    plain_lyrics: item.plainLyrics || item.plain_lyrics || null,
    synced_lyrics: item.syncedLyrics || item.synced_lyrics || null,
    isrc: item.isrc || null,
    spotify_id: item.spotifyId || item.spotify_id || null,
    release_date: item.releaseDate || item.release_date || null,
    url: item.id ? `https://lrclib.net/songs/${item.id}` : null
  };
}

function normalizeYoutubeSearchItem(item) {
  return {
    type: item.type || null,
    video_id: item.videoId || item.video_id || null,
    url: item.url || null,
    title: item.title || null,
    description: item.description || null,
    thumbnail: item.thumbnail || item.image || null,
    image: item.image || item.thumbnail || null,
    duration: item.duration || {
      seconds: item.seconds ?? null,
      timestamp: item.timestamp || null
    },
    ago: item.ago || null,
    views: item.views ?? null,
    author: item.author
      ? {
          name: item.author.name || null,
          url: item.author.url || null
        }
      : null
  };
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeOtakudesuInfo(label, value) {
  return {
    label,
    value: cleanText(value)
  };
}

function parseInfoLines($, selector) {
  const items = [];

  $(selector).each((_, element) => {
    const text = cleanText($(element).text());
    if (!text) {
      return;
    }

    const index = text.indexOf(':');
    const label = index >= 0 ? text.slice(0, index).trim() : text;
    const value = index >= 0 ? text.slice(index + 1).trim() : '';
    items.push(normalizeOtakudesuInfo(label, value));
  });

  return items;
}

function absoluteUrl(href, baseUrl = OTAKUDESU_BASE_URL) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function parseLyricsQuery(title, artist) {
  const rawTitle = String(title || '').trim();
  const rawArtist = String(artist || '').trim();

  if (rawArtist) {
    return {
      track_name: rawTitle,
      artist_name: rawArtist
    };
  }

  const splitPatterns = [
    /\s+-\s+/,
    /\s+by\s+/i,
    /\s+feat\.?\s+/i,
    /\s+ft\.?\s+/i
  ];

  for (const pattern of splitPatterns) {
    if (pattern.test(rawTitle)) {
      const parts = rawTitle.split(pattern).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return {
          artist_name: parts[0],
          track_name: parts.slice(1).join(' ')
        };
      }
    }
  }

  return {
    query: rawTitle
  };
}

function rankLyricsResult(item, query) {
  const queryTrack = normalizeText(query.track_name || query.query || '');
  const queryArtist = normalizeText(query.artist_name || '');
  const itemTrack = normalizeText(item.track_name || '');
  const itemArtist = normalizeText(item.artist_name || '');
  const itemAlbum = normalizeText(item.album_name || '');

  let score = 0;

  if (queryTrack && itemTrack === queryTrack) score += 100;
  if (queryArtist && itemArtist === queryArtist) score += 90;
  if (queryTrack && itemTrack.includes(queryTrack)) score += 55;
  if (queryArtist && itemArtist.includes(queryArtist)) score += 40;
  if (queryTrack && itemAlbum.includes(queryTrack)) score += 20;
  if (queryTrack && item.name && normalizeText(item.name).includes(queryTrack)) score += 15;

  if (queryTrack && itemTrack) {
    const queryParts = queryTrack.split(' ');
    const itemParts = itemTrack.split(' ');
    const overlap = queryParts.filter((part) => itemParts.includes(part)).length;
    score += overlap * 4;
  }

  if (item.instrumental) score -= 12;

  return score;
}

function normalizeOcrResult(item) {
  return {
    parsed_text: item.ParsedText || '',
    file_parse_exit_code: item.FileParseExitCode ?? null,
    error_message: item.ErrorMessage || null,
    error_details: item.ErrorDetails || null,
    text_overlay: item.TextOverlay || null
  };
}

async function githubRepositorySearch(query) {
  if (!query) {
    const error = new Error('masukan parameter q');
    error.status = 406;
    throw error;
  }

  const params = new URLSearchParams({
    q: query,
    sort: 'stars',
    order: 'desc',
    per_page: '10'
  });
  const data = await getJson(`${GITHUB_SEARCH_URL}?${params.toString()}`);

  return {
    query,
    total_count: data.total_count,
    incomplete_results: data.incomplete_results,
    items: (data.items || []).slice(0, 10).map(normalizeGithubRepo)
  };
}

async function youtubeSearch(query) {
  const search = String(query || '').trim();

  if (!search) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }

  const response = await btch.yts(search);
  const payload = response?.result || response || {};
  const sourceItems = Array.isArray(payload.videos) && payload.videos.length
    ? payload.videos
    : Array.isArray(payload.all)
      ? payload.all
      : [];
  const items = sourceItems.slice(0, 10).map(normalizeYoutubeSearchItem);

  return {
    provider: 'btch-downloader',
    query: search,
    total_count: items.length,
    best_match: items[0] || null,
    items,
    raw: {
      status: response?.status ?? null,
      result_status: payload.status ?? null,
      counts: {
        all: Array.isArray(payload.all) ? payload.all.length : 0,
        videos: Array.isArray(payload.videos) ? payload.videos.length : 0,
        live: Array.isArray(payload.live) ? payload.live.length : 0,
        playlists: Array.isArray(payload.playlists) ? payload.playlists.length : 0,
        channels: Array.isArray(payload.channels) ? payload.channels.length : 0,
        accounts: Array.isArray(payload.accounts) ? payload.accounts.length : 0
      }
    }
  };
}

async function otakudesuSearch(query) {
  const search = String(query || '').trim();

  if (!search) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }

  const searchUrl = `${OTAKUDESU_BASE_URL}/?s=${encodeURIComponent(search)}&post_type=anime`;
  const searchHtml = await getText(searchUrl);
  const $search = cheerio.load(searchHtml);

  const items = [];
  const seen = new Set();

  $search('#venkonten h2 a[href*="/anime/"]').each((_, element) => {
    const link = $search(element);
    const href = absoluteUrl(link.attr('href'));
    const title = cleanText(link.text());

    if (!href || seen.has(href)) {
      return;
    }

    seen.add(href);

    const card = link.closest('li, .page, article, .venser, div').first();
    const summary = cleanText(card.find('p').first().text());
    const thumbnail = absoluteUrl(card.find('img').first().attr('src'));

    items.push({
      title,
      url: href,
      thumbnail,
      summary
    });
  });

  if (!items.length) {
    const fallbackLink = $search('#venkonten h2 a, .venser h2 a').first();
    const href = absoluteUrl(fallbackLink.attr('href'));

    if (href) {
      items.push({
        title: cleanText(fallbackLink.text()) || search,
        url: href,
        thumbnail: absoluteUrl($search('#venkonten img').first().attr('src')),
        summary: cleanText($search('#venkonten p').first().text())
      });
    }
  }

  if (!items.length) {
    const error = new Error('anime tidak ditemukan');
    error.status = 404;
    throw error;
  }

  const best = items[0];
  const detailHtml = await getText(best.url);
  const $ = cheerio.load(detailHtml);

  const infoLines = parseInfoLines($, '#venkonten .infozin p, #venkonten .venser .infozin p');
  const infoMap = new Map(infoLines.map((item) => [item.label.toLowerCase(), item.value]));

  const batchUrl = absoluteUrl($('#venkonten a[href*="/batch/"]').first().attr('href'));
  const episodeLinks = [];
  const episodeSeen = new Set();

  $('#venkonten a[href*="/episode/"]').each((_, element) => {
    const link = $(element);
    const href = absoluteUrl(link.attr('href'));
    if (!href || episodeSeen.has(href)) {
      return;
    }

    episodeSeen.add(href);
    episodeLinks.push({
      title: cleanText(link.text()),
      url: href
    });
  });

  const batchDownloadLinks = [];

  if (batchUrl) {
    const batchHtml = await getText(batchUrl);
    const $batch = cheerio.load(batchHtml);
    const batchSeen = new Set();

    $batch('#venkonten .batchlink a, #venkonten .linklul a, #venkonten a[href*="desustream.com"], #venkonten a[href*="link.desustream.com"]').each((_, element) => {
      const link = $batch(element);
      const href = absoluteUrl(link.attr('href'), batchUrl);
      const name = cleanText(link.text()) || 'download';

      if (!href || batchSeen.has(href)) {
        return;
      }

      batchSeen.add(href);
      batchDownloadLinks.push({ name, url: href });
    });
  }

  const result = {
    judul: infoMap.get('judul') || best.title,
    thumb: absoluteUrl($('#venkonten .fotoanime img').first().attr('src')) || best.thumbnail,
    japan: infoMap.get('japanese') || infoMap.get('jepang') || null,
    rating: infoMap.get('skor') || infoMap.get('score') || null,
    produser: infoMap.get('produser') || null,
    type: infoMap.get('type') || null,
    status: infoMap.get('status') || null,
    episode: infoMap.get('total episode') || infoMap.get('episode') || null,
    durasi: infoMap.get('durasi') || infoMap.get('duration') || null,
    rilis: infoMap.get('rilis') || null,
    studio: infoMap.get('studio') || null,
    genre: infoMap.get('genre') || null,
    LinkDown: batchDownloadLinks[0]?.url || batchUrl || null,
    download_links: batchDownloadLinks,
    episode_links: episodeLinks.slice(0, 20),
    sinopsis: cleanText($('#venkonten .sinopc').text() || $('#venkonten .sinopc p').text() || ''),
    source: {
      search_url: searchUrl,
      detail_url: best.url,
      batch_url: batchUrl
    }
  };

  return {
    provider: 'otakudesu.blog',
    query: search,
    total_count: items.length,
    best_match: {
      title: best.title,
      url: best.url,
      thumbnail: best.thumbnail,
      summary: best.summary,
      detail: result
    },
    items,
    result
  };
}

async function lyricsSearch(title, artist) {
  if (!title) {
    const error = new Error('masukan parameter title');
    error.status = 406;
    throw error;
  }

  const searchQuery = parseLyricsQuery(title, artist);

  const params = new URLSearchParams({ limit: '10' });

  if (searchQuery.query) {
    params.set('q', searchQuery.query);
  }

  if (searchQuery.track_name) {
    params.set('track_name', searchQuery.track_name);
  }

  if (searchQuery.artist_name) {
    params.set('artist_name', searchQuery.artist_name);
  }

  const data = await getJson(`${LRCLIB_SEARCH_URL}?${params.toString()}`);
  const items = Array.isArray(data)
    ? data.slice(0, 10).map(normalizeLyricsItem).sort((a, b) => {
        const diff = rankLyricsResult(b, searchQuery) - rankLyricsResult(a, searchQuery);
        if (diff !== 0) {
          return diff;
        }

        return String(a.artist_name || '').localeCompare(String(b.artist_name || ''));
      })
    : [];

  return {
    provider: 'lrclib',
    query: searchQuery,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function getOcrWorker(language) {
  const key = String(language || 'eng').trim() || 'eng';

  if (!ocrWorkers.has(key)) {
    ocrWorkers.set(
      key,
      createWorker(key, 1, {
        logger: () => {}
      })
    );
  }

  return ocrWorkers.get(key);
}

async function ocrImage(buffer, mimetype, language = 'eng') {
  if (!buffer || !buffer.length) {
    const error = new Error('masukan file gambar dengan field name file');
    error.status = 406;
    throw error;
  }

  const worker = await getOcrWorker(language);
  const result = await worker.recognize(buffer);
  const data = result?.data || {};
  const text = String(data.text || '').trim();

  return {
    provider: 'tesseract.js',
    language: language || 'eng',
    text,
    confidence: data.confidence ?? null,
    detected_language: data.language || null
  };
}

module.exports = {
  githubRepositorySearch,
  lyricsSearch,
  otakudesuSearch,
  ocrImage,
  youtubeSearch
};
