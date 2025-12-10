const router = require('express').Router();
const axios = require("axios");
const crypto = require('crypto');
const StudentVerification = require('../models/StudentVerification');
const path = require('path');
const fs = require('fs');

// Load universities list
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

// ---- NEW: Brevo Email API sender ----
async function sendVerificationEmail({ to, code }) {
  try {
    const senderMatch = process.env.MAIL_FROM.match(/<(.*)>/);
    const senderEmail = senderMatch ? senderMatch[1] : process.env.MAIL_FROM;

    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: "UniVerse", email: senderEmail },
        to: [{ email: to }],
        subject: "Your EduConnect verification code",
        htmlContent: `
          <p>Your verification code is:</p>
          <h2 style="font-size: 24px;">${code}</h2>
          <p>It expires in 15 minutes.</p>
        `
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        }
      }
    );

    console.log("Brevo API email sent:", res.status);

  } catch (err) {
    console.error("Brevo API send error:", err?.response?.data || err.message);
    throw new Error("EMAIL_SEND_FAILED");
  }
}


// ---- SEND VERIFICATION CODE ----
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

    // Create verification code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store it in database
    await StudentVerification.findOneAndUpdate(
      { email, schoolSlug },
      { code, verified: false, expiresAt },
      { upsert: true, new: true }
    );

    // Send email via Brevo API
    await sendVerificationEmail({ to: email, code });

    res.json({ ok: true });

  } catch (err) {
    console.error('verification/send error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ---- CONFIRM VERIFICATION CODE ----
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
        secure: process.env.NODE_ENV === 'production',
        maxAge: THIRTY_DAYS,
      }
    );

    return res.json({ ok: true, verifiedUntil });

  } catch (err) {
    console.error('verification/confirm error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ---- CHECK VERIFICATION STATUS ----
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
