const cheerio = require('cheerio');

async function getJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'local-restapi/1.0',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const error = new Error(`upstream ${response.status}`);
      error.status = 502;
      throw error;
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function githubUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const data = await getJson(`https://api.github.com/users/${encodeURIComponent(username)}`);

  return buildStalkerProfile('github', {
    id: data.id,
    username: data.login,
    name: data.name,
    bio: data.bio,
    avatar: data.avatar_url,
    url: data.html_url,
    verified: Boolean(data.site_admin),
    stats: {
      followers: data.followers,
      following: data.following,
      repos: data.public_repos,
      gists: data.public_gists
    },
    meta: {
      type: data.type || null,
      company: data.company || null,
      blog: data.blog || null,
      location: data.location || null,
      email: data.email || null,
      created_at: data.created_at || null,
      updated_at: data.updated_at || null
    }
  });
}

async function npmPackage(name) {
  if (!name) {
    const error = new Error('masukan parameter package');
    error.status = 406;
    throw error;
  }

  const data = await getJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  const latest = data['dist-tags']?.latest;
  const version = latest ? data.versions?.[latest] : null;

  return {
    name: data.name,
    description: data.description,
    latest,
    license: version?.license || data.license,
    homepage: data.homepage,
    repository: data.repository,
    npm: `https://www.npmjs.com/package/${data.name}`
  };
}

async function wikipedia(query) {
  if (!query) {
    const error = new Error('masukan parameter query');
    error.status = 406;
    throw error;
  }

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '5',
    prop: 'extracts|info',
    exintro: '1',
    explaintext: '1',
    inprop: 'url',
    format: 'json',
    origin: '*'
  });
  const data = await getJson(`https://id.wikipedia.org/w/api.php?${params.toString()}`);
  const pages = Object.values(data.query?.pages || {});

  return pages.map((page) => ({
    title: page.title,
    extract: page.extract,
    url: page.fullurl
  }));
}

function formatCompactNumber(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return null;
  }

  const number = Number(value);
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(number);
}

function compactStats(stats = {}) {
  const output = {};

  for (const [key, value] of Object.entries(stats)) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) {
      output[key] = null;
      continue;
    }

    output[key] = Number(value);
  }

  return output;
}

function compactLabels(stats = {}) {
  const output = {};

  for (const [key, value] of Object.entries(stats)) {
    output[key] = value === undefined || value === null ? null : formatCompactNumber(value);
  }

  return output;
}

function buildStalkerProfile(platform, payload = {}) {
  const stats = compactStats(payload.stats || {});

  return {
    platform,
    id: payload.id || null,
    username: payload.username || null,
    name: payload.name || null,
    bio: payload.bio || null,
    avatar: payload.avatar || null,
    url: payload.url || null,
    verified: Boolean(payload.verified),
    private: Boolean(payload.private),
    stats,
    stats_label: compactLabels(stats),
    meta: payload.meta || {}
  };
}

