const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const storageDir = path.join(__dirname, '..', '..', 'tmp');
const storageFile = path.join(storageDir, 'admin-state.json');
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;
const verificationCodeTtlMs = 10 * 60 * 1000;
const insecureAdminPasswordValues = new Set(['', 'admin', 'admin123', 'admin12345', 'password', '12345678']);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, Math.floor(number));
}

function defaultState() {
  return {
    settings: {
      app_name_override: '',
      app_creator_override: '',
      public_notice: '',
      maintenance_mode: false,
      default_daily_credit: 50
    },
    users: [],
    sessions: []
  };
}

function ensureStorageFile() {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  if (!fs.existsSync(storageFile)) {
    fs.writeFileSync(storageFile, JSON.stringify(defaultState(), null, 2));
  }
}

function loadState() {
  ensureStorageFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    return {
      ...defaultState(),
      ...parsed,
      settings: {
        ...defaultState().settings,
        ...(parsed.settings || {})
      },
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch (error) {
    const state = defaultState();
    fs.writeFileSync(storageFile, JSON.stringify(state, null, 2));
    return state;
  }
}

function saveState(state) {
  ensureStorageFile();
  fs.writeFileSync(storageFile, JSON.stringify(state, null, 2));
}

function withState(mutator) {
  const state = loadState();
  const result = mutator(state);
  saveState(state);
  return result;
}

function sanitizeUsername(username) {
  return String(username || '').trim().replace(/^@/, '').toLowerCase();
}

function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateUsername(username) {
  if (!/^[a-z0-9_.-]{3,32}$/i.test(username)) {
    const error = new Error('username harus 3-32 karakter dan hanya boleh huruf, angka, titik, underscore, atau strip');
    error.status = 406;
    throw error;
  }
}

function validateEmail(email) {
  const value = sanitizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    const error = new Error('email tidak valid');
    error.status = 406;
    throw error;
  }

  if (!/@gmail\.com$/i.test(value)) {
    const error = new Error('email harus memakai gmail.com');
    error.status = 406;
    throw error;
  }
}

function validatePassword(password) {
  const value = String(password || '');

  if (value.length < 8) {
    const error = new Error('password minimal 8 karakter');
    error.status = 406;
    throw error;
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    const error = new Error('password harus mengandung huruf kecil, huruf besar, dan angka');
    error.status = 406;
    throw error;
  }
}

function newApiKey() {
  return `lhv_${crypto.randomBytes(20).toString('hex')}`;
}

function sessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function hashValue(value, salt) {
  return crypto.scryptSync(String(value || ''), salt, 64).toString('hex');
}

function makeSecret(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    salt,
    hash: hashValue(password, salt)
  };
}

function compareSecret(value, salt, hash) {
  if (!salt || !hash) {
    return false;
  }

  const computed = hashValue(value, salt);
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
}

function newVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function resetUserCreditIfNeeded(user) {
  const key = todayKey();
  const limit = normalizeInteger(user.daily_credit_limit, 50);
  let changed = false;

  if (user.daily_credit_limit !== limit) {
    user.daily_credit_limit = limit;
    changed = true;
  }

  if (user.last_credit_reset_on !== key) {
    user.last_credit_reset_on = key;
    user.credit_remaining = limit;
    changed = true;
  } else if (!Number.isFinite(Number(user.credit_remaining))) {
    user.credit_remaining = limit;
    changed = true;
  }

  user.credit_remaining = normalizeInteger(user.credit_remaining, limit);
  return changed;
}

function normalizeUser(user) {
  resetUserCreditIfNeeded(user);

  return {
    id: user.id,
    username: sanitizeUsername(user.username),
    email: user.email ? sanitizeEmail(user.email) : null,
    email_verified: Boolean(user.email_verified),
    display_name: String(user.display_name || '').trim() || sanitizeUsername(user.username),
    api_key: user.api_key,
    daily_credit_limit: normalizeInteger(user.daily_credit_limit, 50),
    credit_remaining: normalizeInteger(user.credit_remaining, normalizeInteger(user.daily_credit_limit, 50)),
    active: user.active !== false,
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
    last_credit_reset_on: user.last_credit_reset_on || todayKey(),
    verification_code_expires_at: user.verification_code_expires_at || null
  };
}

