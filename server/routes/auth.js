// server/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Optional helpers the client might use
router.post('/check-availability', async (req, res) => {
  try {
    const { email, username } = req.body || {};
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
  "Business & Economics","Communications","Engineering & Comp Sci","Arts",
  "Health & Human Dev","Humanities & Social Sci","Natural Sci & Math","Education",
];
const commonHobbies = [
  "Reading","Traveling","Movies","Fishing","Crafts","Television","Bird watching",
  "Collecting","Music","Gardening","Video Games","Drawing","Walking","Hiking",
  "Cooking","Sports","Fitness","Yoga","Photography","Writing","Dancing","Painting","Camping",
];
router.get('/signup-data', (_req, res) => {
  res.status(200).json({ departments: csufDepartments, hobbies: commonHobbies });
});

// -------------------- SIGNUP --------------------
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, department, hobbies } = req.body || {};
    if (!username || !email || !password || !department) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Hash here (safe even if model also hashes; but typical pattern is model pre-save)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      department,
      hobbies: Array.isArray(hobbies) ? hobbies : [],
    });

    // Return safe user (password hidden by select:false / toJSON transform)
    res.status(201).json(user);
  } catch (err) {
    console.error('signup error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Username or email already in use' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- LOGIN --------------------
// Accepts ANY of these from the client: loginIdentifier | emailOrUsername | email | username
router.post('/login', async (req, res) => {
  try {
    const identifier =
      (req.body && (req.body.loginIdentifier || req.body.emailOrUsername || req.body.email || req.body.username)) || '';
    const password = (req.body && req.body.password) || '';

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    // Find by email or username; explicitly include password hash
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Helpful error instead of a 500 from jwt.sign(undefined)
      return res.status(500).json({ message: 'JWT secret not set on server' });
    }

    const token = jwt.sign({ id: user._id }, secret, { expiresIn: '1d' });

    // Strip password manually
    const safe = user.toObject();
    delete safe.password;

    res.json({ ...safe, token });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
