const router = require('express').Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const StudentVerification = require('../models/StudentVerification');
const path = require('path');
const fs = require('fs');

// Load the same university list on the server (domains used for validation)
const uniPath = path.join(__dirname, '..', 'data', 'universities.json');
const universities = JSON.parse(fs.readFileSync(uniPath, 'utf8'));

function findSchool(slug) {
  return universities.find((u) => u.slug === slug);
}
function emailMatchesDomains(email, domains = []) {
  const e = String(email || '').toLowerCase().trim();
  if (!e.includes('@') || !domains?.length) return false;
  return domains.some((d) => e.endsWith(`@${String(d).toLowerCase()}`));
}

function buildMailer() {
  // Prefer SMTP_URL, else discrete envs; otherwise "console mode"
  if (process.env.SMTP_URL) return nodemailer.createTransport(process.env.SMTP_URL);
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: /^true$/i.test(process.env.SMTP_SECURE || 'false'),
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return null;
}

const mailer = buildMailer();

router.post('/send', async (req, res) => {
  try {
    let { email, schoolSlug } = req.body || {};
    email = String(email || '').trim().toLowerCase();
    schoolSlug = String(schoolSlug || '').trim();
    const school = findSchool(schoolSlug);
    if (!school) return res.status(400).json({ message: 'Unknown school' });
    if (!emailMatchesDomains(email, school.domains)) {
      return res.status(400).json({ message: `Please use an email ending with @${school.domains[0]}` });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await StudentVerification.findOneAndUpdate(
      { email, schoolSlug },
      { code, verified: false, expiresAt },
      { upsert: true, new: true }
    );

    if (mailer) {
      await mailer.sendMail({
        to: email,
        from: process.env.MAIL_FROM || 'no-reply@educonnect.app',
        subject: 'Your EduConnect verification code',
        text: `Your code is ${code}. It expires in 10 minutes.`,
      });
    } else {
      console.log(`[DEV] EduConnect code for ${email}: ${code}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('verification/send error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const COOKIE_NAME = 'educonnect_verified';

router.post('/confirm', async (req, res) => {
  try {
    let { email, schoolSlug, code } = req.body || {};
    email = String(email || '').trim().toLowerCase();
    code = String(code || '').trim();
    schoolSlug = String(schoolSlug || '').trim();

    const rec = await StudentVerification.findOne({ email, schoolSlug });
    if (!rec || rec.verified) return res.status(400).json({ message: 'Invalid code' });
    if (rec.expiresAt.getTime() < Date.now()) return res.status(400).json({ message: 'Code expired' });
    if (rec.code !== code) return res.status(400).json({ message: 'Invalid code' });

    rec.verified = true;
    await rec.save();

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const verifiedUntil = Date.now() + THIRTY_DAYS;

    res.cookie(
      COOKIE_NAME,
      JSON.stringify({ email, schoolSlug, until: verifiedUntil }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production', // keep false on localhost
        maxAge: THIRTY_DAYS,
      }
    );

    return res.json({ ok: true, verifiedUntil });
  } catch (err) {
    console.error('verification/confirm error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// New: check 30-day verification window
router.get('/status', (req, res) => {
  try {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) return res.json({ ok: false });

    let payload = {};
    try { payload = JSON.parse(raw); } catch (_) {}
    const until = Number(payload?.until || 0);

    if (until > Date.now()) {
      return res.json({
        ok: true,
        email: payload.email,
        schoolSlug: payload.schoolSlug,
        verifiedUntil: until,
      });
    }
    return res.json({ ok: false });
  } catch (e) {
    console.error('verification/status error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
