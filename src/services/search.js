const cheerio = require('cheerio');

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }

  return null;
}

async function fetchText(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0',
        ...(options.headers || {})
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

function decodeBingMediaUrl(url) {
  const match = String(url || '').match(/[?&]mediaurl=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

async function gsmArenaSearch(query) {
  const text = String(query || '').trim();
  if (!text) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }

  const html = await fetchText(`https://gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(text)}`);
  const $ = cheerio.load(html);
  const items = [];

  $('.makers li').each((_, element) => {
    const node = $(element);
    const href = node.find('a').attr('href');
    const id = href ? href.replace(/\.php$/, '') : null;
    const name = firstNonEmpty(node.find('span').text().replace(/\s+/g, ' '));
    const thumbnail = node.find('img').attr('src') || null;
    const description = node.find('img').attr('title') || null;

    if (id && name) {
      items.push({
        id,
        name,
        thumbnail,
        description,
        url: href ? `https://www.gsmarena.com/${href}` : null
      });
    }
  });

  if (!items.length) {
    const error = new Error('hasil gsmarena tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'gsmarena',
    query: text,
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function bingImageSearch(query) {
  const text = String(query || '').trim();
  if (!text) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }

  const html = await fetchText(`https://www.bing.com/images/search?q=${encodeURIComponent(text)}`);
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  $('.imgpt > a').each((_, element) => {
    const href = $(element).attr('href');
    const imageUrl = decodeBingMediaUrl(href);

    if (!imageUrl || seen.has(imageUrl)) {
      return;
    }

    seen.add(imageUrl);
    items.push({
      image_url: imageUrl,
      source_url: href ? `https://www.bing.com${href}` : null
    });
  });

  if (!items.length) {
    const error = new Error('hasil bing image tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'bing-image',
    query: text,
    total_count: items.length,
    best_match: items[0] || null,
    items: items.slice(0, 20)
  };
}

function absoluteUrl(baseUrl, href) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

function extractText($, selector) {
  return firstNonEmpty($(selector).first().text().replace(/\s+/g, ' '));
}

function mapLk21Card($, element, baseUrl) {
  const node = $(element);
  const linkNode = node.find('a').first();
  const url = absoluteUrl(baseUrl, linkNode.attr('href'));
  const title = firstNonEmpty(
    node.find('.poster-title').first().text(),
    linkNode.attr('title'),
    node.find('img').attr('title')
  );
  const image = firstNonEmpty(
    node.find('img').attr('src'),
    node.find('source[type=\"image/jpeg\"]').attr('srcset'),
    node.find('source[type=\"image/webp\"]').attr('srcset')
  );
  const genre = firstNonEmpty(
    node.find('.genre').first().text(),
    node.find('meta[itemprop=\"genre\"]').attr('content')
  );
  const rating = firstNonEmpty(
    node.find('.rating [itemprop=\"ratingValue\"]').text(),
    node.find('.rating').first().text().replace(/\s+/g, ' ')
  );
  const year = firstNonEmpty(node.find('.year').first().text());
  const quality = firstNonEmpty(node.find('.label').first().text());
  const duration = firstNonEmpty(node.find('.duration').first().text());
  const type = String(node.find('.episode').length ? 'series' : 'movie');

  if (!title || !url) {
    return null;
  }

  return {
    title,
    url,
    image: image || null,
    genre: genre || null,
    rating: rating || null,
    year: year || null,
    quality: quality || null,
    duration: duration || null,
    type
  };
}

async function fetchLk21Detail(url) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const openNow = $('#openNow').attr('href') || $('a#openNow').attr('href') || null;
  const finalUrl = openNow || url;
  const finalHtml = openNow ? await fetchText(openNow) : html;
  const $final = openNow ? cheerio.load(finalHtml) : $;
  const info = $final('.movie-info').first();

  if (!info.length) {
    return {
      source_url: url,
      final_url: finalUrl,
      title: extractText($final, 'h1'),
      synopsis: firstNonEmpty($final('meta[name=\"description\"]').attr('content'), $final('meta[property=\"og:description\"]').attr('content'))
    };
  }

  const tags = info.find('.tag-list .tag a').map((_, el) => $final(el).text().trim()).get().filter(Boolean);
  const infoTag = info.find('.info-tag span').map((_, el) => $final(el).text().trim()).get().filter(Boolean);
  const synopsis = firstNonEmpty(info.find('.synopsis').text().replace(/\s+/g, ' '));
  const latestEpisode = firstNonEmpty(info.find('.meta-info p').first().text().replace(/\s+/g, ' '));
  const detailLines = info.find('.detail p').map((_, el) => $final(el).text().replace(/\s+/g, ' ').trim()).get();

  const director = detailLines.find((line) => line.startsWith('Sutradara:'))?.replace('Sutradara:', '').trim() || null;
  const cast = detailLines.find((line) => line.startsWith('Bintang Film:'))?.replace('Bintang Film:', '').trim().split(/\s*,\s*/).filter(Boolean) || [];
  const country = detailLines.find((line) => line.startsWith('Negara:'))?.replace('Negara:', '').trim() || null;
  const votes = detailLines.find((line) => line.startsWith('Votes:'))?.replace('Votes:', '').trim() || null;
  const image = firstNonEmpty(
    info.find('.detail img').attr('src'),
    $final('meta[property=\"og:image\"]').attr('content')
  );

  return {
    source_url: url,
    final_url: finalUrl,
    title: extractText($final, '.movie-info h1'),
    rating: infoTag[0] || null,
    release_date: infoTag[1] || null,
    region: infoTag[2] || null,
    status: infoTag[3] || null,
    tags,
    genre: tags.join(', ') || null,
    latest_episode: latestEpisode,
    synopsis: synopsis || null,
    director,
    cast,
    country,
    votes,
    image: image || null
  };
}

async function lk21Search(query) {
  const text = String(query || '').trim();
  if (!text) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }

  const baseUrl = 'https://tv10.lk21official.cc';
  const html = await fetchText(`${baseUrl}/?s=${encodeURIComponent(text)}`);
  const $ = cheerio.load(html);
  const items = [];

  $('article[itemtype=\"https://schema.org/Movie\"]').each((_, element) => {
    const item = mapLk21Card($, element, baseUrl);
    if (item) {
      items.push(item);
    }
  });

  if (!items.length) {
    const error = new Error('hasil lk21 tidak ditemukan');
    error.status = 404;
    throw error;
  }

  const detail = await fetchLk21Detail(items[0].url);

  return {
    provider: 'lk21',
    query: text,
    total_count: items.length,
    best_match: {
      ...items[0],
      detail
    },
    items: items.slice(0, 20)
  };
}

async function lk21Popular() {
  const baseUrl = 'https://tv10.lk21official.cc';
  const html = await fetchText(baseUrl);
  const $ = cheerio.load(html);
  const widget = $('.widget').filter((_, el) => $(el).find('h2,h3,h4').first().text().trim().includes('TOP BULAN INI')).first();
  const items = [];

  widget.find('li.slider article').each((_, element) => {
    const item = mapLk21Card($, element, baseUrl);
    if (item) {
      items.push(item);
    }
  });

  if (!items.length) {
    const error = new Error('hasil populer lk21 tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'lk21',
    category: 'top-bulan-ini',
    total_count: items.length,
    best_match: items[0] || null,
    items
  };
}

async function pinterestSearch(query) {
  const text = String(query || '').trim();
  if (!text) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }

  const sourceUrl = `/search/pins/?q=${encodeURIComponent(text)}&rs=typed`;
  const payload = {
    options: {
      query: text,
      scope: 'pins',
      rs: 'typed',
      page_size: 20,
      field_set_key: 'unauth_react_main_pin',
      no_fetch_context_on_resource: false
    },
    context: {},
    module: {
      name: 'SearchPage',
      options: {
        query: text,
        scope: 'pins',
        rs: 'typed'
      }
    },
    render_type: 1,
    error_strategy: 0
  };

  const params = new URLSearchParams({
    source_url: sourceUrl,
    data: JSON.stringify(payload)
  });

  const response = await fetch(`https://www.pinterest.com/resource/BaseSearchResource/get/?${params.toString()}`, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'user-agent': 'Mozilla/5.0',
      'x-app-version': 'xxx',
      'x-pinterest-appstate': 'active',
      'x-pinterest-pws-handler': 'www/[username]/[slug].js',
      'x-pinterest-source-url': sourceUrl,
      'x-requested-with': 'XMLHttpRequest',
      referer: 'https://www.pinterest.com/'
    }
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.resource_response?.data?.results) {
    const error = new Error('hasil pinterest tidak ditemukan');
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }

  const items = result.resource_response.data.results
    .filter((item) => item?.type === 'pin' && item?.images?.orig?.url)
    .map((item) => ({
      id: item.id || null,
      title: firstNonEmpty(item.grid_title, item.title, item.description, item.seo_alt_text),
      description: firstNonEmpty(item.description, item.auto_alt_text, item.seo_alt_text),
      url: item.id ? `https://www.pinterest.com/pin/${item.id}` : null,
      image_url: item.images.orig.url,
      preview_url: item.images['474x']?.url || item.images['236x']?.url || item.images.orig.url,
      width: item.images.orig.width || null,
      height: item.images.orig.height || null,
      dominant_color: item.dominant_color || null,
      pinner: {
        username: item.pinner?.username || null,
        name: item.pinner?.full_name || null
      },
      board: {
        name: item.board?.name || null,
        url: item.board?.url ? absoluteUrl('https://www.pinterest.com', item.board.url) : null
      },
      tags: Array.isArray(item.pin_join?.visual_annotation) ? item.pin_join.visual_annotation.slice(0, 10) : []
    }));

  if (!items.length) {
    const error = new Error('hasil pin pinterest tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return {
    provider: 'pinterest-search',
    query: text,
    total_count: items.length,
    best_match: items[0] || null,
    items,
    bookmark: result.resource_response.bookmark || null
  };
}

module.exports = {
  bingImageSearch,
  gsmArenaSearch,
  lk21Popular,
  lk21Search,
  pinterestSearch
};
