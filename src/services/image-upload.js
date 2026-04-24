const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png']
]);

function detectImage(buffer, fallbackMime) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  if (allowedTypes.has(fallbackMime)) {
    return { ext: allowedTypes.get(fallbackMime), mime: fallbackMime === 'image/jpg' ? 'image/jpeg' : fallbackMime };
  }

  const error = new Error('format gambar tidak didukung. gunakan jpg, jpeg, atau png');
  error.status = 415;
  throw error;
}

async function uploadToTelegraph(buffer, file) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: file.mime });

  form.append('file', blob, `upload.${file.ext}`);

  const response = await fetch('https://telegra.ph/upload', {
    method: 'POST',
    body: form
  });
  const result = await response.json();

  if (Array.isArray(result) && result[0]?.src) {
    return {
      provider: 'telegra.ph',
      url: `https://telegra.ph${result[0].src}`,
      file_type: file,
      raw: result
    };
  }

  throw new Error(typeof result?.error === 'string' ? result.error : 'telegra.ph upload failed');
}

async function uploadToQuax(buffer, file) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: file.mime });

  form.append('files[]', blob, `upload.${file.ext}`);

  const response = await fetch('https://qu.ax/upload.php', {
    method: 'POST',
    body: form
  });
  const result = await response.json();
  const url = result?.files?.[0]?.url;

  if (result?.success && url) {
    return {
      provider: 'qu.ax',
      url,
      file_type: file,
      raw: result
    };
  }

  throw new Error('qu.ax upload failed');
}

async function uploadImage(buffer, mimetype) {
  const file = detectImage(buffer, mimetype);
  const errors = [];

  for (const uploader of [uploadToTelegraph, uploadToQuax]) {
    try {
      return await uploader(buffer, file);
    } catch (error) {
      errors.push(error.message);
    }
  }

  const error = new Error(`gagal upload gambar: ${errors.join(' | ')}`);
  error.status = 502;
  throw error;
}

module.exports = {
  uploadImage
};