function parseCompactNumber(value) {
  const text = String(value || '').trim().replace(/,/g, '');
  const match = text.match(/^(\d+(?:\.\d+)?)([KMB])?$/i);

  if (!match) {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const number = Number(match[1]);
  const suffix = String(match[2] || '').toUpperCase();

  if (suffix === 'K') return Math.round(number * 1_000);
  if (suffix === 'M') return Math.round(number * 1_000_000);
  if (suffix === 'B') return Math.round(number * 1_000_000_000);
  return Math.round(number);
}

async function getText(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await response.text();

    return {
      status: response.status,
      ok: response.ok,
      text
    };
  } finally {
    clearTimeout(timeout);
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function parseInstagramMetaDescription(description, username) {
  const text = String(description || '').trim();
  const counters = text.match(/([\d.,]+[KMB]?)\s+Followers,\s+([\d.,]+[KMB]?)\s+Following,\s+([\d.,]+[KMB]?)\s+Posts/i);
  const owner = text.match(/from\s+(.+?)\s+\(@([^)]+)\)/i);
  const biography = text.match(/:\s*[“"]([\s\S]*?)[”"]/);

  const followers = parseCompactNumber(counters?.[1]);
  const following = parseCompactNumber(counters?.[2]);
  const posts = parseCompactNumber(counters?.[3]);

  return {
    username: owner?.[2] || username,
    full_name: owner?.[1] || null,
    biography: biography?.[1]?.trim() || null,
    followers,
    following,
    posts
  };
}

function normalizeInstagramProfile(user, fallbackUsername) {
  const followers = user.followers ?? user.edge_followed_by?.count ?? null;
  const following = user.following ?? user.edge_follow?.count ?? null;
  const posts = user.posts ?? user.edge_owner_to_timeline_media?.count ?? null;
  const username = user.username || fallbackUsername;

  return buildStalkerProfile('instagram', {
    id: user.id || null,
    username,
    name: user.full_name || user.name || null,
    bio: user.biography || user.description || null,
    avatar: user.profile_pic_url_hd || user.profile_pic_url || user.image || null,
    url: `https://www.instagram.com/${username}/`,
    verified: Boolean(user.is_verified),
    private: Boolean(user.is_private),
    stats: {
      followers,
      following,
      posts
    },
    meta: {
      category: user.business_category_name || user.category_name || null,
      is_business: Boolean(user.is_business_account),
      is_professional: Boolean(user.is_professional_account),
      highlight_reel_count: user.highlight_reel_count ?? 0,
      external_url: user.external_url || null,
      business_email: user.business_email || null,
      business_phone_number: user.business_phone_number || null
    }
  });
}

function parseInitialState(html) {
  const source = String(html || '');
  const startToken = 'window.__INITIAL_STATE__=';
  const endToken = ';window.__META_DATA__=';
  const start = source.indexOf(startToken);

  if (start < 0) {
    return null;
  }

  const from = start + startToken.length;
  const end = source.indexOf(endToken, from);

  if (end < 0) {
    return null;
  }

  const payload = source.slice(from, end);

  try {
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

function findXUserEntity(initialState, username) {
  const entities = initialState?.entities?.users?.entities || {};
  const cleanUsername = String(username || '').replace(/^@/, '').trim().toLowerCase();

  for (const value of Object.values(entities)) {
    if (!value || typeof value !== 'object') {
      continue;
    }

    if (String(value.screen_name || '').toLowerCase() === cleanUsername) {
      return value;
    }
  }

  return null;
}

function normalizeXUser(user, fallbackUsername) {
  const username = user.screen_name || fallbackUsername;
  const followers = user.followers_count ?? user.normal_followers_count ?? null;
  const following = user.friends_count ?? null;
  const posts = user.statuses_count ?? null;
  const website = user.entities?.url?.urls?.[0]?.expanded_url
    || user.entities?.description?.urls?.[0]?.expanded_url
    || null;

  return buildStalkerProfile('x', {
    id: user.id_str || null,
    username,
    name: user.name || null,
    bio: user.description || null,
    avatar: user.profile_image_url_https || null,
    url: `https://x.com/${username}`,
    verified: Boolean(user.verified || user.is_blue_verified),
    private: Boolean(user.protected),
    stats: {
      followers,
      following,
      posts,
      likes: user.favourites_count ?? null,
      media: user.media_count ?? null,
      listed: user.listed_count ?? null
    },
    meta: {
      banner: user.profile_banner_url || null,
      location: user.location || null,
      joined_at: user.created_at || null,
      website,
      is_blue_verified: Boolean(user.is_blue_verified),
      professional_type: user.professional?.professional_type || null
    }
  });
}

function decodeUnicodeSlash(value) {
  return String(value || '')
    .replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function parseYoutubeCount(value) {
  const numeric = parseCompactNumber(String(value || '').replace(/subscribers?|videos?/gi, '').trim());
  return numeric;
}

async function pinterestUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const cleanUsername = String(username).replace(/^@/, '').trim();
  const baseUrl = 'https://www.pinterest.com';
  const homeResponse = await fetch(baseUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0'
    }
  });
  const cookies = homeResponse.headers.getSetCookie
    ? homeResponse.headers.getSetCookie().map((item) => item.split(';')[0]).join('; ')
    : homeResponse.headers.get('set-cookie')?.split(',').map((item) => item.split(';')[0]).join('; ') || '';

  const params = new URLSearchParams({
    source_url: `/${cleanUsername}/`,
    data: JSON.stringify({
      options: {
        username: cleanUsername,
        field_set_key: 'profile',
        isPrefetch: false
      },
      context: {}
    }),
    _: String(Date.now())
  });

  const data = await getJson(`${baseUrl}/resource/UserResource/get/?${params.toString()}`, {
    headers: {
      accept: 'application/json, text/javascript, */*',
      referer: `${baseUrl}/${cleanUsername}/`,
      'x-pinterest-appstate': 'active',
      'x-pinterest-pws-handler': 'www/[username]/[slug].js',
      'x-pinterest-source-url': `/${cleanUsername}/`,
      'x-requested-with': 'XMLHttpRequest',
      cookie: cookies
    }
  }, 15000);

  const user = data?.resource_response?.data;

  if (!user) {
    const error = new Error('user pinterest tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return buildStalkerProfile('pinterest', {
    id: user.id || null,
    username: user.username || cleanUsername,
    name: user.full_name || null,
    bio: user.about || null,
    avatar: user.image_xlarge_url || user.image_large_url || user.image_medium_url || user.image_small_url || null,
    url: `https://www.pinterest.com/${user.username || cleanUsername}/`,
    verified: Boolean(user.verified_identity),
    stats: {
      followers: user.follower_count || 0,
      following: user.following_count || 0,
      pins: user.pin_count || 0,
      boards: user.board_count || 0
    },
    meta: {
      website: user.website_url || user.domain_url || null,
      location: user.location || null,
      country: user.country || null,
      is_partner: Boolean(user.is_partner),
      images: {
        small: user.image_small_url || null,
        medium: user.image_medium_url || null,
        large: user.image_large_url || null,
        original: user.image_xlarge_url || null
      },
      social_links: {
        twitter: user.twitter_url || null,
        facebook: user.facebook_url || null,
        instagram: user.instagram_url || null,
        youtube: user.youtube_url || null
      }
    }
  });
}

async function robloxUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const cleanUsername = String(username).trim();
  const userLookup = await getJson('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      usernames: [cleanUsername],
      excludeBannedUsers: false
    })
  }, 15000);

  const userId = userLookup?.data?.[0]?.id;
  if (!userId) {
    const error = new Error('user roblox tidak ditemukan');
    error.status = 404;
    throw error;
  }

  const [basic, friends, followers, following, headshot, presence] = await Promise.all([
    getJson(`https://users.roblox.com/v1/users/${userId}`),
    getJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
    getJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
    getJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
    getJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`),
    getJson('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ userIds: [userId] })
    })
  ]);

  const presenceType = presence?.userPresences?.[0]?.userPresenceType ?? 0;
  const presenceLabel = {
    0: 'Offline',
    1: 'Online',
    2: 'In Game',
    3: 'In Studio'
  }[presenceType] || 'Unknown';

  return buildStalkerProfile('roblox', {
    id: basic.id,
    username: basic.name,
    name: basic.displayName,
    bio: basic.description || null,
    avatar: headshot?.data?.[0]?.imageUrl || null,
    url: `https://www.roblox.com/users/${basic.id}/profile`,
    stats: {
      followers: followers?.count || 0,
      following: following?.count || 0,
      friends: friends?.count || 0
    },
    meta: {
      created_at: basic.created || null,
      is_banned: Boolean(basic.isBanned),
      presence: {
        type: presenceType,
        label: presenceLabel,
        last_location: presence?.userPresences?.[0]?.lastLocation || null,
        place_id: presence?.userPresences?.[0]?.placeId || null
      }
    }
  });
}

