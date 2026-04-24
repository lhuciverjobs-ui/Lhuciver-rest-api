const express = require('express');

const adminStore = require('../services/admin-store');
const { createRateLimiter } = require('../services/security');
const { fail, ok } = require('../utils/respond');

const router = express.Router();
const sessionCookieName = 'lhuciver_admin_session';
const adminLoginLimiter = createRateLimiter({
  keyPrefix: 'admin-login',
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: 'terlalu banyak percobaan login admin, coba lagi 15 menit lagi'
});

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((item) => item.trim().split('='))
      .filter(([key, value]) => key && value)
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${sessionCookieName}=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict`);
}

function writeSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${token}; Path=/; HttpOnly; Max-Age=${adminStore.sessionMaxAgeSeconds}; SameSite=Strict`
  );
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const session = adminStore.getSession(cookies[sessionCookieName]);

  if (!session) {
    res.status(401).json(fail('session admin tidak valid atau sudah habis', 401));
    return;
  }

  req.adminSession = session;
  next();
}

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.post('/login', adminLoginLimiter, asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!adminStore.hasConfiguredAdminCredentials()) {
    res.status(503).json(fail('admin belum aman dikonfigurasi. Isi ADMIN_USERNAME dan ADMIN_PASSWORD yang kuat di .env', 503));
    return;
  }

  if (!adminStore.verifyAdminCredentials(username, password)) {
    res.status(401).json(fail('username atau password admin salah', 401));
    return;
  }

  const session = adminStore.createSession(username);
  writeSessionCookie(res, session.token);
  res.json(ok({
    username: session.username,
    expires_at: session.expires_at
  }, 'login admin berhasil'));
}));

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  adminStore.destroySession(cookies[sessionCookieName]);
  clearSessionCookie(res);
  res.json(ok({ logged_out: true }, 'logout admin berhasil'));
});

router.get('/session', requireAdmin, (req, res) => {
  res.json(ok({
    username: req.adminSession.username,
    expires_at: req.adminSession.expires_at
  }));
});

router.get('/overview', requireAdmin, (req, res) => {
  res.json(ok(adminStore.getOverview()));
});

router.get('/users', requireAdmin, (req, res) => {
  res.json(ok(adminStore.listUsers()));
});

router.post('/users', requireAdmin, (req, res) => {
  res.json(ok(adminStore.createUser(req.body), 'user berhasil dibuat'));
});

router.patch('/users/:id', requireAdmin, (req, res) => {
  res.json(ok(adminStore.updateUser(req.params.id, req.body), 'user berhasil diperbarui'));
});

router.post('/users/:id/reset-credit', requireAdmin, (req, res) => {
  res.json(ok(adminStore.resetUserCredit(req.params.id), 'credit user berhasil direset'));
});

router.post('/users/:id/regenerate-apikey', requireAdmin, (req, res) => {
  res.json(ok(adminStore.regenerateUserApiKey(req.params.id), 'api key user berhasil diganti'));
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  res.json(ok(adminStore.deleteUser(req.params.id), 'user berhasil dihapus'));
});

router.get('/settings', requireAdmin, (req, res) => {
  res.json(ok(adminStore.getSettings()));
});

router.put('/settings', requireAdmin, (req, res) => {
  res.json(ok(adminStore.setSettings(req.body), 'setting web berhasil diperbarui'));
});

router.use((err, req, res, next) => {
  res.status(err.status || 500).json(fail(err.message || 'Terjadi kesalahan admin', err.status || 500));
});

module.exports = router;
