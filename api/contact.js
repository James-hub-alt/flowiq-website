const TO_EMAIL = 'hello@flowiq.pro';
const FROM_EMAIL = 'FlowIQ Website <onboarding@resend.dev>';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { formType, subject, fields, website } = req.body || {};

    // Honeypot: bots fill every field, real users never see or fill this one.
    if (website) {
      res.status(200).json({ ok: true });
      return;
    }

    if (!subject || !fields || typeof fields !== 'object') {
      res.status(400).json({ ok: false, error: 'Missing form data' });
      return;
    }

    const entries = Object.entries(fields).filter(([, v]) => String(v || '').trim() !== '');
    if (entries.length === 0) {
      res.status(400).json({ ok: false, error: 'Empty form' });
      return;
    }

    const replyTo = fields.email && /\S+@\S+\.\S+/.test(fields.email) ? fields.email : undefined;

    const rows = entries
      .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#5B6670;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#1C2733;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`)
      .join('');
    const text = entries.map(([label, value]) => `${label}: ${value}`).join('\n');
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;">
      <h2 style="color:#0B1624;margin:0 0 4px;">${escapeHtml(subject)}</h2>
      <p style="color:#5B6670;margin:0 0 16px;font-size:13px;">Submitted from the FlowIQ website${formType ? ' — ' + escapeHtml(formType) : ''}.</p>
      <table cellpadding="0" cellspacing="0">${rows}</table>
    </div>`;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not configured');
      res.status(500).json({ ok: false, error: 'Email service not configured' });
      return;
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: replyTo,
        subject,
        html,
        text
      })
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error('Resend error', resendRes.status, errBody);
      res.status(502).json({ ok: false, error: 'Failed to send email' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form error', err);
    res.status(500).json({ ok: false, error: 'Unexpected server error' });
  }
};
