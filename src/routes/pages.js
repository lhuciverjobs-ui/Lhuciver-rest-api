const express = require('express');
const path = require('path');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

router.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
});

router.get('/admin/login', (req, res) => {
  res.redirect('/admin');
});

router.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'account.html'));
});

router.get('/login', (req, res) => {
  res.redirect('/auth');
});

router.get('/docs', (req, res) => {
  res.redirect('/#docs');
});

module.exports = router;
