const cheerio = require('cheerio');

const LIPUTAN6_BASE_URL = 'https://www.liputan6.com';
const MERDEKA_BASE_URL = 'https://www.merdeka.com';
const CNN_BASE_URL = 'https://www.cnnindonesia.com';
const DETIK_BASE_URL = 'https://www.detik.com';
const KOMPAS_BASE_URL = 'https://search.kompas.com';
const ANTARA_BASE_URL = 'https://www.antaranews.com';
const TEMPO_BASE_URL = 'https://www.tempo.co';
const BERITA_INDO_BASE_URL = 'https://www.berita-indo.id';
const CNBC_BASE_URL = 'https://www.cnbcindonesia.com';

async function getHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'lhuciver-restapis/1.0'
      }
    });

    const text = await response.text();

    if (!response.ok) {
      const error = new Error(`upstream ${response.status}`);
      error.status = response.status === 404 ? 404 : 502;
      error.details = text.slice(0, 200);
      throw error;
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function absoluteUrl(href, baseUrl) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) {
      return text;
    }
  }

  return '';
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);
    return true;
  });
}

function getArticleSummary(link) {
  return firstNonEmpty(
    link.attr('data-summary'),
    link.attr('data-description'),
    link.find('p').first().text(),
    link.closest('article, .article, .story, .news, li, div').find('p').first().text()
  );
}

function getArticleImage(link, baseUrl) {
  return firstNonEmpty(
    absoluteUrl(link.find('img').first().attr('src'), baseUrl),
    absoluteUrl(link.find('img').first().attr('data-src'), baseUrl),
    absoluteUrl(link.find('img').first().attr('data-lazy-src'), baseUrl),
    absoluteUrl(link.attr('data-src'), baseUrl)
  );
}

function collectArticles($, baseUrl, options = {}) {
  const {
    maxItems = 10,
    hrefPredicate = () => true,
    titlePredicate = () => true,
    query = '',
    categoryFromUrl = false,
    baseCategory = null
  } = options;
  const normalizedQuery = normalizeText(query);
  const items = [];
  const seen = new Set();

  $('a[href]').each((_, element) => {
    const link = $(element);
    const container = link.closest('article, .article, .story, .news, .card, li, section, div').first();
    const href = absoluteUrl(link.attr('href'), baseUrl);

    if (!href || seen.has(href) || !hrefPredicate(href, link)) {
      return;
    }

    const title = firstNonEmpty(
      container.find('h1').first().text(),
      container.find('h2').first().text(),
      container.find('h3').first().text(),
      container.find('h4').first().text(),
      link.attr('aria-label'),
      link.attr('title'),
      link.find('h1').first().text(),
      link.find('h2').first().text(),
      link.find('h3').first().text(),
      link.find('h4').first().text(),
      link.text()
    );

    if (!title || title.length < 8 || !titlePredicate(title, href, link)) {
      return;
    }

    const normalizedTitle = normalizeText(title);
    const normalizedHref = normalizeText(href);
    if (normalizedQuery && !normalizedTitle.includes(normalizedQuery) && !normalizedHref.includes(normalizedQuery)) {
      return;
    }

    const url = new URL(href);
    const slugParts = url.pathname.split('/').filter(Boolean);
    const category = baseCategory
      || (categoryFromUrl ? slugParts[0] || null : null);

    seen.add(href);
    items.push({
      title,
      url: href,
      category,
      summary: getArticleSummary(link) || null,
      image: getArticleImage(link, baseUrl)
    });
  });

  return uniqueByUrl(items).slice(0, maxItems);
}