function sanitizeSettings(settings) {
  return {
    app_name_override: String(settings.app_name_override || '').trim(),
    app_creator_override: String(settings.app_creator_override || '').trim(),
    public_notice: String(settings.public_notice || '').trim(),
    maintenance_mode: Boolean(settings.maintenance_mode),
    default_daily_credit: normalizeInteger(settings.default_daily_credit, 50)
  };
}

function getAdminCredentials() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '');

  return {
    username,
    password,
    configured: Boolean(username) && Boolean(password) && !insecureAdminPasswordValues.has(password.toLowerCase())
  };
}

function hasConfiguredAdminCredentials() {
  return getAdminCredentials().configured;
}

function verifyAdminCredentials(username, password) {
  const admin = getAdminCredentials();
  if (!admin.configured) {
    return false;
  }
  return String(username || '').trim() === admin.username && String(password || '') === admin.password;
}

function setSettings(payload) {
  return withState((state) => {
    state.settings = sanitizeSettings({
      ...state.settings,
      ...(payload || {})
    });

    return state.settings;
  });
}

function getSettings() {
  const state = loadState();
  const changedUsers = state.users.some((user) => resetUserCreditIfNeeded(user));
  state.settings = sanitizeSettings(state.settings);

  if (changedUsers) {
    saveState(state);
  }

  return state.settings;
}

function ensureUniquePublicIdentity(state, username, email, excludeUserId = null) {
  const cleanUsername = sanitizeUsername(username);
  const cleanEmail = sanitizeEmail(email);

  if (state.users.some((user) => user.id !== excludeUserId && sanitizeUsername(user.username) === cleanUsername)) {
    const error = new Error('username sudah dipakai');
    error.status = 409;
    throw error;
  }

  if (cleanEmail && state.users.some((user) => user.id !== excludeUserId && sanitizeEmail(user.email) === cleanEmail)) {
    const error = new Error('email sudah dipakai');
    error.status = 409;
    throw error;
  }
}

function listUsers() {
  const state = loadState();
  let changed = false;

  const users = state.users.map((user) => {
    changed = resetUserCreditIfNeeded(user) || changed;
    return normalizeUser(user);
  });

  if (changed) {
    saveState(state);
  }

  return users.sort((a, b) => a.username.localeCompare(b.username));
}

function createUser(payload) {
  return withState((state) => {
    const username = sanitizeUsername(payload.username);
    validateUsername(username);
    const email = sanitizeEmail(payload.email);
    const passwordValue = String(payload.password || '');
    validateEmail(email);
    validatePassword(passwordValue);
    ensureUniquePublicIdentity(state, username, email);

    const settings = sanitizeSettings(state.settings);
    const now = new Date().toISOString();
    const dailyCredit = normalizeInteger(payload.daily_credit_limit, settings.default_daily_credit);

    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      email_verified: payload.email_verified !== undefined ? Boolean(payload.email_verified) : true,
      display_name: payload.display_name,
      api_key: newApiKey(),
      daily_credit_limit: dailyCredit,
      credit_remaining: dailyCredit,
      active: payload.active !== false,
      created_at: now,
      updated_at: now,
      last_credit_reset_on: todayKey()
    };

    const password = makeSecret(passwordValue);
    user.password_hash = password.hash;
    user.password_salt = password.salt;

    state.users.push(user);
    return normalizeUser(user);
  });
}

