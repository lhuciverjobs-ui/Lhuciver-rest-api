const crypto = require('crypto');

const startedAt = Date.now();
const users = new Set();
const history = [];
let totalApiRequests = 0;

function currentBucketTime() {
  const minute = 60 * 1000;
  return Math.floor(Date.now() / minute) * minute;
}

function ensureBucket() {
  const time = currentBucketTime();
  let bucket = history[history.length - 1];

  if (!bucket || bucket.time !== time) {
    bucket = {
      time,
      apiRequests: 0,
      users: users.size
    };
    history.push(bucket);
  }

  while (history.length > 30) {
    history.shift();
  }

  bucket.users = users.size;
  return bucket;
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((item) => item.trim().split('='))
      .filter(([key, value]) => key && value)
  );
}

function metricsMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let visitorId = cookies.lhuciver_uid;

  if (!visitorId) {
    visitorId = crypto.randomUUID();
    res.setHeader('Set-Cookie', `lhuciver_uid=${visitorId}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }

  users.add(visitorId);

  if (req.path.startsWith('/api') && req.path !== '/api/stats') {
    totalApiRequests += 1;
    ensureBucket().apiRequests += 1;
  } else {
    ensureBucket();
  }

  next();
}

function getStats() {
  ensureBucket();

  return {
    started_at: new Date(startedAt).toISOString(),
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    total_users: users.size,
    total_api_requests: totalApiRequests,
    history: history.map((item) => ({
      time: new Date(item.time).toISOString(),
      users: item.users,
      api_requests: item.apiRequests
    }))
  };
}

module.exports = {
  getStats,
  metricsMiddleware
};