async function liputan6News(query = '') {
  const html = await getHtml(LIPUTAN6_BASE_URL);
  const $ = cheerio.load(html);
  const items = collectArticles($, LIPUTAN6_BASE_URL, {
    query,
    maxItems: 10,
    hrefPredicate: (href) => href.startsWith(`${LIPUTAN6_BASE_URL}/`) && href.includes('/read/'),
    titlePredicate: (title, href) => {
      const pathname = new URL(href).pathname;
      return pathname.includes('/read/');
    },
    categoryFromUrl: true
  });

  if (!items.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'liputan6',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function antaraNews(query = '') {
  const html = await getHtml(`${ANTARA_BASE_URL}/terkini`);
  const $ = cheerio.load(html);
  const normalizedQuery = normalizeText(query);
  const items = [];
  const seen = new Set();

  $('.card__post__title a[href*="antaranews.com/"], .post_title a[href*="antaranews.com/"], .card__post a[href*="antaranews.com/"]').each((_, element) => {
    const link = $(element);
    const href = absoluteUrl(link.attr('href'), ANTARA_BASE_URL);
    const title = firstNonEmpty(link.attr('title'), link.text());

    if (!href || seen.has(href) || !title) {
      return;
    }

    const url = new URL(href);
    const pathname = url.pathname;
    if (!/\/(berita|foto|video)\//.test(pathname)) {
      return;
    }

    if (normalizedQuery && !normalizeText(title).includes(normalizedQuery) && !normalizeText(pathname).includes(normalizedQuery)) {
      return;
    }

    const card = link.closest('.card__post, .card__post-list, .item').first();
    const category = firstNonEmpty(
      card.find('.card__post__category').first().text(),
      pathname.split('/').filter(Boolean)[0] || ''
    );

    seen.add(href);
    items.push({
      title,
      url: href,
      category: category || null,
      summary: firstNonEmpty(
        card.find('.card__post__summary').first().text(),
        card.find('.card__post__content p').first().text()
      ) || null,
      image: getArticleImage(link, ANTARA_BASE_URL)
    });
  });

  const finalItems = uniqueByUrl(items).slice(0, 10);

  if (!finalItems.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'antara',
    query,
    total_count: finalItems.length,
    best_match: finalItems[0] || null,
    items: finalItems
  };
}

async function beritaIndoNews(query = '') {
  const html = await getHtml(BERITA_INDO_BASE_URL);
  const $ = cheerio.load(html);
  const items = collectArticles($, BERITA_INDO_BASE_URL, {
    query,
    maxItems: 10,
    hrefPredicate: (href) => href.startsWith(`${BERITA_INDO_BASE_URL}/`) && /\/\d+\//.test(new URL(href).pathname),
    titlePredicate: (title, href) => /\/\d+\//.test(new URL(href).pathname),
    categoryFromUrl: true
  });

  if (!items.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'berita-indo',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function tempoNews(query = '') {
  const html = await getHtml(TEMPO_BASE_URL);
  const $ = cheerio.load(html);
  const items = collectArticles($, TEMPO_BASE_URL, {
    query,
    maxItems: 10,
    hrefPredicate: (href) => href.startsWith(`${TEMPO_BASE_URL}/`) && /-\d+(?:\/)?$/.test(new URL(href).pathname),
    titlePredicate: (title, href) => /-\d+(?:\/)?$/.test(new URL(href).pathname),
    categoryFromUrl: true
  });

  if (!items.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'tempo',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function cnbcNews(query = '') {
  const html = await getHtml(CNBC_BASE_URL);
  const $ = cheerio.load(html);
  const items = collectArticles($, CNBC_BASE_URL, {
    query,
    maxItems: 10,
    hrefPredicate: (href) => href.startsWith(`${CNBC_BASE_URL}/`) && /\/\d{14}-\d+-\d+\//.test(new URL(href).pathname),
    titlePredicate: (title, href) => /\/\d{14}-\d+-\d+\//.test(new URL(href).pathname),
    categoryFromUrl: true
  });

  if (!items.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'cnbc',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function merdekaNews(query = 'peristiwa') {
  const searchUrl = `${MERDEKA_BASE_URL}/peristiwa`;
  const html = await getHtml(searchUrl);
  const $ = cheerio.load(html);
  const normalizedQuery = normalizeText(query);

  const candidates = [];
  $('a[href*="/peristiwa/"]').each((_, element) => {
    const link = $(element);
    const href = absoluteUrl(link.attr('href'), MERDEKA_BASE_URL);
    const text = cleanText(link.text());
    const slug = normalizeText(href);

    if (!href || !text || text.length < 8) {
      return;
    }

    if (normalizedQuery && !normalizeText(text).includes(normalizedQuery) && !slug.includes(normalizedQuery)) {
      return;
    }

    candidates.push({
      title_hint: text,
      url: href
    });
  });

  const selected = uniqueByUrl(candidates).slice(0, 5);

  if (!selected.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  const items = [];
  for (const candidate of selected) {
    const detailHtml = await getHtml(candidate.url);
    const $detail = cheerio.load(detailHtml);

    items.push({
      title: firstNonEmpty(
        $detail('meta[property="og:title"]').attr('content'),
        $detail('h1').first().text(),
        candidate.title_hint
      ),
      upload_date: firstNonEmpty(
        $detail('meta[property="article:published_time"]').attr('content'),
        $detail('time').first().attr('datetime'),
        $detail('.date').first().text()
      ),
      link: candidate.url,
      thumb: firstNonEmpty(
        $detail('meta[property="og:image"]').attr('content'),
        $detail('meta[name="twitter:image"]').attr('content')
      ),
      summary: firstNonEmpty(
        $detail('meta[name="description"]').attr('content'),
        $detail('meta[property="og:description"]').attr('content')
      )
    });
  }

  return {
    provider: 'merdeka',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function cnnNews(query = '') {
  const html = await getHtml(CNN_BASE_URL);
  const $ = cheerio.load(html);
  const normalizedQuery = normalizeText(query);
  const items = [];
  const seen = new Set();

  $('article').each((_, element) => {
    const node = $(element);
    const link = node.find('a[href^="https://www.cnnindonesia.com/"]').first();
    const url = absoluteUrl(link.attr('href'), CNN_BASE_URL);
    const title = firstNonEmpty(link.find('h2').first().text(), link.attr('data-title'), link.text());
    const category = firstNonEmpty(link.find('span').last().text(), node.find('span').last().text());

    if (!url || !title || seen.has(url)) {
      return;
    }

    if (normalizedQuery && !normalizeText(title).includes(normalizedQuery) && !normalizeText(category).includes(normalizedQuery)) {
      return;
    }

    seen.add(url);
    items.push({
      title,
      category: category || null,
      url
    });
  });

  if (!items.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'cnn',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items: items.slice(0, 5)
  };
}

async function detikNews(query = 'indonesia') {
  const searchUrl = `${DETIK_BASE_URL}/search/searchall?query=${encodeURIComponent(query)}`;
  const html = await getHtml(searchUrl);
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('article').each((_, element) => {
    const node = $(element);
    const link = node.find('a').first();
    const url = absoluteUrl(link.attr('href'), DETIK_BASE_URL);
    const title = firstNonEmpty(node.find('h2').first().text(), link.text());
    const category = firstNonEmpty(node.find('.category').first().text(), node.find('.media__subtitle').first().text(), node.find('.kanal').first().text());
    const summary = firstNonEmpty(node.find('p').first().text());
    const time = firstNonEmpty(node.find('.date').first().text(), node.find('.media__date').first().text());
    const image = firstNonEmpty(node.find('img').first().attr('src'), node.find('img').first().attr('data-src'));

    if (!url || !title || seen.has(url)) {
      return;
    }

    seen.add(url);
    items.push({
      title,
      category: category || null,
      summary: summary || null,
      time: time || null,
      image: image || null,
      link: url
    });
  });

  if (!items.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'detik',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items: items.slice(0, 10)
  };
}

async function kompasNews(query = 'indonesia') {
  const searchUrl = `${KOMPAS_BASE_URL}/search?q=${encodeURIComponent(query)}`;
  const html = await getHtml(searchUrl);
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('.articleItem').each((_, element) => {
    const node = $(element);
    const link = node.find('a.article-link').first();
    const url = absoluteUrl(link.attr('href'), KOMPAS_BASE_URL);
    const title = firstNonEmpty(node.find('.articleTitle').first().text(), link.find('h2').first().text(), link.text());
    const category = firstNonEmpty(node.find('.articlePost-subtitle').first().text());
    const date = firstNonEmpty(node.find('.articlePost-date').first().text());
    const snippet = firstNonEmpty(node.find('.articleLead p').first().text(), node.find('p').first().text());
    const image = firstNonEmpty(node.find('img').first().attr('src'));

    if (!url || !title || seen.has(url)) {
      return;
    }

    seen.add(url);
    items.push({
      title,
      category: category || null,
      snippet: snippet || null,
      date: date || null,
      image: image || null,
      link: url
    });
  });

  if (!items.length) {
    const error = new Error('berita tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'kompas',
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items: items.slice(0, 10)
  };
}

async function listNewsProviders() {
  return [
    {
      id: 'liputan6',
      label: 'Liputan6',
      endpoint: '/api/news/liputan6',
      input: 'query',
      example: 'politik',
      description: 'Berita terkini Liputan6'
    },
    {
      id: 'antara',
      label: 'ANTARA News',
      endpoint: '/api/news/antara',
      input: 'query',
      example: 'ekonomi',
      description: 'Berita terbaru ANTARA'
    },
    {
      id: 'berita-indo',
      label: 'Berita-indo.id',
      endpoint: '/api/news/berita-indo',
      input: 'query',
      example: 'nasional',
      description: 'Berita seputar Indonesia'
    },
    {
      id: 'tempo',
      label: 'Tempo',
      endpoint: '/api/news/tempo',
      input: 'query',
      example: 'politik',
      description: 'Berita terkini Tempo'
    },
    {
      id: 'cnbc',
      label: 'CNBC Indonesia',
      endpoint: '/api/news/cnbc',
      input: 'query',
      example: 'news',
      description: 'Berita ekonomi dan bisnis CNBC Indonesia'
    },
    {
      id: 'merdeka',
      label: 'Merdeka',
      endpoint: '/api/news/merdeka',
      input: 'query',
      example: 'peristiwa',
      description: 'News peristiwa Merdeka'
    },
    {
      id: 'cnn',
      label: 'CNN Indonesia',
      endpoint: '/api/news/cnn',
      input: 'query',
      example: 'nasional',
      description: 'News terbaru CNN Indonesia'
    },
    {
      id: 'detik',
      label: 'Detik',
      endpoint: '/api/news/detik',
      input: 'query',
      example: 'indonesia',
      description: 'Search berita Detik'
    },
    {
      id: 'kompas',
      label: 'Kompas',
      endpoint: '/api/news/kompas',
      input: 'query',
      example: 'indonesia',
      description: 'Search berita Kompas'
    }
  ];
}

async function newsSearch(provider, query) {
  const id = String(provider || '').trim().toLowerCase();

  if (!id) {
    const error = new Error('masukan parameter provider');
    error.status = 406;
    throw error;
  }

  if (id === 'merdeka') {
    return merdekaNews(query);
  }

  if (id === 'liputan6') {
    return liputan6News(query);
  }

  if (id === 'antara') {
    return antaraNews(query);
  }

  if (id === 'berita-indo') {
    return beritaIndoNews(query);
  }

  if (id === 'tempo') {
    return tempoNews(query);
  }

  if (id === 'cnbc') {
    return cnbcNews(query);
  }

  if (id === 'cnn') {
    return cnnNews(query);
  }

  if (id === 'detik') {
    return detikNews(query);
  }

  if (id === 'kompas') {
    return kompasNews(query);
  }

  const error = new Error('provider news tidak tersedia');
  error.status = 404;
  throw error;
}

module.exports = {
  listNewsProviders,
  newsSearch
};
