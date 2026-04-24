const express = require('express');

const adminStore = require('../services/admin-store');
const { createRateLimiter } = require('../services/security');
const { fail, ok } = require('../utils/respond');

const router = express.Router();
const signupLimiter = createRateLimiter({
  keyPrefix: 'auth-signup',
  windowMs: 10 * 60 * 1000,
  limit: 5,
  message: 'terlalu banyak percobaan signup dari device ini, coba lagi 10 menit lagi'
});
const loginLimiter = createRateLimiter({
  keyPrefix: 'auth-login',
  windowMs: 10 * 60 * 1000,
  limit: 10,
  message: 'terlalu banyak percobaan login dari device ini, coba lagi 10 menit lagi'
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.post('/signup', signupLimiter, asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.display_name || '').trim();

  const created = adminStore.createPublicUser({
    username,
    email,
    password,
    display_name: displayName
  });

  res.json(ok(created.user, 'signup berhasil'));
}));

router.post('/login', loginLimiter, asyncRoute(async (req, res) => {
  const username = String(req.body?.login || req.body?.username || req.body?.email || '').trim();
  const password = String(req.body?.password || '').trim();

  const user = adminStore.verifyUserCredentials(username, password);
  res.json(ok(user, 'login user berhasil'));
}));

router.use((err, req, res, next) => {
  res.status(err.status || 500).json(fail(err.message || 'Terjadi kesalahan auth', err.status || 500));
});

module.exports = router;
