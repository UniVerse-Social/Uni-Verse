# fullerton-connect

A full‑stack MERN social app with posts, profiles, DMs, and image upload/cropping.

## Tech stack
- **Client:** React (CRA), React Router, Context/hooks, image cropping utils
- **Server:** Node.js, Express, MongoDB (Mongoose), JWT auth
- **Models:** User, Post, Message, Conversation

## Project structure
```
fullerton-connect/
├─ client/            # React app
│  ├─ public/
│  └─ src/
│     ├─ components/  # Post, Navbar, modals, etc.
│     ├─ pages/       # Home, Login, Signup, Profile, DMs, TitanTap
│     └─ utils/
├─ server/            # Node/Express API
│  ├─ models/         # User, Post, Message, Conversation
│  ├─ routes/         # auth, users, posts, messages
│  ├─ scripts/        # maintenance scripts (e.g., hash_existing_passwords.js)
│  ├─ seed.js         # optional: seed database from local files
│  └─ server.js
└─ package.json
```

## Prerequisites
- Node.js 18+ and npm
- A MongoDB connection string (Atlas or local)

## Environment variables
Create these files (do **not** commit real secrets to this repository):

`server/.env`
```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster/dbname
JWT_SECRET=change-me
PORT=4000
```

`client/.env`
```
REACT_APP_API_URL=http://localhost:4000
```

## Setup & run (development)

```bash
# from the repo root
cd server && npm install
cd ../client && npm install
```

Start the API:
```bash
cd server
npm start          # or: node server.js
```

Start the React client:
```bash
cd client
npm start
```

## Seeding the database (optional)
If `server/seed.js` seeds from files in `server/seed-data/`, run:
```bash
cd server
node seed.js
```

## Common scripts (suggested)
Add these to `server/package.json` if you use nodemon:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

## Contributing
1. Create a new branch: `git checkout -b feature/<name>`
2. Commit: `git commit -m "feat: <what you changed>"`
3. Push: `git push -u origin feature/<name>`
4. Open a pull request.

## License
MIT