function assignVerificationCode(user) {
  const code = newVerificationCode();
  const secret = makeSecret(code);
  user.verification_code_hash = secret.hash;
  user.verification_code_salt = secret.salt;
  user.verification_code_expires_at = new Date(Date.now() + verificationCodeTtlMs).toISOString();
  user.updated_at = new Date().toISOString();
  return code;
}

function createPublicUser(payload) {
  return withState((state) => {
    const username = sanitizeUsername(payload.username);
    const email = sanitizeEmail(payload.email);
    validateUsername(username);
    validateEmail(email);
    validatePassword(payload.password);
    ensureUniquePublicIdentity(state, username, email);

    const settings = sanitizeSettings(state.settings);
    const now = new Date().toISOString();
    const dailyCredit = normalizeInteger(undefined, settings.default_daily_credit);
    const password = makeSecret(payload.password);

    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      email_verified: true,
      display_name: payload.display_name || username,
      api_key: newApiKey(),
      password_hash: password.hash,
      password_salt: password.salt,
      verification_code_hash: null,
      verification_code_salt: null,
      verification_code_expires_at: null,
      daily_credit_limit: dailyCredit,
      credit_remaining: dailyCredit,
      active: true,
      created_at: now,
      updated_at: now,
      last_credit_reset_on: todayKey()
    };

    state.users.push(user);
    return {
      user: normalizeUser(user)
    };
  });
}

function findUser(state, userId) {
  const user = state.users.find((item) => item.id === userId);

  if (!user) {
    const error = new Error('user tidak ditemukan');
    error.status = 404;
    throw error;
  }

  return user;
}

function updateUser(userId, payload) {
  return withState((state) => {
    const user = findUser(state, userId);

    if (payload.username !== undefined) {
      const nextUsername = sanitizeUsername(payload.username);
      validateUsername(nextUsername);
      ensureUniquePublicIdentity(state, nextUsername, payload.email !== undefined ? payload.email : user.email, userId);
      user.username = nextUsername;
    }

    if (payload.email !== undefined) {
      const nextEmail = sanitizeEmail(payload.email);
      validateEmail(nextEmail);
      ensureUniquePublicIdentity(state, payload.username !== undefined ? payload.username : user.username, nextEmail, userId);
      user.email = nextEmail;
    }

    if (payload.display_name !== undefined) {
      user.display_name = String(payload.display_name || '').trim();
    }

    if (payload.daily_credit_limit !== undefined) {
      user.daily_credit_limit = normalizeInteger(payload.daily_credit_limit, user.daily_credit_limit);
      user.credit_remaining = Math.min(
        normalizeInteger(user.credit_remaining, user.daily_credit_limit),
        user.daily_credit_limit
      );
    }

    if (payload.credit_remaining !== undefined) {
      user.credit_remaining = Math.min(
        normalizeInteger(payload.credit_remaining, user.daily_credit_limit),
        normalizeInteger(user.daily_credit_limit, 50)
      );
      user.last_credit_reset_on = todayKey();
    }

    if (payload.active !== undefined) {
      user.active = Boolean(payload.active);
    }

    if (payload.email_verified !== undefined) {
      user.email_verified = Boolean(payload.email_verified);
    }

    user.updated_at = new Date().toISOString();
    return normalizeUser(user);
  });
}

function regenerateUserApiKey(userId) {
  return withState((state) => {
    const user = findUser(state, userId);
    user.api_key = newApiKey();
    user.updated_at = new Date().toISOString();
    return normalizeUser(user);
  });
}

function resetUserCredit(userId) {
  return withState((state) => {
    const user = findUser(state, userId);
    user.credit_remaining = normalizeInteger(user.daily_credit_limit, 50);
    user.last_credit_reset_on = todayKey();
    user.updated_at = new Date().toISOString();
    return normalizeUser(user);
  });
}

function deleteUser(userId) {
  return withState((state) => {
    const index = state.users.findIndex((item) => item.id === userId);

    if (index < 0) {
      const error = new Error('user tidak ditemukan');
      error.status = 404;
      throw error;
    }

    const [deleted] = state.users.splice(index, 1);
    return normalizeUser(deleted);
  });
}

