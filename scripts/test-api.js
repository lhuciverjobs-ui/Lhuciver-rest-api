const baseUrl = (process.env.API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

let sharp = null;
try {
  sharp = require('sharp');
} catch (error) {
  sharp = null;
}

const tests = [
  {
    name: 'Health check',
    path: '/api/health',
    expectStatus: 200
  },
  {
    name: 'Daftar endpoint',
    path: '/api',
    expectStatus: 200
  },
  {
    name: 'Statistik runtime',
    path: '/api/stats',
    expectStatus: 200
  },
  {
    name: 'Config public',
    path: '/api/config',
    expectStatus: 200
  },
  {
    name: 'Daftar downloader',
    path: '/api/downloaders',
    expectStatus: 200
  },
  {
    name: 'ImgToUrl missing file',
    path: '/api/tools/imgtourl',
    method: 'POST',
    expectStatus: 406
  },
  {
    name: 'RemoveBG missing file',
    path: '/api/tools/removebg',
    method: 'POST',
    expectStatus: 406
  },
  {
    name: 'OCR missing file',
    path: '/api/tools/ocr',
    method: 'POST',
    expectStatus: 406
  },
  {
    name: 'Cek gempa BMKG',
    path: '/api/tools/gempa',
    expectStatus: 200
  },
  {
    name: 'GitHub repository search',
    path: '/api/tools/githubsearch?q=express',
    expectStatus: 200
  },
  {
    name: 'YouTube search',
    path: '/api/tools/yts?query=Somewhere%20Only%20We%20Know',
    expectStatus: 200
  },
  {
    name: 'Otakudesu search',
    path: '/api/tools/otakudesu?query=naruto',
    expectStatus: 200
  },
  {
    name: 'Lyrics search',
    path: '/api/tools/lyrics?title=Hello&artist=Adele',
    expectStatus: 200
  },
  {
    name: 'News Merdeka',
    path: '/api/news/merdeka',
    expectStatus: 200
  },
  {
    name: 'News Liputan6',
    path: '/api/news/liputan6',
    expectStatus: 200
  },
  {
    name: 'News ANTARA',
    path: '/api/news/antara',
    expectStatus: 200
  },
  {
    name: 'News Berita-indo',
    path: '/api/news/berita-indo',
    expectStatus: 200
  },
  {
    name: 'News Tempo',
    path: '/api/news/tempo',
    expectStatus: 200
  },
  {
    name: 'News CNBC',
    path: '/api/news/cnbc',
    expectStatus: 200
  },
  {
    name: 'News CNN',
    path: '/api/news/cnn',
    expectStatus: 200
  },
  {
    name: 'News Detik',
    path: '/api/news/detik?query=indonesia',
    expectStatus: 200
  },
  {
    name: 'News Kompas',
    path: '/api/news/kompas?query=indonesia',
    expectStatus: 200
  },
  {
    name: 'OCR image upload',
    path: '/api/tools/ocr',
    method: 'POST',
    expectStatus: 200,
    bodyFactory: async () => {
      if (!sharp) {
        throw new Error('sharp is not available');
      }

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="420" height="160">
          <rect width="100%" height="100%" fill="white" />
          <text x="28" y="96" font-family="Arial, sans-serif" font-size="64" fill="black">HELLO</text>
        </svg>
      `;
      const image = await sharp(Buffer.from(svg)).png().toBuffer();
      const form = new FormData();
      form.append('file', new Blob([image], { type: 'image/png' }), 'ocr-test.png');
      form.append('language', 'eng');
      return form;
    }
  },
  {
    name: 'Downloader missing url',
    path: '/api/download/instagram',
    expectStatus: 406
  },
  {
    name: 'GitHub stalk',
    path: '/api/github/stalk?username=octocat',
    expectStatus: 200
  },
  {
    name: 'Instagram stalk',
    path: '/api/instagram/stalk?username=cristiano',
    expectStatus: 200
  },
  {
    name: 'TikTok stalk',
    path: '/api/tiktok/stalk?username=charlidamelio',
    expectStatus: 200
  },
  {
    name: 'X stalk',
    path: '/api/x/stalk?username=elonmusk',
    expectStatus: 200
  },
  {
    name: 'NPM package info',
    path: '/api/repository/stalk?package=express',
    expectStatus: 200
  },
  {
    name: 'Wikipedia search',
    path: '/api/wikipedia?query=Indonesia',
    expectStatus: 200
  },
  {
    name: 'Endpoint tidak ada',
    path: '/api/tidak-ada',
    expectStatus: 404
  }
];

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

async function runTest(test) {
  const url = `${baseUrl}${test.path}`;
  const startedAt = performance.now();
  let response;
  let body;

  try {
    if (test.bodyFactory) {
      const bodyInit = await test.bodyFactory();
      response = await fetch(url, {
        method: test.method || 'POST',
        body: bodyInit,
        headers: { accept: 'application/json' }
      });
    } else {
      response = await fetch(url, {
        method: test.method || 'GET',
        headers: { accept: 'application/json' }
      });
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
  } catch (error) {
    return {
      ok: false,
      name: test.name,
      url,
      error: error.message
    };
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const ok = response.status === test.expectStatus;

  return {
    ok,
    name: test.name,
    url,
    expected_status: test.expectStatus,
    actual_status: response.status,
    duration_ms: durationMs,
    response: body
  };
}

async function main() {
  console.log(`API base URL: ${baseUrl}`);
  console.log(`Total test: ${tests.length}`);
  console.log('');

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    console.log(`=== ${result.ok ? 'PASS' : 'FAIL'}: ${result.name} ===`);
    console.log(`URL: ${result.url}`);

    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else {
      console.log(`HTTP: ${result.actual_status} expected ${result.expected_status}`);
      console.log(`TIME: ${result.duration_ms}ms`);
      console.log('RESPONSE:');
      printJson(result.response);
    }

    console.log('');
  }

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;

  console.log('=== SUMMARY ===');
  printJson({
    base_url: baseUrl,
    total: results.length,
    passed,
    failed
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
