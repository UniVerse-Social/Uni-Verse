// server/seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const faker = require('faker'); // v5.x (you already installed)
const User = require('./models/User');
const Post = require('./models/Post');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fullerton-connect';

const DEPARTMENTS = [
  'Computer Science','Business','Engineering','Biology',
  'Psychology','Mathematics','Communications','Art'
];

const HOBBIES = [
  'basketball','soccer','photography','hiking','gaming',
  'reading','music','cooking','coding','yoga','painting','running'
];

const AVATAR = seed => `https://api.dicebear.com/6.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;

(async () => {
  await mongoose.connect(MONGO_URI, {});
  console.log('Connected to Mongo');

  // wipe ONLY old bots (keep real users)
  const oldBots = await User.find({ email: /@bot\.example\.com$/ }).select('_id');
  const botIds = oldBots.map(b => b._id);
  if (botIds.length) {
    await Post.deleteMany({ userId: { $in: botIds } });
    await User.deleteMany({ _id: { $in: botIds } });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // create 40 bots
  const bots = [];
  for (let i = 1; i <= 40; i++) {
    const username = `bot${String(i).padStart(2, '0')}`;
    const department = faker.random.arrayElement(DEPARTMENTS);
    const hobbies = faker.random.arrayElements(HOBBIES, faker.datatype.number({ min: 2, max: 6 }));

    bots.push(new User({
      username,
      email: `${username}@bot.example.com`,
      password: passwordHash,
      department,
      hobbies,
      profilePicture: AVATAR(username),
      bannerPicture: '',
      followers: [],
      following: [],
    }));
  }
  await User.insertMany(bots);

  const allBots = await User.find({ email: /@bot\.example\.com$/ })
    .select('_id username profilePicture')
    .lean();

  // random follows
  const bulkUsers = User.collection.initializeUnorderedBulkOp();
  for (const a of allBots) {
    const others = allBots.filter(b => b._id.toString() !== a._id.toString());
    const pickCount = faker.datatype.number({ min: 6, max: 14 });
    for (let j = 0; j < pickCount; j++) {
      const b = faker.random.arrayElement(others);
      bulkUsers.find({ _id: a._id }).updateOne({ $addToSet: { following: b._id } });
      bulkUsers.find({ _id: b._id }).updateOne({ $addToSet: { followers: a._id } });
    }
  }
  if (bulkUsers.length) await bulkUsers.execute();

  // posts per bot (3–6) — include username to satisfy your Post model
  const postDocs = [];
  for (const b of allBots) {
    const n = faker.datatype.number({ min: 3, max: 6 });
    for (let i = 0; i < n; i++) {
      postDocs.push(new Post({
        userId: b._id,
        username: b.username,                 // <-- required by your schema
        profilePicture: b.profilePicture || '',// optional but nice for feed
        desc: faker.hacker.phrase(),
        img: '',                               // or a placeholder image URL
        likes: [],
        comments: []
      }));
    }
  }
  if (postDocs.length) await Post.insertMany(postDocs);

  console.log('✅ Seed complete. Bot password: password123');
  await mongoose.disconnect();
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