function createSession(username) {
  return withState((state) => {
    const token = sessionToken();
    const tokenHash = hashSessionToken(token);
    const now = Date.now();
    const expiresAt = new Date(now + sessionMaxAgeSeconds * 1000).toISOString();

    state.sessions = state.sessions.filter((session) => new Date(session.expires_at).getTime() > now);
    state.sessions.push({
      token_hash: tokenHash,
      username: String(username || '').trim(),
      created_at: new Date(now).toISOString(),
      expires_at: expiresAt
    });

    return {
      token,
      expires_at: expiresAt,
      username: String(username || '').trim()
    };
  });
}

function getSession(token) {
  if (!token) {
    return null;
  }

  const state = loadState();
  const now = Date.now();
  const tokenHash = hashSessionToken(token);
  const validSessions = state.sessions.filter((session) => new Date(session.expires_at).getTime() > now);
  const session = validSessions.find((item) => item.token_hash === tokenHash) || null;

  if (validSessions.length !== state.sessions.length) {
    state.sessions = validSessions;
    saveState(state);
  }

  return session;
}

function destroySession(token) {
  if (!token) {
    return false;
  }

  return withState((state) => {
    const tokenHash = hashSessionToken(token);
    const before = state.sessions.length;
    state.sessions = state.sessions.filter((session) => session.token_hash !== tokenHash);
    return before !== state.sessions.length;
  });
}

function getOverview() {
  const settings = getSettings();
  const users = listUsers();

  return {
    total_users: users.length,
    active_users: users.filter((user) => user.active).length,
    inactive_users: users.filter((user) => !user.active).length,
    total_credit_remaining: users.reduce((sum, user) => sum + normalizeInteger(user.credit_remaining, 0), 0),
    total_daily_credit_limit: users.reduce((sum, user) => sum + normalizeInteger(user.daily_credit_limit, 0), 0),
    settings
  };
}

function resolveApiKey(rawValue) {
  return String(rawValue || '').trim();
}

function findUserByApiKey(apiKey) {
  const key = resolveApiKey(apiKey);

  if (!key) {
    const error = new Error('api key wajib diisi');
    error.status = 401;
    throw error;
  }

  const state = loadState();
  const user = state.users.find((item) => resolveApiKey(item.api_key) === key);

  if (!user) {
    const error = new Error('api key tidak valid');
    error.status = 401;
    throw error;
  }

  if (resetUserCreditIfNeeded(user)) {
    saveState(state);
  }

  if (user.active === false) {
    const error = new Error('user sedang nonaktif');
    error.status = 403;
    throw error;
  }

  if (user.email && !user.email_verified) {
    const error = new Error('email user belum diverifikasi');
    error.status = 403;
    throw error;
  }

  return normalizeUser(user);
}

function consumeCredit(apiKey, amount = 1) {
  return withState((state) => {
    const key = resolveApiKey(apiKey);
    const user = state.users.find((item) => resolveApiKey(item.api_key) === key);

    if (!user) {
      const error = new Error('api key tidak valid');
      error.status = 401;
      throw error;
    }

    resetUserCreditIfNeeded(user);

    if (user.active === false) {
      const error = new Error('user sedang nonaktif');
      error.status = 403;
      throw error;
    }

    if (user.email && !user.email_verified) {
      const error = new Error('email user belum diverifikasi');
      error.status = 403;
      throw error;
    }

    const cost = normalizeInteger(amount, 1) || 1;

    if (normalizeInteger(user.credit_remaining, 0) < cost) {
      const error = new Error('credit harian habis');
      error.status = 402;
      throw error;
    }

    user.credit_remaining = normalizeInteger(user.credit_remaining, 0) - cost;
    user.updated_at = new Date().toISOString();

    return normalizeUser(user);
  });
}

