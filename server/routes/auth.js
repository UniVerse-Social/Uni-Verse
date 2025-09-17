// server/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper: remove sensitive fields
function sanitizeUser(u) {
  const obj = u?.toObject ? u.toObject() : { ...u };
  delete obj.password;
  return obj;
}

// -------------------- OPTIONAL HELPERS --------------------
router.post('/check-availability', async (req, res) => {
  try {
    let { email, username } = req.body || {};
    email = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    username = typeof username === 'string' ? username.trim() : undefined;

    const [emailUser, usernameUser] = await Promise.all([
      email ? User.findOne({ email }) : null,
      username ? User.findOne({ username }) : null,
    ]);

    res.status(200).json({
      isEmailTaken: !!emailUser,
      isUsernameTaken: !!usernameUser,
    });
  } catch (err) {
    console.error('check-availability error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const csufDepartments = [
  'Business & Economics','Communications','Engineering & Comp Sci','Arts',
  'Health & Human Dev','Humanities & Social Sci','Natural Sci & Math','Education',
];
const commonHobbies = [
  'Reading','Traveling','Movies','Fishing','Crafts','Television','Bird watching',
  'Collecting','Music','Gardening','Video Games','Drawing','Walking','Hiking',
  'Cooking','Sports','Fitness','Yoga','Photography','Writing','Dancing','Painting','Camping',
];

router.get('/signup-data', (_req, res) => {
  res.status(200).json({ departments: csufDepartments, hobbies: commonHobbies });
});

// -------------------- SIGNUP --------------------
// NOTE: We DO NOT hash here; rely on the User model's pre-save hook.
// If your model does NOT hash, see note below.
router.post('/signup', async (req, res) => {
  try {
    let { username, email, password, department, hobbies } = req.body || {};
    username = typeof username === 'string' ? username.trim() : '';
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    password = typeof password === 'string' ? password : '';

    // department is optional; default to empty string if not provided
    department = typeof department === 'string' ? department.trim() : '';

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Uniqueness checks (friendly 409s)
    const [uTaken, eTaken] = await Promise.all([
      User.findOne({ username }),
      User.findOne({ email }),
    ]);
    if (uTaken) return res.status(409).json({ message: 'Username already taken' });
    if (eTaken) return res.status(409).json({ message: 'Email already in use' });

    // Create user (model should hash password via pre-save)
    const user = await User.create({
      username,
      email,
      password,               // plain here; model should hash
      department,             // may be ''
      hobbies: Array.isArray(hobbies) ? hobbies : [],
    });

    // Optionally mint a token so the client can auto-login after signup
    const secret = process.env.JWT_SECRET;
    const token = secret ? jwt.sign({ id: user._id }, secret, { expiresIn: '1d' }) : undefined;

    res.status(201).json({ ...sanitizeUser(user), ...(token ? { token } : {}) });
  } catch (err) {
    console.error('signup error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Username or email already in use' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- LOGIN --------------------
// Accepts ANY of these: loginIdentifier | emailOrUsername | email | username
router.post('/login', async (req, res) => {
  try {
    const body = req.body || {};
    const rawIdentifier =
      body.loginIdentifier || body.emailOrUsername || body.email || body.username || '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rawIdentifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const trimmed = rawIdentifier.trim();
    const identifierEmail = trimmed.toLowerCase();

    // Look up by email (lowercased) OR exact username; include password for compare
    const user = await User.findOne({
      $or: [{ email: identifierEmail }, { username: trimmed }],
    }).select('+password');

    if (!user || !user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(String(password), String(user.password));
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'JWT secret not set on server' });
    }
    const token = jwt.sign({ id: user._id }, secret, { expiresIn: '1d' });

    res.json({ ...sanitizeUser(user), token });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
