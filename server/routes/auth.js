// server/routes/auth.js

const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ... (check-availability and signup-data routes are fine, no changes needed)
router.post('/check-availability', async (req, res) => {
    try {
        const { email, username } = req.body;
        const [emailUser, usernameUser] = await Promise.all([
            email ? User.findOne({ email }) : null,
            username ? User.findOne({ username }) : null
        ]);
        res.status(200).json({ isEmailTaken: !!emailUser, isUsernameTaken: !!usernameUser });
    } catch (err) { res.status(500).json(err); }
});

const csufDepartments = ["Business & Economics", "Communications", "Engineering & Comp Sci", "Arts", "Health & Human Dev", "Humanities & Social Sci", "Natural Sci & Math", "Education"];
const commonHobbies = ["Reading", "Traveling", "Movies", "Fishing", "Crafts", "Television", "Bird watching", "Collecting", "Music", "Gardening", "Video Games", "Drawing", "Walking", "Hiking", "Cooking", "Sports", "Fitness", "Yoga", "Photography", "Writing", "Dancing", "Painting", "Camping"];
router.get('/signup-data', (req, res) => {
    res.status(200).json({ departments: csufDepartments, hobbies: commonHobbies });
});
// ...

// SIGNUP (No changes needed, but including for completeness)
router.post('/signup', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);
        const newUser = new User({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            department: req.body.department,
            hobbies: req.body.hobbies,
        });
        const user = await newUser.save();
        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ message: "Error creating user.", error: err });
    }
});


// --- THIS IS THE MAJOR FIX ---
// LOGIN (Updated to handle username or email)
router.post('/login', async (req, res) => {
    try {
        const { loginIdentifier, password: bodyPassword } = req.body;

        // Intelligently find user by EITHER email OR username
        const user = await User.findOne({
            $or: [{ email: loginIdentifier }, { username: loginIdentifier }]
        });
        
        if (!user) {
            return res.status(404).json("User not found");
        }

        const validPassword = await bcrypt.compare(bodyPassword, user.password);
        if (!validPassword) {
            return res.status(400).json("Wrong password");
        }

        if (!user.isVerified) {
            return res.status(403).json("Please verify your email before logging in.");
        }
        
        const token = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        
        const { password, ...other } = user._doc;
        res.status(200).json({ ...other, token });

    } catch (err) {
        res.status(500).json(err);
    }
});


module.exports = router;