function extractThreadsUserFromHtml(html, fallbackUsername) {
  const source = String(html || '');

  const fullMatch = source.match(/"username":"([^"]+)".*?"full_name":"([^"]*)".*?"biography":"([^"]*)".*?"follower_count":(\d+).*?"profile_pic_url":"([^"]+)"/s);
  if (fullMatch) {
    return {
      username: fullMatch[1],
      full_name: decodeUnicodeSlash(fullMatch[2]),
      biography: decodeUnicodeSlash(fullMatch[3]),
      follower_count: Number(fullMatch[4]),
      profile_pic_url: decodeUnicodeSlash(fullMatch[5])
    };
  }

  const lightMatch = source.match(/"username":"([^"]+)".*?"full_name":"([^"]+)".*?"profile_pic_url":"([^"]+)"/s);
  if (lightMatch) {
    return {
      username: lightMatch[1],
      full_name: decodeUnicodeSlash(lightMatch[2]),
      biography: null,
      follower_count: null,
      profile_pic_url: decodeUnicodeSlash(lightMatch[3])
    };
  }

  return fallbackUsername ? {
    username: fallbackUsername,
    full_name: null,
    biography: null,
    follower_count: null,
    profile_pic_url: null
  } : null;
}

async function threadsUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const cleanUsername = String(username).replace(/^@/, '').trim();
  const response = await getText(`https://www.threads.net/@${encodeURIComponent(cleanUsername)}`, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0'
    }
  }, 15000);

  if (response.status === 404) {
    const error = new Error('user threads tidak ditemukan');
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`upstream ${response.status}`);
    error.status = 502;
    throw error;
  }

  const user = extractThreadsUserFromHtml(response.text, cleanUsername);
  if (!user) {
    const error = new Error('gagal membaca profil threads');
    error.status = 502;
    throw error;
  }

  return buildStalkerProfile('threads', {
    id: user.id || null,
    username: user.username || cleanUsername,
    name: user.full_name || null,
    bio: user.biography || null,
    avatar: user.profile_pic_url || null,
    url: `https://www.threads.net/@${user.username || cleanUsername}`,
    verified: Boolean(user.is_verified),
    stats: {
      followers: user.follower_count
    },
    meta: {
      links: Array.isArray(user.bio_links) ? user.bio_links.map((item) => item.url).filter(Boolean) : []
    }
  });
}

