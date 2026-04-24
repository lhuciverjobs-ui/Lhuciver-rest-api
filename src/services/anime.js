const cheerio = require('cheerio');

async function fetchHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0'
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

function ensureQuery(query) {
  const text = String(query || '').trim();
  if (!text) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }
  return text;
}

function makeSearchResult(provider, query, items) {
  if (!items.length) {
    const error = new Error(`hasil ${provider} tidak ditemukan`);
    error.status = 404;
    throw error;
  }

  return {
    provider,
    query,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function anichinSearch(query) {
  const text = ensureQuery(query);
  const html = await fetchHtml(`https://anichin.cafe/?s=${encodeURIComponent(text)}`);
  const $ = cheerio.load(html);
  const items = [];

  $('.listupd article.bs').each((_, element) => {
    const node = $(element);
    const box = node.find('.bsx').first();
    const linkNode = box.find('a').first();
    const title = linkNode.attr('title') || box.find('.tt').text().trim() || null;
    const link = linkNode.attr('href') || null;
    const image = box.find('img').attr('src') || null;
    const type = box.find('.typez').text().trim() || null;
    const status = box.find('.status').text().trim() || box.find('.epx').text().trim() || null;

    if (title && link) {
      items.push({ title, link, image, type, status });
    }
  });

  return makeSearchResult('anichin', text, items);
}

async function auratailSearch(query) {
  const text = ensureQuery(query);
  const html = await fetchHtml(`https://auratail.vip/?s=${encodeURIComponent(text)}`);
  const $ = cheerio.load(html);
  const items = [];

  $('#content .listupd article.bs').each((_, element) => {
    const node = $(element);
    const box = node.find('.bsx').first();
    const linkNode = box.find('a').first();
    const title = linkNode.attr('title') || box.find('.tt').text().trim() || null;
    const link = linkNode.attr('href') || null;
    const image = box.find('img').attr('src') || box.find('img').attr('data-src') || null;
    const type = box.find('.typez').text().trim() || null;
    const status = box.find('.status').text().trim() || box.find('.epx').text().trim() || null;

    if (title && link) {
      items.push({ title, link, image, type, status });
    }
  });

  return makeSearchResult('auratail', text, items);
}

async function oploverzSearch(query) {
  const text = ensureQuery(query);
  const html = await fetchHtml(`https://oploverz.org/?q=${encodeURIComponent(text)}`);
  const $ = cheerio.load(html);
  const items = [];

  $('.bg-white.shadow.xrelated.relative').each((_, element) => {
    const node = $(element);
    const linkNode = node.find('a.rt').first();
    const title = node.find('.titlelist.tublok').text().trim() || null;
    const link = linkNode.attr('href') || null;
    const image = node.find('img').attr('src') || null;
    const episodes = node.find('.eplist').text().trim() || null;
    const rating = node.find('.starlist').text().replace(/\s+/g, ' ').trim() || null;

    if (title && link) {
      items.push({ title, link, image, episodes, rating });
    }
  });

  return makeSearchResult('oploverz', text, items);
}

async function komikindoSearch(query) {
  const text = ensureQuery(query);
  const html = await fetchHtml(`https://komikindo.ch/?s=${encodeURIComponent(text)}`);
  const $ = cheerio.load(html);
  const items = [];

  $('.animepost').each((_, element) => {
    const node = $(element);
    const linkNode = node.find('.animposx > a, .tt h3 a').first();
    const title = node.find('.tt h3 a').text().trim() || linkNode.attr('title') || node.find('img').attr('title') || null;
    const link = linkNode.attr('href') || null;
    const image = node.find('img').attr('src') || null;
    const type = node.find('.typeflag').attr('class')?.split(' ').filter((item) => item && item !== 'typeflag').join(' ') || null;
    const rating = node.find('.rating').text().replace(/\s+/g, ' ').trim() || node.find('.numscore').text().trim() || null;

    if (title && link) {
      items.push({ title, link, image, type, rating });
    }
  });

  return makeSearchResult('komikindo', text, items);
}

module.exports = {
  anichinSearch,
  auratailSearch,
  komikindoSearch,
  oploverzSearch
};
