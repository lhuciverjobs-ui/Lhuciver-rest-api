const attempts = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs || 60_000);
  const limit = Number(options.limit || 5);
  const keyPrefix = String(options.keyPrefix || 'global');
  const message = String(options.message || 'terlalu banyak percobaan, coba lagi sebentar');

  return (req, res, next) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const current = attempts.get(key);

    if (!current || current.expiresAt <= now) {
      attempts.set(key, {
        count: 1,
        expiresAt: now + windowMs
      });
      next();
      return;
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        status: false,
        creator: process.env.APP_CREATOR || 'Lhuciver',
        code: 429,
        message
      });
      return;
    }

    current.count += 1;
    attempts.set(key, current);
    next();
  };
}

module.exports = {
  createRateLimiter,
  getClientIp
};