function extractYoutubeInitialData(html) {
  const source = String(html || '');
  const match = source.match(/var ytInitialData = (.*?);<\/script>/s)
    || source.match(/ytInitialData"\]\s*=\s*(\{.*?\});/s)
    || source.match(/var ytInitialData = (\{.*\});/s);

  if (!match || !match[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    return null;
  }
}

async function youtubeUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const cleanUsername = String(username).replace(/^@/, '').trim();
  const response = await getText(`https://www.youtube.com/@${encodeURIComponent(cleanUsername)}`, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0'
    }
  }, 15000);

  if (response.status === 404) {
    const error = new Error('channel youtube tidak ditemukan');
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`upstream ${response.status}`);
    error.status = 502;
    throw error;
  }

  const $ = cheerio.load(response.text);
  const initialData = extractYoutubeInitialData(response.text);
  const metadata = initialData?.metadata?.channelMetadataRenderer || {};
  const pageHeader = initialData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel || {};
  const metadataRows = pageHeader?.metadata?.contentMetadataViewModel?.metadataRows || [];
  const subscriberText = metadataRows?.[1]?.metadataParts?.find((part) => /subscribers?/i.test(part?.text?.content || ''))?.text?.content || null;
  const videoText = metadataRows?.[1]?.metadataParts?.find((part) => /videos?/i.test(part?.text?.content || ''))?.text?.content || null;

  const videoItems = [];
  const tabs = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  for (const tab of tabs) {
    const shelfSections = tab?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    for (const section of shelfSections) {
      const contents = section?.itemSectionRenderer?.contents || [];
      for (const content of contents) {
        const items = content?.shelfRenderer?.content?.horizontalListRenderer?.items || [];
        for (const item of items) {
          const video = item?.gridVideoRenderer;
          if (!video) {
            continue;
          }

          videoItems.push({
            id: video.videoId,
            title: video.title?.simpleText || null,
            thumbnail: video.thumbnail?.thumbnails?.[0]?.url || null,
            published_at: video.publishedTimeText?.simpleText || null,
            views: video.viewCountText?.simpleText || null,
            duration: video.thumbnailOverlays?.find((overlay) => overlay.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || null,
            url: `https://www.youtube.com/watch?v=${video.videoId}`
          });
        }
      }
    }
  }

  return buildStalkerProfile('youtube', {
    id: metadata.externalId || null,
    username: firstNonEmpty(
      pageHeader?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content,
      metadata?.externalId,
      `@${cleanUsername}`
    ),
    name: metadata.title || pageHeader?.title?.content || cleanUsername,
    bio: metadata.description || $('meta[name="description"]').attr('content') || null,
    avatar: metadata.avatar?.thumbnails?.[0]?.url || $('link[rel="image_src"]').attr('href') || null,
    url: metadata.channelUrl || `https://www.youtube.com/@${cleanUsername}`,
    stats: {
      subscribers: parseYoutubeCount(subscriberText),
      videos: parseYoutubeCount(videoText)
    },
    meta: {
      subscribers_label: subscriberText,
      videos_label: videoText,
      latest_videos: videoItems.slice(0, 5)
    }
  });
}

async function xUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const cleanUsername = String(username).replace(/^@/, '').trim();
  const response = await getText(`https://x.com/${encodeURIComponent(cleanUsername)}`, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0'
    }
  });

  if (response.status === 404) {
    const error = new Error('user x tidak ditemukan');
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`upstream ${response.status}`);
    error.status = 502;
    throw error;
  }

  const initialState = parseInitialState(response.text);
  const user = findXUserEntity(initialState, cleanUsername);

  if (!user) {
    const error = new Error('gagal membaca profil x');
    error.status = 502;
    throw error;
  }

  return normalizeXUser(user, cleanUsername);
}

