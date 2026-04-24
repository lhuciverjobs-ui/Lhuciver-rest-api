      const AUTH_KEY = 'lhuciver_workspace_access';
      const API_KEY_STORAGE = 'lhuciver_user_api_key';
      const USERNAME_STORAGE = 'lhuciver_user_username';
      const navItems = Array.from(document.querySelectorAll('.nav-item'));
      const authGate = document.getElementById('authGate');
      const authForm = document.getElementById('authForm');
      const loginModeButton = document.getElementById('loginModeButton');
      const signupModeButton = document.getElementById('signupModeButton');
      const authTitle = document.getElementById('authTitle');
      const authCopy = document.getElementById('authCopy');
      const fullNameInput = document.getElementById('fullNameInput');
      const emailInput = document.getElementById('emailInput');
      const passwordInput = document.getElementById('passwordInput');
      const togglePasswordButton = document.getElementById('togglePasswordButton');
      const loginExtras = document.getElementById('loginExtras');
      const rememberMeInput = document.getElementById('rememberMeInput');
      const forgotPasswordButton = document.getElementById('forgotPasswordButton');
      const authSubmitButton = document.getElementById('authSubmitButton');
      const authGhostButton = document.getElementById('authGhostButton');
      const authStatus = document.getElementById('authStatus');
      const mobileMenuToggle = document.getElementById('mobileMenuToggle');
      const sidebarCloseToggle = document.getElementById('sidebarCloseToggle');
      const sidebar = document.querySelector('.sidebar');
      const sidebarBackdrop = document.getElementById('sidebarBackdrop');
      const views = {
        dashboard: document.getElementById('dashboardView'),
        runtime: document.getElementById('runtimeView'),
        statistic: document.getElementById('statisticView'),
        uptime: document.getElementById('uptimeView'),
        downloader: document.getElementById('downloaderView'),
        tools: document.getElementById('toolsView'),
        news: document.getElementById('newsView'),
        anime: document.getElementById('animeView'),
        search: document.getElementById('searchView'),
        lookup: document.getElementById('lookupView')
      };
      const serverStatus = document.getElementById('serverStatus');
      const serverUptime = document.getElementById('serverUptime');
      const apiKeyInputMain = document.getElementById('apiKeyInputMain');
      const toggleApiKeyButton = document.getElementById('toggleApiKeyButton');
      const openAccountButton = document.getElementById('openAccountButton');
      const logoutUserButton = document.getElementById('logoutUserButton');
      const apiKeyMeta = document.getElementById('apiKeyMeta');
      const creditRemainingMain = document.getElementById('creditRemainingMain');
      const creditProgressMain = document.getElementById('creditProgressMain');
      const creditLimitMain = document.getElementById('creditLimitMain');
      const creditCaptionMain = document.getElementById('creditCaptionMain');
      const runtimeClock = document.getElementById('runtimeClock');
      const runtimeStatusText = document.getElementById('runtimeStatusText');
      const runtimeStartedAt = document.getElementById('runtimeStartedAt');
      const runtimeNodeVersion = document.getElementById('runtimeNodeVersion');
      const dashboardRuntime = document.getElementById('dashboardRuntime');
      const dashboardUsers = document.getElementById('dashboardUsers');
      const dashboardRequests = document.getElementById('dashboardRequests');
      const dashboardChartUpdated = document.getElementById('dashboardChartUpdated');
      const dashboardLineChart = document.getElementById('dashboardLineChart');
      const dashboardBarChart = document.getElementById('dashboardBarChart');
      const uptimeMetric = document.getElementById('uptimeMetric');
      const startedAtMetric = document.getElementById('startedAtMetric');
      const totalUsers = document.getElementById('totalUsers');
      const totalRequests = document.getElementById('totalRequests');
      const chartUpdated = document.getElementById('chartUpdated');
      const statsLineChart = document.getElementById('statsLineChart');
      const statsBarChart = document.getElementById('statsBarChart');
      const downloaderGrid = document.getElementById('downloaderGrid');
      const lookupGrid = document.getElementById('lookupGrid');
      const downloaderTester = document.getElementById('downloaderTester');
      const lookupTester = document.getElementById('lookupTester');
      const animeTester = document.getElementById('animeTester');
      const searchTester = document.getElementById('searchTester');
      const toolsTester = document.getElementById('toolsTester');
      const newsTester = document.getElementById('newsTester');
      const animeGrid = document.getElementById('animeGrid');
      const toolsGrid = document.getElementById('toolsGrid');
      const newsGrid = document.getElementById('newsGrid');
      const searchGrid = document.getElementById('searchGrid');
      const dashboardFeatures = document.getElementById('dashboardFeatures');
      const featureStatusList = document.getElementById('featureStatusList');
      const heroProfileName = document.getElementById('heroProfileName');
      const heroProfileRole = document.getElementById('heroProfileRole');
      const heroProfileInitials = document.getElementById('heroProfileInitials');
      let lastHistory = [];
      let authMode = 'login';

      let uptimeSeconds = 0;
      let uptimeSyncedAt = 0;

      function getApiKeyValue() {
        return (apiKeyInputMain.value || localStorage.getItem(API_KEY_STORAGE) || '').trim();
      }

      function getStoredUsername() {
        return (localStorage.getItem(USERNAME_STORAGE) || '').trim();
      }

      function clearUserBinding() {
        localStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(API_KEY_STORAGE);
        localStorage.removeItem(USERNAME_STORAGE);
        apiKeyInputMain.value = '';
        apiKeyMeta.textContent = 'Belum ada API key aktif.';
        creditRemainingMain.textContent = '-';
        creditLimitMain.textContent = '-';
        creditProgressMain.style.width = '0%';
        creditCaptionMain.textContent = '-';
        heroProfileName.textContent = '@guest';
        heroProfileRole.textContent = 'dashboard user';
        heroProfileInitials.textContent = 'G';
      }

      function updateHeroProfile(user = null) {
        const rawUsername = String(user?.username || getStoredUsername() || 'guest').trim().replace(/^@/, '');
        const username = rawUsername || 'guest';
        heroProfileName.textContent = `@${username}`;
        heroProfileRole.textContent = user?.email || username !== 'guest' ? 'authenticated user' : 'dashboard user';
        heroProfileInitials.textContent = username.slice(0, 2).toUpperCase();
      }

      function syncPasswordToggle() {
        const visible = passwordInput.type === 'text';
        togglePasswordButton.classList.toggle('visible', visible);
        togglePasswordButton.setAttribute('aria-label', visible ? 'Sembunyikan password' : 'Tampilkan password');
      }

      function syncApiKeyToggle() {
        const visible = apiKeyInputMain.type === 'text';
        toggleApiKeyButton.textContent = visible ? '◌' : '◉';
        toggleApiKeyButton.setAttribute('aria-label', visible ? 'Sembunyikan API key' : 'Tampilkan API key');
      }

      async function persistApiKeyFromInput() {
        const apiKey = apiKeyInputMain.value.trim();

        if (!apiKey) {
          localStorage.removeItem(API_KEY_STORAGE);
          apiKeyMeta.textContent = 'Belum ada API key aktif.';
          clearUserBinding();
          return;
        }

        localStorage.setItem(API_KEY_STORAGE, apiKey);
        await loadApiKeyMeta();
      }

      function getApiHeaders(baseHeaders = {}) {
        const apiKey = getApiKeyValue();
        return apiKey
          ? { ...baseHeaders, 'x-api-key': apiKey }
          : baseHeaders;
      }

      async function loadApiKeyMeta() {
        const apiKey = getApiKeyValue();

        if (!apiKey) {
          apiKeyMeta.textContent = 'Belum ada API key aktif.';
          updateHeroProfile();
          return;
        }

        try {
          const response = await fetch('/api/me', {
            headers: getApiHeaders({ accept: 'application/json' })
          });
          const payload = await response.json();

          if (!response.ok || !payload.status) {
            throw new Error(payload.message || 'api key tidak valid');
          }

          const user = payload.result;
          localStorage.setItem(USERNAME_STORAGE, user.username);
          apiKeyMeta.innerHTML = `<strong>@${user.username}</strong> | credit ${user.credit_remaining}/${user.daily_credit_limit} | reset ${user.last_credit_reset_on}`;
          creditRemainingMain.textContent = `${user.credit_remaining}`;
          creditLimitMain.textContent = `${user.daily_credit_limit}`;
          creditProgressMain.style.width = `${Math.max(0, Math.min(100, (user.credit_remaining / Math.max(1, user.daily_credit_limit)) * 100))}%`;
          creditCaptionMain.textContent = user.last_credit_reset_on;
          updateHeroProfile(user);
        } catch (error) {
          apiKeyMeta.textContent = `API key error: ${error.message}`;
          creditRemainingMain.textContent = '!';
          creditLimitMain.textContent = '-';
          creditProgressMain.style.width = '0%';
          creditCaptionMain.textContent = '-';
          updateHeroProfile();
        }
      }

      function formatDuration(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;

        return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, '0')).join(':');
      }

      function currentRuntime() {
        if (!uptimeSyncedAt) {
          return 0;
        }

        return uptimeSeconds + Math.floor((Date.now() - uptimeSyncedAt) / 1000);
      }

      function updateRuntimeClock() {
        const digital = formatDuration(currentRuntime());
        dashboardRuntime.textContent = digital;
        runtimeClock.textContent = digital;
        uptimeMetric.textContent = digital;
        serverUptime.textContent = `${digital} aktif`;
      }

      function setAuthMessage(message, tone = 'info') {
        authStatus.textContent = message || '';
        authStatus.style.color = tone === 'error' ? '#b91c1c' : tone === 'success' ? '#14532d' : 'var(--muted)';
      }

      function setAuthMode(mode) {
        authMode = mode === 'signup' ? 'signup' : 'login';
        const isSignup = authMode === 'signup';

        document.querySelector('.auth-toggle').classList.toggle('signup', isSignup);
        loginModeButton.classList.toggle('active', !isSignup);
        signupModeButton.classList.toggle('active', isSignup);
        loginModeButton.setAttribute('aria-pressed', String(!isSignup));
        signupModeButton.setAttribute('aria-pressed', String(isSignup));
        authTitle.textContent = isSignup ? 'CREATE USER' : 'LOGIN USER';
        authCopy.textContent = isSignup
          ? 'Daftar pakai gmail, username, dan password.'
          : 'Masuk pakai gmail atau username, lalu masukkan password.';
        fullNameInput.hidden = !isSignup;
        loginExtras.style.display = isSignup ? 'none' : 'flex';
        authSubmitButton.textContent = isSignup ? 'Create User' : 'Sign In';
        authGhostButton.textContent = isSignup ? 'Back to login' : 'Continue as guest';
        fullNameInput.placeholder = 'gmail';
        emailInput.placeholder = isSignup ? 'username' : 'gmail atau username';
        passwordInput.placeholder = 'password';
        fullNameInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        passwordInput.type = 'password';
        passwordInput.setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
        syncPasswordToggle();
        setAuthMessage('');
      }

      function persistAuth(remember) {
        if (remember) {
          localStorage.setItem(AUTH_KEY, '1');
          sessionStorage.removeItem(AUTH_KEY);
          return;
        }

        sessionStorage.setItem(AUTH_KEY, '1');
        localStorage.removeItem(AUTH_KEY);
      }

      function enterWorkspace(remember) {
        persistAuth(Boolean(remember));
        document.body.classList.add('is-authenticated');
        authGate.hidden = true;
        if (window.location.pathname !== '/') {
          window.history.replaceState({}, '', '/');
        }
        refreshStats();
        updateRuntimeClock();
      }

      function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          '\'': '&#39;'
        })[char]);
      }

      function formatChartTime(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
          return '-';
        }

        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      function normalizeChartHistory(history, limit) {
        return (Array.isArray(history) ? history : [])
          .slice(-limit)
          .map((item) => ({
            label: formatChartTime(item.time),
            requests: Number(item.api_requests) || 0,
            users: Number(item.users) || 0
          }));
      }

      function getChartConfig(kind = 'line') {
        const mobile = window.matchMedia('(max-width: 480px)').matches;
        const tablet = window.matchMedia('(max-width: 820px)').matches;

        if (kind === 'bar') {
          if (mobile) {
            return {
              width: 520,
              height: 190,
              padding: { top: 18, right: 10, bottom: 28, left: 24 },
              fontSize: 9,
              tickCount: 3
            };
          }

          if (tablet) {
            return {
              width: 720,
              height: 220,
              padding: { top: 20, right: 14, bottom: 34, left: 30 },
              fontSize: 10,
              tickCount: 4
            };
          }

          return {
            width: 1000,
            height: 300,
            padding: { top: 24, right: 22, bottom: 44, left: 44 },
            fontSize: 12,
            tickCount: 5
          };
        }

        if (mobile) {
          return {
            width: 520,
            height: 200,
            padding: { top: 18, right: 10, bottom: 30, left: 24 },
            fontSize: 9,
            tickCount: 3
          };
        }

        if (tablet) {
          return {
            width: 720,
            height: 240,
            padding: { top: 20, right: 14, bottom: 34, left: 32 },
            fontSize: 10,
            tickCount: 4
          };
        }

        return {
          width: 1000,
          height: 320,
          padding: { top: 26, right: 28, bottom: 42, left: 52 },
          fontSize: 12,
          tickCount: 5
        };
      }

      function renderLineChart(series, options = {}) {
        const data = series.length ? series : [{ label: '-', requests: 0, users: 0 }];
        const config = getChartConfig('line');
        const { width, height, padding, fontSize, tickCount } = config;
        const values = data.map((item) => Number(item.requests) || 0);
        const maxValue = Math.max(1, ...values);
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const step = plotWidth / Math.max(1, data.length - 1);

        const linePoints = data.map((item, index) => {
          const x = padding.left + index * step;
          const y = padding.top + plotHeight - ((Number(item.requests) || 0) / maxValue) * plotHeight;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ');

        const linePath = data.map((item, index) => {
          const x = padding.left + index * step;
          const y = padding.top + plotHeight - ((Number(item.requests) || 0) / maxValue) * plotHeight;
          return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(' ');

        const areaPath = [
          `M ${padding.left} ${padding.top + plotHeight}`,
          ...data.map((item, index) => {
            const x = padding.left + index * step;
            const y = padding.top + plotHeight - ((Number(item.requests) || 0) / maxValue) * plotHeight;
            return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
          }),
          `L ${padding.left + plotWidth} ${padding.top + plotHeight}`,
          'Z'
        ].join(' ');

        const tickValues = Array.from({ length: tickCount }, (_, index) => {
          const parts = Math.max(1, tickCount - 1);
          return Math.round((maxValue / parts) * (parts - index));
        });
        const labelIndexes = data.length <= 6
          ? data.map((_, index) => index)
          : data.map((_, index) => index).filter((index) => index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 4) === 0);

        return `
          <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(options.title || 'Chart')}">
            <defs>
              <linearGradient id="line-fill-${options.id || 'chart'}" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="${width}" height="${height}" fill="#0b0d10"></rect>
            ${Array.from({ length: tickCount }, (_, index) => {
              const parts = Math.max(1, tickCount - 1);
              const y = padding.top + (plotHeight / parts) * index;
              return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`;
            }).join('')}
            <path d="${areaPath}" fill="url(#line-fill-${options.id || 'chart'})"></path>
            <path d="${linePath}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
            ${data.map((item, index) => {
              const x = padding.left + index * step;
              const y = padding.top + plotHeight - ((Number(item.requests) || 0) / maxValue) * plotHeight;
              return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" fill="#ffffff"></circle>`;
            }).join('')}
            ${tickValues.map((tick) => {
              const y = padding.top + plotHeight - (tick / maxValue) * plotHeight;
              return `<text x="6" y="${y + 4}" fill="#c8ced6" font-size="${fontSize}" font-family="Cascadia Code, Consolas, monospace">${tick}</text>`;
            }).join('')}
            ${labelIndexes.map((index) => {
              const x = padding.left + index * step;
              return `<text x="${x}" y="${height - 8}" fill="#c8ced6" font-size="${fontSize}" text-anchor="middle" font-family="Cascadia Code, Consolas, monospace">${escapeHtml(data[index].label)}</text>`;
            }).join('')}
          </svg>
        `;
      }

      function renderBarChart(series, options = {}) {
        const data = series.length ? series : [{ label: '-', requests: 0, users: 0 }];
        const config = getChartConfig('bar');
        const { width, height, padding, fontSize, tickCount } = config;
        const values = data.map((item) => Number(item.users) || 0);
        const maxValue = Math.max(1, ...values);
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const step = plotWidth / data.length;
        const barWidth = Math.max(10, Math.min(42, step * 0.68));
        const tickValues = Array.from({ length: tickCount }, (_, index) => {
          const parts = Math.max(1, tickCount - 1);
          return Math.round((maxValue / parts) * (parts - index));
        });
        const labelIndexes = data.length <= 8
          ? data.map((_, index) => index)
          : data.map((_, index) => index).filter((index) => index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 5) === 0);

        return `
          <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(options.title || 'Chart')}">
            <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"></rect>
            ${Array.from({ length: tickCount }, (_, index) => {
              const parts = Math.max(1, tickCount - 1);
              const y = padding.top + (plotHeight / parts) * index;
              return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e1e4e8" stroke-width="1" />`;
            }).join('')}
            ${data.map((item, index) => {
              const value = Number(item.users) || 0;
              const x = padding.left + index * step + (step - barWidth) / 2;
              const barHeight = (value / maxValue) * plotHeight;
              const y = padding.top + plotHeight - barHeight;
              return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="10" fill="#0b0d10"></rect>`;
            }).join('')}
            ${tickValues.map((tick) => {
              const y = padding.top + plotHeight - (tick / maxValue) * plotHeight;
              return `<text x="6" y="${y + 4}" fill="#687381" font-size="${fontSize}" font-family="Cascadia Code, Consolas, monospace">${tick}</text>`;
            }).join('')}
            ${labelIndexes.map((index) => {
              const x = padding.left + index * step + step / 2;
              return `<text x="${x}" y="${height - 8}" fill="#687381" font-size="${fontSize}" text-anchor="middle" font-family="Cascadia Code, Consolas, monospace">${escapeHtml(data[index].label)}</text>`;
            }).join('')}
          </svg>
        `;
      }

      function renderCharts(history) {
        lastHistory = Array.isArray(history) ? history : [];
        const dashboardData = normalizeChartHistory(history, 12);
        const statsData = normalizeChartHistory(history, 30);

        dashboardLineChart.innerHTML = renderLineChart(dashboardData, {
          id: 'dashboard-line',
          title: 'Requests / Minute'
        });
        dashboardBarChart.innerHTML = renderBarChart(dashboardData, {
          id: 'dashboard-bar',
          title: 'Users / Minute'
        });
        statsLineChart.innerHTML = renderLineChart(statsData, {
          id: 'stats-line',
          title: 'Requests / Minute'
        });
        statsBarChart.innerHTML = renderBarChart(statsData, {
          id: 'stats-bar',
          title: 'Users / Minute'
        });
      }

      function bootAuthState() {
        const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
        const authRoute = currentPath === '/auth' || currentPath === '/login';
        const hasSession = localStorage.getItem(AUTH_KEY) === '1' || sessionStorage.getItem(AUTH_KEY) === '1';
        const hasApiKey = Boolean(localStorage.getItem(API_KEY_STORAGE));

        if (hasSession && hasApiKey) {
          if (authRoute) {
            window.location.replace('/');
            return;
          }

          document.body.classList.add('is-authenticated');
          authGate.hidden = true;
          refreshStats();
          updateRuntimeClock();
          return;
        }

        if (hasSession && !hasApiKey) {
          localStorage.removeItem(AUTH_KEY);
          sessionStorage.removeItem(AUTH_KEY);
        }

        if (!authRoute) {
          window.location.replace('/auth');
          return;
        }

        authGate.hidden = false;
        setAuthMode('login');
      }

      function buildUrl(path, params) {
        const url = new URL(path, window.location.origin);
        params.forEach((param) => {
          if (param.value !== '') {
            url.searchParams.set(param.name, param.value);
          }
        });
        const apiKey = getApiKeyValue();
        if (apiKey && !url.searchParams.has('api_key')) {
          url.searchParams.set('api_key', apiKey);
        }
        return url.toString();
      }

      function renderTester(target, items, initialIndex = 0) {
        target.innerHTML = `
          <section class="tester-grid">
            <form class="panel api-form">
              <div class="panel-head">
                <div>
                  <h2>Test API</h2>
                  <p class="muted">Pilih endpoint dan kirim request langsung dari dashboard.</p>
                </div>
              </div>
              <div class="panel-body">
                <label>
                  Endpoint
                  <select class="endpoint-select"></select>
                </label>
                <div class="endpoint-row">
                  <div class="method">GET</div>
                  <label>
                    Path
                    <input class="path-input" autocomplete="off">
                  </label>
                </div>
                <div class="param-grid"></div>
                <label>
                  Full URL
                  <textarea class="full-url-input" autocomplete="off"></textarea>
                </label>
                <div class="actions">
                  <button class="action send-button" type="submit">Send Request</button>
                  <button class="action secondary reset-button" type="button">Reset</button>
                  <button class="action secondary clear-button" type="button">Clear Response</button>
                </div>
              </div>
            </form>

            <section class="panel">
              <div class="panel-head">
                <div>
                  <h2>Response</h2>
                  <p class="muted">Output request terakhir.</p>
                </div>
                <span class="muted result-badge">Idle</span>
              </div>
              <div class="meta-grid">
                <div class="response-metric">
                  <span>Status</span>
                  <strong class="status-metric">-</strong>
                </div>
                <div class="response-metric">
                  <span>Time</span>
                  <strong class="time-metric">-</strong>
                </div>
                <div class="response-metric">
                  <span>Size</span>
                  <strong class="size-metric">-</strong>
                </div>
              </div>
              <div class="result-url-box empty">
                <span>Preview Image</span>
                <a class="result-url-link" href="#" target="_blank" rel="noreferrer noopener"></a>
              </div>
              <div class="upload-preview result-image-preview" style="margin: 0 18px 18px;">
                <span>Preview gambar akan muncul di sini kalau hasil endpoint punya image URL.</span>
              </div>
              <div class="request-url">Belum ada request.</div>
              <pre class="response-output">Pilih endpoint, lalu tekan Send Request.</pre>
            </section>
          </section>
        `;

        const form = target.querySelector('.api-form');
        const select = target.querySelector('.endpoint-select');
        const pathInput = target.querySelector('.path-input');
        const paramGrid = target.querySelector('.param-grid');
        const fullUrlInput = target.querySelector('.full-url-input');
        const sendButton = target.querySelector('.send-button');
        const resetButton = target.querySelector('.reset-button');
        const clearButton = target.querySelector('.clear-button');
        const resultBadge = target.querySelector('.result-badge');
        const statusMetric = target.querySelector('.status-metric');
        const timeMetric = target.querySelector('.time-metric');
        const sizeMetric = target.querySelector('.size-metric');
        const requestUrl = target.querySelector('.request-url');
        const responseOutput = target.querySelector('.response-output');
        const resultUrlBox = target.querySelector('.result-url-box');
        const resultUrlLink = target.querySelector('.result-url-link');
        const resultImagePreview = target.querySelector('.result-image-preview');

        items.forEach((item, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = item.name;
          select.appendChild(option);
        });

        function selectedItem() {
          return items[Number(select.value)] || items[0];
        }

        function getParams() {
          return Array.from(paramGrid.querySelectorAll('input')).map((input) => ({
            name: input.name,
            value: input.value
          }));
        }

        function updateUrl() {
          fullUrlInput.value = buildUrl(pathInput.value || '/', getParams());
        }

        function renderParams(item) {
          paramGrid.innerHTML = '';
          item.params.forEach((param) => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            label.textContent = param.name;
            input.name = param.name;
            input.value = param.value;
            input.addEventListener('input', updateUrl);
            label.appendChild(input);
            paramGrid.appendChild(label);
          });
        }

        function loadItem(index) {
          select.value = String(index);
          const item = selectedItem();
          pathInput.value = item.path;
          renderParams(item);
          updateUrl();
        }

        function setResponse(state, detail = {}) {
          resultBadge.textContent = state;
          statusMetric.textContent = detail.status || '-';
          timeMetric.textContent = detail.time || '-';
          sizeMetric.textContent = detail.size || '-';
          requestUrl.textContent = detail.url || 'Belum ada request.';
          if (detail.imageUrl) {
            resultUrlBox.classList.remove('empty');
            resultUrlLink.href = detail.imageUrl;
            resultUrlLink.textContent = detail.imageUrl;
            resultImagePreview.innerHTML = `<img src="${detail.imageUrl}" alt="Preview result image">`;
          } else {
            resultUrlBox.classList.add('empty');
            resultUrlLink.removeAttribute('href');
            resultUrlLink.textContent = '';
            resultImagePreview.innerHTML = '<span>Preview gambar akan muncul di sini kalau hasil endpoint punya image URL.</span>';
          }
        }

        async function sendRequest(event) {
          event.preventDefault();
          const url = fullUrlInput.value.trim();
          const started = performance.now();

          sendButton.disabled = true;
          sendButton.textContent = 'Sending...';
          setResponse('Loading', { url });
          responseOutput.textContent = 'Request sedang diproses...';

          try {
            const response = await fetch(url, { headers: getApiHeaders({ accept: 'application/json' }) });
            const text = await response.text();
            const duration = Math.round(performance.now() - started);

            try {
              const json = JSON.parse(text);
              responseOutput.textContent = JSON.stringify(json, null, 2);
              const imageUrl = json?.result?.best_match?.preview_url
                || json?.result?.best_match?.image_url
                || json?.result?.best_match?.image
                || json?.result?.best_match?.thumbnail
                || json?.result?.items?.[0]?.preview_url
                || json?.result?.items?.[0]?.image_url
                || json?.result?.items?.[0]?.image
                || json?.result?.items?.[0]?.thumbnail
                || null;
              setResponse(response.ok ? 'PASS' : 'ERROR', {
                status: response.status,
                time: `${duration}ms`,
                size: `${new Blob([text]).size} B`,
                url,
                imageUrl
              });
            } catch (error) {
              responseOutput.textContent = text;
              setResponse(response.ok ? 'PASS' : 'ERROR', {
                status: response.status,
                time: `${duration}ms`,
                size: `${new Blob([text]).size} B`,
                url
              });
            }
          } catch (error) {
            const duration = Math.round(performance.now() - started);
            setResponse('FAILED', {
              status: 'Network',
              time: `${duration}ms`,
              size: '-',
              url
            });
            responseOutput.textContent = JSON.stringify({ status: false, message: error.message }, null, 2);
          } finally {
            sendButton.disabled = false;
            sendButton.textContent = 'Send Request';
          }
        }

        select.addEventListener('change', () => loadItem(Number(select.value)));
        pathInput.addEventListener('input', updateUrl);
        form.addEventListener('submit', sendRequest);
        resetButton.addEventListener('click', () => loadItem(Number(select.value)));
        clearButton.addEventListener('click', () => {
          responseOutput.textContent = 'Response dibersihkan. Tekan Send Request untuk mencoba lagi.';
          setResponse('Idle');
        });

        loadItem(initialIndex);
        return { loadItem };
      }

      function renderFeatureCards(target, items, tester) {
        target.innerHTML = '';
        items.forEach((item, index) => {
          const card = document.createElement('article');
          card.className = 'feature-card';
          card.innerHTML = `
            <strong>${item.name}</strong>
            <p class="muted">${item.description}</p>
            <code>${item.endpoint}</code>
          `;
          card.addEventListener('click', () => tester.loadItem(index));
          target.appendChild(card);
        });
      }

      function renderFeatureStatus(items) {
        featureStatusList.innerHTML = '';

        items.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'status-row';
          row.innerHTML = `
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.summary)}</span>
            </div>
            <span class="status-pill">${escapeHtml(item.badge || 'ACTIVE')}</span>
          `;
          featureStatusList.appendChild(row);
        });
      }

      function renderToolsTester(target, items, initialIndex = 0) {
        target.innerHTML = `
          <section class="tester-grid">
            <form class="panel api-form">
              <div class="panel-head">
                <div>
                  <h2>Test API</h2>
                  <p class="muted">Semua tools dipanggil dari satu panel yang sama.</p>
                </div>
              </div>
              <div class="panel-body">
                <label>
                  Feature
                  <select class="endpoint-select"></select>
                </label>
                <div class="endpoint-row">
                  <div class="method method-badge">GET</div>
                  <label>
                    Path
                    <input class="path-input" autocomplete="off">
                  </label>
                </div>
                <div class="param-grid"></div>
                <label class="file-group">
                  <span class="field-label">File</span>
                  <input class="file-input" type="file">
                </label>
                <div class="upload-preview">
                  <span>Belum ada file dipilih.</span>
                </div>
                <label>
                  Full URL
                  <textarea class="full-url-input" readonly></textarea>
                </label>
                <div class="actions">
                  <button class="action send-button" type="submit">Send Request</button>
                  <button class="action secondary reset-button" type="button">Reset</button>
                  <button class="action secondary clear-button" type="button">Clear Response</button>
                </div>
              </div>
            </form>

            <section class="panel">
              <div class="panel-head">
                <div>
                  <h2>Response</h2>
                  <p class="muted">Output request terakhir.</p>
                </div>
                <span class="muted result-badge">Idle</span>
              </div>
              <div class="meta-grid">
                <div class="response-metric">
                  <span>Status</span>
                  <strong class="status-metric">-</strong>
                </div>
                <div class="response-metric">
                  <span>Time</span>
                  <strong class="time-metric">-</strong>
                </div>
                <div class="response-metric">
                  <span>Size</span>
                  <strong class="size-metric">-</strong>
                </div>
              </div>
              <div class="result-url-box empty">
                <span>URL hasil</span>
                <a class="result-url" href="#" target="_blank" rel="noreferrer">-</a>
              </div>
              <div class="request-url">Belum ada request.</div>
              <pre class="response-output">Pilih fitur, lalu tekan Send Request.</pre>
            </section>
          </section>
        `;

        const form = target.querySelector('.api-form');
        const select = target.querySelector('.endpoint-select');
        const methodBadge = target.querySelector('.method-badge');
        const pathInput = target.querySelector('.path-input');
        const paramGrid = target.querySelector('.param-grid');
        const fileGroup = target.querySelector('.file-group');
        const fileLabel = target.querySelector('.field-label');
        const fileInput = target.querySelector('.file-input');
        const uploadPreview = target.querySelector('.upload-preview');
        const fullUrlInput = target.querySelector('.full-url-input');
        const sendButton = target.querySelector('.send-button');
        const resetButton = target.querySelector('.reset-button');
        const clearButton = target.querySelector('.clear-button');
        const resultBadge = target.querySelector('.result-badge');
        const statusMetric = target.querySelector('.status-metric');
        const timeMetric = target.querySelector('.time-metric');
        const sizeMetric = target.querySelector('.size-metric');
        const requestUrl = target.querySelector('.request-url');
        const responseOutput = target.querySelector('.response-output');
        const resultUrlBox = target.querySelector('.result-url-box');
        const resultUrl = target.querySelector('.result-url');

        items.forEach((item, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = item.name;
          select.appendChild(option);
        });

        function selectedItem() {
          return items[Number(select.value)] || items[0];
        }

        function getParams() {
          return Array.from(paramGrid.querySelectorAll('input')).map((input) => ({
            name: input.name,
            value: input.value
          }));
        }

        function updateUrl() {
          const item = selectedItem();
          if (item.method === 'POST') {
            fullUrlInput.value = `${window.location.origin}${pathInput.value || '/'}`;
            return;
          }

          fullUrlInput.value = buildUrl(pathInput.value || '/', getParams());
        }

        function renderParams(item) {
          paramGrid.innerHTML = '';

          item.params.forEach((param) => {
            const label = document.createElement('label');
            const input = document.createElement('input');
            label.textContent = param.name;
            input.name = param.name;
            input.value = param.value;
            input.addEventListener('input', updateUrl);
            label.appendChild(input);
            paramGrid.appendChild(label);
          });
        }

        function renderFileInput(item) {
          fileInput.value = '';
          uploadPreview.innerHTML = '<span>Belum ada file dipilih.</span>';

          if (!item.file) {
            fileGroup.style.display = 'none';
            uploadPreview.style.display = 'none';
            return;
          }

          fileGroup.style.display = 'grid';
          uploadPreview.style.display = 'grid';
          fileInput.accept = item.file.accept || 'image/png,image/jpeg,image/jpg';
          fileLabel.textContent = item.file.label || 'File';
        }

        function loadItem(index) {
          select.value = String(index);
          const item = selectedItem();
          pathInput.value = item.path;
          methodBadge.textContent = item.method;
          renderParams(item);
          renderFileInput(item);
          updateUrl();
          setResponse('Idle', {});
          responseOutput.textContent = item.method === 'POST'
            ? 'Pilih file lalu tekan Send Request.'
            : 'Pilih input lalu tekan Send Request.';
        }

        function setResponse(state, detail = {}) {
          resultBadge.textContent = state;
          statusMetric.textContent = detail.status || '-';
          timeMetric.textContent = detail.time || '-';
          sizeMetric.textContent = detail.size || '-';
          requestUrl.textContent = detail.url || 'Belum ada request.';

          if (detail.resultUrl) {
            resultUrlBox.classList.remove('empty');
            resultUrl.href = detail.resultUrl;
            resultUrl.textContent = detail.resultUrl;
          } else {
            resultUrlBox.classList.add('empty');
            resultUrl.href = '#';
            resultUrl.textContent = '-';
          }
        }

        fileInput.addEventListener('change', () => {
          const file = fileInput.files[0];
          uploadPreview.innerHTML = '';

          if (!file) {
            uploadPreview.innerHTML = '<span>Belum ada file dipilih.</span>';
            return;
          }

          if (file.type.startsWith('image/')) {
            const image = document.createElement('img');
            image.src = URL.createObjectURL(file);
            image.alt = file.name;
            image.onload = () => URL.revokeObjectURL(image.src);
            uploadPreview.appendChild(image);
          }

          const label = document.createElement('span');
          label.textContent = `${file.name} - ${Math.round(file.size / 1024)} KB`;
          uploadPreview.appendChild(label);
        });

        async function sendRequest(event) {
          event.preventDefault();
          const item = selectedItem();
          const params = getParams();
          const url = item.method === 'POST'
            ? `${window.location.origin}${pathInput.value || '/'}`
            : buildUrl(pathInput.value || '/', params);
          const started = performance.now();

          sendButton.disabled = true;
          sendButton.textContent = 'Sending...';
          setResponse('Loading', { url });
          responseOutput.textContent = 'Request sedang diproses...';

          try {
            let response;

            if (item.method === 'POST') {
              const formData = new FormData();
              params.forEach((param) => {
                if (param.value !== '') {
                  formData.append(param.name, param.value);
                }
              });

              const file = fileInput.files[0];
              if (file) {
                formData.append('file', file);
              }

              response = await fetch(url, {
                method: 'POST',
                body: formData,
                headers: getApiHeaders({ accept: 'application/json' })
              });
            } else {
              response = await fetch(url, { headers: getApiHeaders({ accept: 'application/json' }) });
            }

            const text = await response.text();
            const duration = Math.round(performance.now() - started);

            try {
              const json = JSON.parse(text);
              responseOutput.textContent = JSON.stringify(json, null, 2);
              setResponse(response.ok ? 'PASS' : 'ERROR', {
                status: response.status,
                time: `${duration}ms`,
                size: `${new Blob([text]).size} B`,
                url,
                resultUrl: json?.result?.url || json?.result?.display_url
              });
            } catch (error) {
              responseOutput.textContent = text;
              setResponse(response.ok ? 'PASS' : 'ERROR', {
                status: response.status,
                time: `${duration}ms`,
                size: `${new Blob([text]).size} B`,
                url
              });
            }
          } catch (error) {
            const duration = Math.round(performance.now() - started);
            setResponse('FAILED', {
              status: 'Network',
              time: `${duration}ms`,
              size: '-',
              url
            });
            responseOutput.textContent = JSON.stringify({ status: false, message: error.message }, null, 2);
          } finally {
            sendButton.disabled = false;
            sendButton.textContent = 'Send Request';
          }
        }

        select.addEventListener('change', () => loadItem(Number(select.value)));
        pathInput.addEventListener('input', updateUrl);
        form.addEventListener('submit', sendRequest);
        resetButton.addEventListener('click', () => loadItem(Number(select.value)));
        clearButton.addEventListener('click', () => {
          responseOutput.textContent = 'Response dibersihkan. Tekan Send Request untuk mencoba lagi.';
          setResponse('Idle');
        });

        loadItem(initialIndex);
        return { loadItem };
      }

      async function refreshStats() {
        try {
          const [statsResponse, healthResponse] = await Promise.all([
            fetch('/api/stats', {
              headers: getApiHeaders({ accept: 'application/json' })
            }),
            fetch('/api/health', {
              headers: { accept: 'application/json' }
            })
          ]);
          const payload = await statsResponse.json();
          const healthPayload = await healthResponse.json().catch(() => ({}));

          if (!statsResponse.ok || !payload.status) {
            throw new Error(payload.message || 'Stats error');
          }

          const stats = payload.result;
          uptimeSeconds = stats.uptime_seconds;
          uptimeSyncedAt = Date.now();
          dashboardUsers.textContent = stats.total_users;
          dashboardRequests.textContent = stats.total_api_requests;
          totalUsers.textContent = stats.total_users;
          totalRequests.textContent = stats.total_api_requests;
          startedAtMetric.textContent = new Date(stats.started_at).toLocaleString();
          runtimeStartedAt.textContent = new Date(stats.started_at).toLocaleString();
          dashboardChartUpdated.textContent = new Date().toLocaleTimeString();
          chartUpdated.textContent = new Date().toLocaleTimeString();
          serverStatus.textContent = 'Online';
          serverStatus.classList.add('online');
          runtimeStatusText.textContent = 'ONLINE';
          runtimeNodeVersion.textContent = healthPayload?.result?.node || '-';
          updateRuntimeClock();
          renderCharts(stats.history);
        } catch (error) {
          serverStatus.textContent = 'Offline';
          serverStatus.classList.remove('online');
          serverUptime.textContent = error.message;
          runtimeStatusText.textContent = 'OFFLINE';
          runtimeStartedAt.textContent = '-';
          runtimeNodeVersion.textContent = '-';
        }
      }

      navItems.forEach((item) => {
        item.addEventListener('click', () => {
          navItems.forEach((nav) => nav.classList.remove('active'));
          item.classList.add('active');
          const view = item.dataset.view;
          Object.entries(views).forEach(([key, element]) => {
            element.classList.toggle('active', key === view);
          });

          if (window.matchMedia('(max-width: 980px)').matches) {
            toggleSidebar(false);
          }
        });
      });

      loginModeButton.addEventListener('click', () => setAuthMode('login'));
      signupModeButton.addEventListener('click', () => setAuthMode('signup'));
      togglePasswordButton.addEventListener('click', () => {
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        syncPasswordToggle();
      });
      toggleApiKeyButton.addEventListener('click', () => {
        apiKeyInputMain.type = apiKeyInputMain.type === 'password' ? 'text' : 'password';
        syncApiKeyToggle();
      });
      if (localStorage.getItem(API_KEY_STORAGE)) {
        apiKeyInputMain.value = localStorage.getItem(API_KEY_STORAGE);
      }
      syncPasswordToggle();
      syncApiKeyToggle();
      updateHeroProfile();
      apiKeyInputMain.addEventListener('change', persistApiKeyFromInput);
      apiKeyInputMain.addEventListener('blur', persistApiKeyFromInput);

      openAccountButton.addEventListener('click', () => {
        const apiKey = apiKeyInputMain.value.trim();
        if (apiKey) {
          localStorage.setItem(API_KEY_STORAGE, apiKey);
        }
        window.location.href = '/account';
      });

      logoutUserButton.addEventListener('click', () => {
        clearUserBinding();
        setAuthMessage('User logout berhasil. Device ini sekarang bisa login ke akun lain.', 'success');
        window.location.href = '/auth';
      });

      forgotPasswordButton.addEventListener('click', () => {
        setAuthMessage('Fitur reset password belum dihubungkan ke backend.', 'info');
      });
      authGhostButton.addEventListener('click', () => {
        if (authMode === 'signup') {
          setAuthMode('login');
          return;
        }

        enterWorkspace(false);
      });
      authForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const email = fullNameInput.value.trim();
        const loginValue = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const gmailPattern = /^[^\s@]+@gmail\.com$/i;
        const usernamePattern = /^[a-zA-Z0-9_.-]{3,32}$/;

        if (!loginValue) {
          setAuthMessage(authMode === 'signup' ? 'Username wajib diisi.' : 'Gmail atau username wajib diisi.', 'error');
          return;
        }

        const boundUsername = getStoredUsername();
        if (boundUsername && boundUsername !== loginValue.toLowerCase() && authMode !== 'signup') {
          setAuthMessage(`Device ini sedang terikat ke @${boundUsername}. Logout dulu kalau mau ganti akun.`, 'error');
          return;
        }

        if (authMode === 'signup') {
          if (!email) {
            setAuthMessage('Gmail wajib diisi.', 'error');
            return;
          }

          if (!gmailPattern.test(email)) {
            setAuthMessage('Email harus memakai gmail.com.', 'error');
            return;
          }

          if (!usernamePattern.test(loginValue)) {
            setAuthMessage('Username harus 3-32 karakter dan hanya boleh huruf, angka, titik, underscore, atau strip.', 'error');
            return;
          }

          if (!password) {
            setAuthMessage('Password wajib diisi.', 'error');
            return;
          }

          if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            setAuthMessage('Password minimal 8 karakter dan wajib ada huruf kecil, huruf besar, dan angka.', 'error');
            return;
          }
        } else if (!password) {
          setAuthMessage('Password wajib diisi.', 'error');
          return;
        }

        setAuthMessage(authMode === 'signup' ? 'Membuat user...' : 'Login user...', '');

        fetch(authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json'
          },
          body: JSON.stringify(authMode === 'signup'
            ? {
                email,
                username: loginValue,
                password
              }
            : {
                login: loginValue,
                password
              })
        })
          .then(async (response) => {
            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload.status) {
              throw new Error(payload.message || 'auth gagal');
            }

            const user = payload.result;

            if (user.api_key) {
              apiKeyInputMain.value = user.api_key;
              localStorage.setItem(API_KEY_STORAGE, user.api_key);
              localStorage.setItem(USERNAME_STORAGE, user.username);
              loadApiKeyMeta();
            }

            setAuthMessage(authMode === 'signup' ? 'User berhasil dibuat. Masuk ke workspace...' : 'Login user berhasil. Masuk ke workspace...', 'success');
            enterWorkspace(rememberMeInput.checked);
          })
          .catch((error) => {
            setAuthMessage(error.message, 'error');
          });
      });

      function toggleSidebar(forceOpen) {
        const shouldOpen = typeof forceOpen === 'boolean'
          ? forceOpen
          : !sidebar.classList.contains('is-open');

        sidebar.classList.toggle('is-open', shouldOpen);
        sidebarBackdrop.classList.toggle('is-open', shouldOpen);
        document.body.classList.toggle('sidebar-open', shouldOpen);
        mobileMenuToggle.textContent = shouldOpen ? '×' : '☰';
        mobileMenuToggle.setAttribute('aria-label', shouldOpen ? 'Close sidebar' : 'Toggle sidebar');
      }

      mobileMenuToggle.addEventListener('click', () => toggleSidebar());
      sidebarCloseToggle.addEventListener('click', () => toggleSidebar(false));
      sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

      window.addEventListener('resize', () => {
        if (lastHistory.length) {
          renderCharts(lastHistory);
        }
      });

      const downloaderItems = [
        { name: 'Instagram', description: 'Download media Instagram public.', endpoint: '/api/download/instagram?url=', path: '/api/download/instagram', params: [{ name: 'url', value: 'https://www.instagram.com/p/ByxKbUSnubS/?utm_source=ig_web_copy_link' }] },
        { name: 'TikTok', description: 'Download video TikTok.', endpoint: '/api/download/tiktok?url=', path: '/api/download/tiktok', params: [{ name: 'url', value: 'https://www.tiktok.com/@omagadsus/video/7025456384175017243' }] },
        { name: 'Facebook', description: 'Download video Facebook.', endpoint: '/api/download/facebook?url=', path: '/api/download/facebook', params: [{ name: 'url', value: 'https://www.facebook.com/watch/?v=1393572814172251' }] },
        { name: 'Twitter/X', description: 'Download media Twitter atau X.', endpoint: '/api/download/twitter?url=', path: '/api/download/twitter', params: [{ name: 'url', value: 'https://twitter.com/gofoodindonesia/status/1229369819511709697' }] },
        { name: 'YouTube', description: 'Download metadata/media YouTube.', endpoint: '/api/download/youtube?url=', path: '/api/download/youtube', params: [{ name: 'url', value: 'https://youtube.com/watch?v=C8mJ8943X80' }] },
        { name: 'MediaFire', description: 'Ambil info file MediaFire.', endpoint: '/api/download/mediafire?url=', path: '/api/download/mediafire', params: [{ name: 'url', value: 'https://www.mediafire.com/file/941xczxhn27qbby/GBWA_V12.25FF-By.SamMods-.apk/file' }] },
        { name: 'CapCut', description: 'Ambil template CapCut.', endpoint: '/api/download/capcut?url=', path: '/api/download/capcut', params: [{ name: 'url', value: 'https://www.capcut.com/template-detail/7299286607478181121' }] },
        { name: 'Google Drive', description: 'Ambil info file Google Drive public.', endpoint: '/api/download/gdrive?url=', path: '/api/download/gdrive', params: [{ name: 'url', value: 'https://drive.google.com/file/d/1thDYWcS5p5FFhzTpTev7RUv0VFnNQyZ4/view?usp=drivesdk' }] },
        { name: 'Pinterest', description: 'Download pin atau search Pinterest.', endpoint: '/api/download/pinterest?url=', path: '/api/download/pinterest', params: [{ name: 'url', value: 'https://pin.it/4CVodSq' }] },
        { name: 'AIO', description: 'Downloader otomatis multi-platform.', endpoint: '/api/download/aio?url=', path: '/api/download/aio', params: [{ name: 'url', value: 'https://vt.tiktok.com/ZSkGPK9Kj/' }] },
        { name: 'Douyin', description: 'Download video Douyin.', endpoint: '/api/download/douyin?url=', path: '/api/download/douyin', params: [{ name: 'url', value: 'https://v.douyin.com/ikq8axJ/' }] },
        { name: 'Xiaohongshu', description: 'Download media Xiaohongshu.', endpoint: '/api/download/xiaohongshu?url=', path: '/api/download/xiaohongshu', params: [{ name: 'url', value: 'http://xhslink.com/o/21DKXV988zp' }] },
        { name: 'SnackVideo', description: 'Download video SnackVideo.', endpoint: '/api/download/snackvideo?url=', path: '/api/download/snackvideo', params: [{ name: 'url', value: 'https://s.snackvideo.com/p/j9jKr9dR' }] },
        { name: 'Cocofun', description: 'Download media Cocofun.', endpoint: '/api/download/cocofun?url=', path: '/api/download/cocofun', params: [{ name: 'url', value: 'https://www.icocofun.com/share/post/379250110809' }] },
        { name: 'Spotify', description: 'Ambil info track Spotify.', endpoint: '/api/download/spotify?url=', path: '/api/download/spotify', params: [{ name: 'url', value: 'https://open.spotify.com/track/3zakx7RAwdkUQlOoQ7SJRt' }] },
        { name: 'YT Search', description: 'Search video YouTube.', endpoint: '/api/download/yts?query=', path: '/api/download/yts', params: [{ name: 'query', value: 'Somewhere Only We Know' }] },
        { name: 'SoundCloud', description: 'Download audio SoundCloud.', endpoint: '/api/download/soundcloud?url=', path: '/api/download/soundcloud', params: [{ name: 'url', value: 'https://soundcloud.com/issabella-marchelina/sisa-rasa-mahalini-official-audio' }] },
        { name: 'Threads', description: 'Download media Threads.', endpoint: '/api/download/threads?url=', path: '/api/download/threads', params: [{ name: 'url', value: 'https://www.threads.net/@cindyyuvia/post/C_Nqx3khgkI/' }] },
        { name: 'Kuaishou', description: 'Download video Kuaishou.', endpoint: '/api/download/kuaishou?url=', path: '/api/download/kuaishou', params: [{ name: 'url', value: 'https://v.kuaishou.com/JT195ZHT' }] }
      ];

      const lookupItems = [
        { name: 'GitHub Stalk', description: 'Ambil info profil GitHub public.', endpoint: '/api/github/stalk?username=', path: '/api/github/stalk', params: [{ name: 'username', value: 'octocat' }] },
        { name: 'Instagram Stalk', description: 'Ambil info profil Instagram public.', endpoint: '/api/instagram/stalk?username=', path: '/api/instagram/stalk', params: [{ name: 'username', value: 'cristiano' }] },
        { name: 'Pinterest Stalk', description: 'Ambil info profil Pinterest public.', endpoint: '/api/pinterest/stalk?username=', path: '/api/pinterest/stalk', params: [{ name: 'username', value: 'pinterest' }] },
        { name: 'Roblox Stalk', description: 'Ambil info profil Roblox public.', endpoint: '/api/roblox/stalk?username=', path: '/api/roblox/stalk', params: [{ name: 'username', value: 'builderman' }] },
        { name: 'TikTok Stalk', description: 'Ambil info profil TikTok public.', endpoint: '/api/tiktok/stalk?username=', path: '/api/tiktok/stalk', params: [{ name: 'username', value: 'charlidamelio' }] },
        { name: 'Threads Stalk', description: 'Ambil info profil Threads public.', endpoint: '/api/threads/stalk?username=', path: '/api/threads/stalk', params: [{ name: 'username', value: 'zuck' }] },
        { name: 'X Stalk', description: 'Ambil info profil X atau Twitter public.', endpoint: '/api/x/stalk?username=', path: '/api/x/stalk', params: [{ name: 'username', value: 'elonmusk' }] },
        { name: 'YouTube Stalk', description: 'Ambil info channel YouTube public.', endpoint: '/api/youtube/stalk?username=', path: '/api/youtube/stalk', params: [{ name: 'username', value: 'GoogleDevelopers' }] },
        { name: 'NPM Package', description: 'Ambil info package NPM public.', endpoint: '/api/repository/stalk?package=', path: '/api/repository/stalk', params: [{ name: 'package', value: 'express' }] }
      ];
      const toolItems = [
        { name: 'Cek Gempa', description: 'Info gempa terbaru dari BMKG.', endpoint: '/api/tools/gempa', method: 'GET', path: '/api/tools/gempa', params: [] },
        { name: 'Weather Province', description: 'Prakiraan cuaca BMKG per provinsi.', endpoint: '/api/tools/weather/jawa-barat', method: 'GET', path: '/api/tools/weather/jawa-barat', params: [] },
        { name: 'Weather City', description: 'Prakiraan cuaca BMKG per kota.', endpoint: '/api/tools/weather/jawa-barat/bandung', method: 'GET', path: '/api/tools/weather/jawa-barat/bandung', params: [] },
        { name: 'GitHub Search', description: 'Cari repository GitHub public.', endpoint: '/api/tools/githubsearch?q=express', method: 'GET', path: '/api/tools/githubsearch', params: [{ name: 'q', value: 'express' }] },
        { name: 'Lyrics Search', description: 'Cari lirik lagu via LRCLIB.', endpoint: '/api/tools/lyrics?title=Hello&artist=Adele', method: 'GET', path: '/api/tools/lyrics', params: [{ name: 'title', value: 'Hello' }, { name: 'artist', value: 'Adele' }] },
        { name: 'OCR', description: 'Ubah gambar menjadi text.', endpoint: '/api/tools/ocr', method: 'POST', path: '/api/tools/ocr', file: { label: 'Image file', accept: 'image/png,image/jpeg,image/jpg' }, params: [{ name: 'language', value: 'eng' }] },
        { name: 'ImgToUrl', description: 'Upload gambar menjadi URL public.', endpoint: '/api/tools/imgtourl', method: 'POST', path: '/api/tools/imgtourl', file: { label: 'Image file', accept: 'image/png,image/jpeg,image/jpg' }, params: [] },
        { name: 'RemoveBG', description: 'Hapus background lalu upload hasil PNG.', endpoint: '/api/tools/removebg', method: 'POST', path: '/api/tools/removebg', file: { label: 'Image file', accept: 'image/png,image/jpeg,image/jpg' }, params: [] }
      ];
      const searchItems = [
        { name: 'YT Search', description: 'Cari video YouTube via BTCH.', endpoint: '/api/tools/yts?query=Somewhere+Only+We+Know', path: '/api/tools/yts', params: [{ name: 'query', value: 'Somewhere Only We Know' }] },
        { name: 'Wikipedia', description: 'Search Wikipedia Indonesia.', endpoint: '/api/wikipedia?query=', path: '/api/wikipedia', params: [{ name: 'query', value: 'Indonesia' }] },
        { name: 'GSMArena', description: 'Cari device dan HP di GSMArena.', endpoint: '/api/search/gsmarena?query=iphone', path: '/api/search/gsmarena', params: [{ name: 'query', value: 'iphone' }] },
        { name: 'Bing Image', description: 'Cari gambar via Bing Images.', endpoint: '/api/search/bimg?query=kucing', path: '/api/search/bimg', params: [{ name: 'query', value: 'kucing' }] },
        { name: 'Pinterest Search', description: 'Cari pin gambar di Pinterest dan preview hasilnya.', endpoint: '/api/search/pinterest?query=', path: '/api/search/pinterest', params: [{ name: 'query', value: 'pemandangan jepang asli' }] },
        { name: 'LK21 Search', description: 'Cari film dan series lengkap dengan detail best match.', endpoint: '/api/search/lk21?query=avatar', path: '/api/search/lk21', params: [{ name: 'query', value: 'avatar' }] },
        { name: 'LK21 Popular', description: 'Ambil daftar TOP BULAN INI dari LK21.', endpoint: '/api/search/lk21/popular', path: '/api/search/lk21/popular', params: [] }
      ];
      const animeItems = [
        { name: 'Otakudesu', description: 'Cari anime subtitle Indonesia via otakudesu.blog.', endpoint: '/api/tools/otakudesu?query=naruto', path: '/api/tools/otakudesu', params: [{ name: 'query', value: 'naruto' }] },
        { name: 'Anichin Search', description: 'Cari anime dan donghua di Anichin.', endpoint: '/api/anime/anichin/search?query=renegade', path: '/api/anime/anichin/search', params: [{ name: 'query', value: 'renegade' }] },
        { name: 'AuraTail Search', description: 'Cari donghua di AuraTail.', endpoint: '/api/anime/auratail/search?query=war', path: '/api/anime/auratail/search', params: [{ name: 'query', value: 'war' }] },
        { name: 'Komikindo Search', description: 'Cari manga dan komik di Komikindo.', endpoint: '/api/anime/komikindo/search?query=solo+leveling', path: '/api/anime/komikindo/search', params: [{ name: 'query', value: 'solo leveling' }] },
        { name: 'Oploverz Search', description: 'Cari anime subtitle Indonesia di Oploverz.', endpoint: '/api/anime/oploverz/search?query=romance', path: '/api/anime/oploverz/search', params: [{ name: 'query', value: 'romance' }] }
      ];

      const newsItems = [
        { name: 'Liputan6', description: 'Berita terkini Liputan6.', endpoint: '/api/news/liputan6', method: 'GET', path: '/api/news/liputan6', params: [] },
        { name: 'ANTARA News', description: 'Berita terbaru ANTARA.', endpoint: '/api/news/antara', method: 'GET', path: '/api/news/antara', params: [] },
        { name: 'Berita-indo.id', description: 'Berita seputar Indonesia.', endpoint: '/api/news/berita-indo', method: 'GET', path: '/api/news/berita-indo', params: [] },
        { name: 'Tempo', description: 'Berita terkini Tempo.', endpoint: '/api/news/tempo', method: 'GET', path: '/api/news/tempo', params: [] },
        { name: 'CNBC Indonesia', description: 'Berita ekonomi dan bisnis CNBC Indonesia.', endpoint: '/api/news/cnbc', method: 'GET', path: '/api/news/cnbc', params: [] },
        { name: 'Merdeka', description: 'Berita peristiwa Merdeka.', endpoint: '/api/news/merdeka', method: 'GET', path: '/api/news/merdeka', params: [] },
        { name: 'CNN Indonesia', description: 'Berita terbaru CNN Indonesia.', endpoint: '/api/news/cnn', method: 'GET', path: '/api/news/cnn', params: [] },
        { name: 'Detik', description: 'Search berita Detik.', endpoint: '/api/news/detik?query=indonesia', method: 'GET', path: '/api/news/detik', params: [{ name: 'query', value: 'indonesia' }] },
        { name: 'Kompas', description: 'Search berita Kompas.', endpoint: '/api/news/kompas?query=indonesia', method: 'GET', path: '/api/news/kompas', params: [{ name: 'query', value: 'indonesia' }] }
      ];

      const downloaderTesterApi = renderTester(downloaderTester, downloaderItems);
      const lookupTesterApi = renderTester(lookupTester, lookupItems);
      const animeTesterApi = renderTester(animeTester, animeItems);
      const searchTesterApi = renderTester(searchTester, searchItems);
      const toolsTesterApi = renderToolsTester(toolsTester, toolItems);
      const newsTesterApi = renderTester(newsTester, newsItems);
      const featureStatusItems = [
        {
          name: 'Downloader',
          summary: `${downloaderItems.length} provider: ${downloaderItems.map((item) => item.name).join(', ')}`,
          badge: 'ACTIVE'
        },
        {
          name: 'Tools',
          summary: `${toolItems.length} tools: ${toolItems.map((item) => item.name).join(', ')}`,
          badge: 'ACTIVE'
        },
        {
          name: 'News',
          summary: `${newsItems.length} provider: ${newsItems.map((item) => item.name).join(', ')}`,
          badge: 'ACTIVE'
        },
        {
          name: 'Anime',
          summary: `${animeItems.length} endpoint: ${animeItems.map((item) => item.name).join(', ')}`,
          badge: 'ACTIVE'
        },
        {
          name: 'Search',
          summary: `${searchItems.length} endpoint: ${searchItems.map((item) => item.name).join(', ')}`,
          badge: 'ACTIVE'
        },
        {
          name: 'Lookup',
          summary: `${lookupItems.length} endpoint: ${lookupItems.map((item) => item.name).join(', ')}`,
          badge: 'ACTIVE'
        },
        {
          name: 'Image Pipeline',
          summary: 'OCR, ImgToUrl, RemoveBG, upload telegra.ph, fallback qu.ax',
          badge: 'READY'
        }
      ];
      renderFeatureCards(downloaderGrid, downloaderItems, downloaderTesterApi);
      renderFeatureCards(lookupGrid, lookupItems, lookupTesterApi);
      renderFeatureCards(animeGrid, animeItems, animeTesterApi);
      renderFeatureCards(searchGrid, searchItems, searchTesterApi);
      renderFeatureCards(toolsGrid, toolItems, toolsTesterApi);
      renderFeatureCards(newsGrid, newsItems, newsTesterApi);
      renderFeatureStatus(featureStatusItems);
      dashboardFeatures.textContent = String(downloaderItems.length + lookupItems.length + animeItems.length + searchItems.length + toolItems.length + newsItems.length);

      bootAuthState();
      loadApiKeyMeta();
      setInterval(refreshStats, 5000);
      setInterval(updateRuntimeClock, 1000);
