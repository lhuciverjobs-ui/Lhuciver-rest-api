const BMKG_QUAKE_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json';
const BMKG_WEATHER_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';
const weatherLocations = new Map([
  ['jawa-barat', { adm4: '32.73.01.1001', city: 'Bandung' }],
  ['jawa-barat:bandung', { adm4: '32.73.01.1001', city: 'Bandung' }],
  ['bandung', { adm4: '32.73.01.1001', city: 'Bandung' }],
  ['dki-jakarta', { adm4: '31.71.01.1001', city: 'Jakarta Pusat' }],
  ['jakarta', { adm4: '31.71.01.1001', city: 'Jakarta Pusat' }],
  ['jawa-timur', { adm4: '35.78.01.1001', city: 'Surabaya' }],
  ['surabaya', { adm4: '35.78.01.1001', city: 'Surabaya' }],
  ['jawa-tengah', { adm4: '33.74.01.1001', city: 'Semarang' }],
  ['semarang', { adm4: '33.74.01.1001', city: 'Semarang' }],
  ['bali', { adm4: '51.71.01.1001', city: 'Denpasar' }],
  ['denpasar', { adm4: '51.71.01.1001', city: 'Denpasar' }]
]);

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'lhuciver-restapis/1.0'
    }
  });

  if (!response.ok) {
    const error = new Error(response.status === 404 ? 'Not found' : 'BMKG request failed');
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }

  return response.json();
}

function refactorQuake(payload) {
  const quake = payload?.Infogempa?.gempa || {};

  return {
    date: quake.Tanggal,
    time: quake.Jam,
    datetime: quake.DateTime,
    coordinates: quake.Coordinates,
    latitude: quake.Lintang,
    longitude: quake.Bujur,
    magnitude: quake.Magnitude,
    depth: quake.Kedalaman,
    region: quake.Wilayah,
    potential: quake.Potensi,
    felt: quake.Dirasakan,
    shakemap: quake.Shakemap ? `https://data.bmkg.go.id/DataMKG/TEWS/${quake.Shakemap}` : null
  };
}

function flattenForecast(data) {
  return (data?.cuaca || [])
    .flat()
    .filter(Boolean)
    .map((item) => ({
      datetime: item.datetime,
      local_datetime: item.local_datetime,
      weather: item.weather_desc,
      weather_en: item.weather_desc_en,
      temperature_c: item.t,
      humidity: item.hu,
      wind_speed: item.ws,
      wind_direction: item.wd,
      visibility: item.vs_text,
      image: item.image
    }));
}

function refactorWeather(payload, requested) {
  const data = payload?.data?.[0] || {};

  return {
    requested,
    location: payload?.lokasi || data.lokasi || null,
    forecast: flattenForecast(data)
  };
}

function resolveWeatherLocation(province, city) {
  const provinceKey = normalizeKey(province);
  const cityKey = normalizeKey(city);
  const key = cityKey ? `${provinceKey}:${cityKey}` : provinceKey;
  const fallbackKey = cityKey || provinceKey;
  const location = weatherLocations.get(key) || weatherLocations.get(fallbackKey);

  if (!location) {
    const error = new Error('Not found. Contoh tersedia: jawa-barat, jawa-barat/bandung, dki-jakarta, jawa-timur, jawa-tengah, bali');
    error.status = 404;
    throw error;
  }

  return {
    ...location,
    province: provinceKey,
    city: cityKey || location.city
  };
}

async function latestQuake() {
  return refactorQuake(await fetchJson(BMKG_QUAKE_URL));
}

async function weatherByProvince(province) {
  if (!province) {
    const error = new Error('masukan parameter province');
    error.status = 406;
    throw error;
  }

  const location = resolveWeatherLocation(province);
  const payload = await fetchJson(`${BMKG_WEATHER_URL}?adm4=${location.adm4}`);

  return refactorWeather(payload, {
    province: location.province,
    representative_city: location.city,
    adm4: location.adm4
  });
}

async function weatherByCity(province, city) {
  if (!city) {
    const error = new Error('masukan parameter city');
    error.status = 406;
    throw error;
  }

  const location = resolveWeatherLocation(province, city);
  const payload = await fetchJson(`${BMKG_WEATHER_URL}?adm4=${location.adm4}`);

  return refactorWeather(payload, {
    province: location.province,
    city: location.city,
    adm4: location.adm4
  });
}

module.exports = {
  latestQuake,
  weatherByCity,
  weatherByProvince
};
