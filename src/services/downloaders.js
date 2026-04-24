const btch = require('btch-downloader');

const downloaderDefinitions = [
  {
    id: 'instagram',
    fn: 'igdl',
    label: 'Instagram',
    input: 'url',
    example: 'https://www.instagram.com/p/ByxKbUSnubS/?utm_source=ig_web_copy_link',
    description: 'Download media Instagram public'
  },
  {
    id: 'tiktok',
    fn: 'ttdl',
    label: 'TikTok',
    input: 'url',
    example: 'https://www.tiktok.com/@omagadsus/video/7025456384175017243',
    description: 'Download video TikTok'
  },
  {
    id: 'facebook',
    fn: 'fbdown',
    label: 'Facebook',
    input: 'url',
    example: 'https://www.facebook.com/watch/?v=1393572814172251',
    description: 'Download video Facebook'
  },
  {
    id: 'twitter',
    fn: 'twitter',
    label: 'Twitter/X',
    input: 'url',
    example: 'https://twitter.com/gofoodindonesia/status/1229369819511709697',
    description: 'Download media Twitter atau X'
  },
  {
    id: 'youtube',
    fn: 'youtube',
    label: 'YouTube',
    input: 'url',
    example: 'https://youtube.com/watch?v=C8mJ8943X80',
    description: 'Download metadata/media YouTube'
  },
  {
    id: 'mediafire',
    fn: 'mediafire',
    label: 'MediaFire',
    input: 'url',
    example: 'https://www.mediafire.com/file/941xczxhn27qbby/GBWA_V12.25FF-By.SamMods-.apk/file',
    description: 'Ambil info file MediaFire'
  },
  {
    id: 'capcut',
    fn: 'capcut',
    label: 'CapCut',
    input: 'url',
    example: 'https://www.capcut.com/template-detail/7299286607478181121',
    description: 'Ambil template CapCut'
  },
  {
    id: 'gdrive',
    fn: 'gdrive',
    label: 'Google Drive',
    input: 'url',
    example: 'https://drive.google.com/file/d/1thDYWcS5p5FFhzTpTev7RUv0VFnNQyZ4/view?usp=drivesdk',
    description: 'Ambil info file Google Drive public'
  },
  {
    id: 'pinterest',
    fn: 'pinterest',
    label: 'Pinterest',
    input: 'url_or_query',
    example: 'https://pin.it/4CVodSq',
    description: 'Download pin atau search Pinterest'
  },
  {
    id: 'aio',
    fn: 'aio',
    label: 'AIO',
    input: 'url',
    example: 'https://vt.tiktok.com/ZSkGPK9Kj/',
    description: 'Downloader otomatis multi-platform'
  },
  {
    id: 'douyin',
    fn: 'douyin',
    label: 'Douyin',
    input: 'url',
    example: 'https://v.douyin.com/ikq8axJ/',
    description: 'Download video Douyin'
  },
  {
    id: 'xiaohongshu',
    fn: 'xiaohongshu',
    label: 'Xiaohongshu',
    input: 'url',
    example: 'http://xhslink.com/o/21DKXV988zp',
    description: 'Download media Xiaohongshu'
  },
  {
    id: 'snackvideo',
    fn: 'snackvideo',
    label: 'SnackVideo',
    input: 'url',
    example: 'https://s.snackvideo.com/p/j9jKr9dR',
    description: 'Download video SnackVideo'
  },
  {
    id: 'cocofun',
    fn: 'cocofun',
    label: 'Cocofun',
    input: 'url',
    example: 'https://www.icocofun.com/share/post/379250110809',
    description: 'Download media Cocofun'
  },
  {
    id: 'spotify',
    fn: 'spotify',
    label: 'Spotify',
    input: 'url',
    example: 'https://open.spotify.com/track/3zakx7RAwdkUQlOoQ7SJRt',
    description: 'Ambil info track Spotify'
  },
  {
    id: 'yts',
    fn: 'yts',
    label: 'YT Search',
    input: 'query',
    example: 'Somewhere Only We Know',
    description: 'Search video YouTube'
  },
  {
    id: 'soundcloud',
    fn: 'soundcloud',
    label: 'SoundCloud',
    input: 'url',
    example: 'https://soundcloud.com/issabella-marchelina/sisa-rasa-mahalini-official-audio',
    description: 'Download audio SoundCloud'
  },
  {
    id: 'threads',
    fn: 'threads',
    label: 'Threads',
    input: 'url',
    example: 'https://www.threads.net/@cindyyuvia/post/C_Nqx3khgkI/',
    description: 'Download media Threads'
  },
  {
    id: 'kuaishou',
    fn: 'kuaishou',
    label: 'Kuaishou',
    input: 'url',
    example: 'https://v.kuaishou.com/JT195ZHT',
    description: 'Download video Kuaishou'
  }
];

const aliases = new Map([
  ['ig', 'instagram'],
  ['igdl', 'instagram'],
  ['tt', 'tiktok'],
  ['ttdl', 'tiktok'],
  ['fb', 'facebook'],
  ['fbdown', 'facebook'],
  ['x', 'twitter'],
  ['yt', 'youtube'],
  ['gdrive', 'gdrive'],
  ['google-drive', 'gdrive'],
  ['ytsearch', 'yts'],
  ['youtube-search', 'yts'],
  ['xhs', 'xiaohongshu']
]);

const definitionMap = new Map(downloaderDefinitions.map((item) => [item.id, item]));

function normalizeProvider(provider) {
  const key = String(provider || '').toLowerCase().trim();
  return aliases.get(key) || key;
}

function listDownloaders() {
  return downloaderDefinitions.map(({ fn, ...item }) => ({
    ...item,
    endpoint: `/api/download/${item.id}`
  }));
}

function getDownloader(provider) {
  const id = normalizeProvider(provider);
  const definition = definitionMap.get(id);

  if (!definition || typeof btch[definition.fn] !== 'function') {
    const error = new Error('provider downloader tidak tersedia');
    error.status = 404;
    throw error;
  }

  return definition;
}

function getInput(definition, query) {
  const value = query.url || query.query || query.input || query.q;

  if (!value || String(value).trim() === '') {
    const error = new Error(definition.input === 'query' ? 'masukan parameter query' : 'masukan parameter url');
    error.status = 406;
    throw error;
  }

  return String(value).trim();
}

async function runDownloader(provider, query) {
  const definition = getDownloader(provider);
  const input = getInput(definition, query);
  const result = await btch[definition.fn](input);

  return {
    provider: definition.id,
    label: definition.label,
    input,
    data: result
  };
}

module.exports = {
  getDownloader,
  listDownloaders,
  runDownloader
};