function getPublicUserByApiKey(apiKey) {
  const user = findUserByApiKey(apiKey);

  return {
    id: user.id,
    username: user.username,
    email: user.email || null,
    email_verified: Boolean(user.email_verified),
    display_name: user.display_name,
    api_key: user.api_key,
    daily_credit_limit: user.daily_credit_limit,
    credit_remaining: user.credit_remaining,
    active: user.active,
    last_credit_reset_on: user.last_credit_reset_on,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

function verifyUserCredentials(login, password) {
  const state = loadState();
  const key = String(login || '').trim().toLowerCase();
  const user = state.users.find((item) => sanitizeUsername(item.username) === key || sanitizeEmail(item.email) === key);

  if (!user || !compareSecret(password, user.password_salt, user.password_hash)) {
    const error = new Error('email/username atau password salah');
    error.status = 401;
    throw error;
  }

  if (!user.email_verified) {
    const error = new Error('email belum diverifikasi');
    error.status = 403;
    throw error;
  }

  if (user.active === false) {
    const error = new Error('user sedang nonaktif');
    error.status = 403;
    throw error;
  }

  if (resetUserCreditIfNeeded(user)) {
    saveState(state);
  }

  return getPublicUserByApiKey(user.api_key);
}

function resendVerificationCode(usernameOrEmail) {
  return withState((state) => {
    const key = String(usernameOrEmail || '').trim().toLowerCase();
    const user = state.users.find((item) => sanitizeUsername(item.username) === key || sanitizeEmail(item.email) === key);

    if (!user) {
      const error = new Error('user tidak ditemukan');
      error.status = 404;
      throw error;
    }

    if (user.email_verified) {
      const error = new Error('email sudah diverifikasi');
      error.status = 409;
      throw error;
    }

    const code = assignVerificationCode(user);
    return {
      user: normalizeUser(user),
      verification_code: code
    };
  });
}

function verifyEmailCode(payload) {
  return withState((state) => {
    const key = String(payload.username_or_email || payload.username || payload.email || '').trim().toLowerCase();
    const code = String(payload.code || '').trim();
    const user = state.users.find((item) => sanitizeUsername(item.username) === key || sanitizeEmail(item.email) === key);

    if (!user) {
      const error = new Error('user tidak ditemukan');
      error.status = 404;
      throw error;
    }

    if (!code) {
      const error = new Error('kode verifikasi wajib diisi');
      error.status = 406;
      throw error;
    }

    if (!user.verification_code_hash || !user.verification_code_salt || !user.verification_code_expires_at) {
      const error = new Error('kode verifikasi tidak tersedia');
      error.status = 400;
      throw error;
    }

    if (new Date(user.verification_code_expires_at).getTime() < Date.now()) {
      const error = new Error('kode verifikasi sudah kedaluwarsa');
      error.status = 410;
      throw error;
    }

    if (!compareSecret(code, user.verification_code_salt, user.verification_code_hash)) {
      const error = new Error('kode verifikasi salah');
      error.status = 401;
      throw error;
    }

    user.email_verified = true;
    user.verification_code_hash = null;
    user.verification_code_salt = null;
    user.verification_code_expires_at = null;
    user.updated_at = new Date().toISOString();

    return getPublicUserByApiKey(user.api_key);
  });
}

module.exports = {
  consumeCredit,
  createSession,
  createPublicUser,
  createUser,
  deleteUser,
  destroySession,
  findUserByApiKey,
  getPublicUserByApiKey,
  getOverview,
  getSession,
  getSettings,
  listUsers,
  regenerateUserApiKey,
  resendVerificationCode,
  resetUserCredit,
  sanitizeSettings,
  sessionMaxAgeSeconds,
  setSettings,
  updateUser,
  hasConfiguredAdminCredentials,
  verifyEmailCode,
  verifyUserCredentials,
  verifyAdminCredentials
};