async function instagramUserFromHtml(username) {
  const cleanUsername = String(username).replace(/^@/, '').trim();
  const response = await getText(`https://www.instagram.com/${encodeURIComponent(cleanUsername)}/`, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0'
    }
  });

  if (response.status === 404) {
    const error = new Error('user instagram tidak ditemukan');
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`upstream ${response.status}`);
    error.status = 502;
    throw error;
  }

  const $ = cheerio.load(response.text);
  const ldJsonText = $('script[type="application/ld+json"]').first().html();
  let ldJson = null;

  if (ldJsonText) {
    try {
      ldJson = JSON.parse(ldJsonText);
    } catch (error) {
      ldJson = null;
    }
  }

  const ogDescription = $('meta[property="og:description"]').attr('content');
  const metaDescription = $('meta[name="description"]').attr('content');
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const parsedMeta = parseInstagramMetaDescription(ogDescription || metaDescription, cleanUsername);

  const titleMatch = String(ogTitle || '').match(/^(.*?)\s+\(@([^)]+)\)/);

  return normalizeInstagramProfile({
    username: firstNonEmpty(ldJson?.alternateName?.replace(/^@/, ''), parsedMeta.username, titleMatch?.[2], cleanUsername),
    full_name: firstNonEmpty(ldJson?.name, parsedMeta.full_name, titleMatch?.[1]),
    biography: firstNonEmpty(parsedMeta.biography, ldJson?.description),
    image: firstNonEmpty(ldJson?.image, ogImage),
    followers: parsedMeta.followers,
    following: parsedMeta.following,
    posts: parsedMeta.posts
  }, cleanUsername);
}

async function instagramUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const cleanUsername = String(username).replace(/^@/, '').trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUsername)}`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)',
        'x-ig-app-id': '936619743392459'
      }
    });

    if (response.status === 404) {
      const error = new Error('user instagram tidak ditemukan');
      error.status = 404;
      throw error;
    }

    if (response.status === 429 || response.status === 401 || response.status === 403) {
      return await instagramUserFromHtml(cleanUsername);
    }

    if (!response.ok) {
      return await instagramUserFromHtml(cleanUsername);
    }

    const data = await response.json();
    const user = data?.data?.user;

    if (!user) {
      return await instagramUserFromHtml(cleanUsername);
    }

    return normalizeInstagramProfile(user, cleanUsername);
  } catch (error) {
    if (error.name === 'AbortError') {
      error.message = 'request instagram timeout';
      error.status = 504;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function tiktokUser(username) {
  if (!username) {
    const error = new Error('masukan parameter username');
    error.status = 406;
    throw error;
  }

  const cleanUsername = String(username).replace(/^@/, '').trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanUsername)}`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      const error = new Error(`upstream ${response.status}`);
      error.status = 502;
      throw error;
    }

    const data = await response.json();
    const user = data?.data?.user;

    if (data?.code !== 0 || !user) {
      const error = new Error('user tiktok tidak ditemukan atau profil private');
      error.status = 404;
      throw error;
    }

    const followers = user.fans ?? user.followerCount ?? 0;
    const following = user.following ?? user.followingCount ?? 0;
    const likes = user.heart ?? user.heartCount ?? user.digg_count ?? 0;
    const videos = user.video ?? user.videoCount ?? 0;
    const friends = user.friend ?? user.friendCount ?? 0;

    return buildStalkerProfile('tiktok', {
      id: user.id,
      username: user.uniqueId || cleanUsername,
      name: user.nickname,
      bio: user.signature,
      avatar: user.avatarLarger || user.avatarThumb || user.avatar,
      url: `https://www.tiktok.com/@${user.uniqueId || cleanUsername}`,
      verified: Boolean(user.verified),
      private: Boolean(user.privateAccount),
      stats: {
        followers,
        following,
        likes,
        videos,
        friends
      },
      meta: {
        region: user.region || user.country || null,
        language: user.language || null,
        open_favorite: Boolean(user.openFavorite),
        duet_setting: user.duetSetting || null,
        stitch_setting: user.stitchSetting || null,
        comment_setting: user.commentSetting || null
      }
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      error.message = 'request tiktok timeout';
      error.status = 504;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  githubUser,
  instagramUser,
  npmPackage,
  pinterestUser,
  robloxUser,
  tiktokUser,
  threadsUser,
  xUser,
  youtubeUser,
  wikipedia
};
