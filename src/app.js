const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const adminApiRouter = require('./routes/admin-api');
const authApiRouter = require('./routes/auth-api');
const apiRouter = require('./routes/api');
const pagesRouter = require('./routes/pages');
const adminStore = require('./services/admin-store');
const { metricsMiddleware } = require('./services/metrics');
const { fail } = require('./utils/respond');

const app = express();

app.set('json spaces', 2);
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(metricsMiddleware);

app.use((req, res, next) => {
  const settings = adminStore.getSettings();
  const isAdminRoute = req.path.startsWith('/admin') || req.path.startsWith('/api/admin');
  const isPublicHealth = req.path === '/api/health';

  if (!settings.maintenance_mode || isAdminRoute || isPublicHealth) {
    next();
    return;
  }

  if (req.path.startsWith('/api')) {
    res.status(503).json(fail('maintenance mode aktif', 503));
    return;
  }

  res.status(503).sendFile(path.join(__dirname, '..', 'public', 'maintenance.html'));
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/', pagesRouter);
app.use('/api/auth', authApiRouter);
app.use('/api/admin', adminApiRouter);
app.use('/api', apiRouter);

function wantsHtml(req) {
  if (req.path.startsWith('/api') || req.path.startsWith('/outputs')) {
    return false;
  }

  const ext = path.extname(req.path || '');
  if (ext) {
    return false;
  }

  return true;
}

app.use((req, res) => {
  if (wantsHtml(req)) {
    res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
    return;
  }

  res.status(404).json(fail('Endpoint tidak ditemukan', 404, { path: req.originalUrl }));
});

app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (wantsHtml(req)) {
    const page = status === 403 ? '403.html' : status === 404 ? '404.html' : '500.html';
    res.status(status).sendFile(path.join(__dirname, '..', 'public', page));
    return;
  }

  res.status(status).json(fail(err.message || 'Terjadi kesalahan server', status));
});

module.exports = app;
