const nodemailer = require('nodemailer');

let transporterPromise = null;

function getMailConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user).trim();

  return {
    host,
    port,
    user,
    pass,
    from,
    secure: String(process.env.SMTP_SECURE || '').trim() === 'true' || port === 465
  };
}

async function getTransporter() {
  if (!transporterPromise) {
    const config = getMailConfig();

    if (!config.host || !config.user || !config.pass || !config.from) {
      const error = new Error('SMTP belum dikonfigurasi. Isi SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, dan SMTP_FROM');
      error.status = 503;
      throw error;
    }

    transporterPromise = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }

  return transporterPromise;
}

async function sendVerificationCode(email, username, code) {
  const transporter = await getTransporter();
  const from = getMailConfig().from;

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Kode verifikasi akun Lhuciver REST API',
    text: [
      `Halo ${username},`,
      '',
      `Kode verifikasi akun kamu: ${code}`,
      '',
      'Kode ini berlaku selama 10 menit.',
      'Kalau kamu tidak merasa mendaftar, abaikan email ini.'
    ].join('\n'),
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#0b0d10;padding:32px;color:#f8fafc">
        <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:28px">
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;margin-bottom:14px">Lhuciver Rest API</div>
          <h1 style="margin:0 0 12px;font-size:30px;line-height:1">Kode Verifikasi</h1>
          <p style="margin:0 0 18px;color:#d1d5db">Halo <strong>${username}</strong>, pakai kode di bawah ini untuk verifikasi akun kamu.</p>
          <div style="background:#0b0d10;border-radius:18px;padding:18px 20px;font-size:42px;font-weight:800;letter-spacing:.18em;text-align:center">${code}</div>
          <p style="margin:18px 0 0;color:#9ca3af">Kode berlaku selama 10 menit.</p>
        </div>
      </div>
    `
  });
}

module.exports = {
  sendVerificationCode
};
