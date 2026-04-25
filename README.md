# 🎬 U Turn Watch Party — Phase 2

Watch YouTube with your sisters across devices — real-time sync + voice chat!

---

## What's in this folder

```
watchparty/
├── server.js          ← Node.js + Socket.io backend
├── package.json       ← Dependencies
├── public/
│   └── index.html     ← The full frontend (served by the server)
└── README.md          ← This file
```

---

## How it works

```
Your phone/laptop          Sisters' phones
──────────────             ──────────────
Open the website     ←→    Open the same website
Create room → XK92PL  →   Join room → type XK92PL
Load YouTube video         Video loads on their screen too
Press Play             →   Video plays for everyone at the same time
Click 🎤               →   WebRTC voice — you can talk to each other!
```

---

## 🚀 Deploy FREE on Render (recommended)

### Step 1 — Upload to GitHub

1. Create a free account at https://github.com
2. Create a new repository called `uturn-watchparty`
3. Upload all three files: `server.js`, `package.json`, and `public/index.html`
   - Make sure `index.html` is inside a folder called `public`

### Step 2 — Deploy on Render

1. Create a free account at https://render.com
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Fill in these settings:
   - **Name**: `uturn-watchparty`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Click **Create Web Service**
6. Wait ~2 minutes — Render gives you a URL like:
   `https://uturn-watchparty.onrender.com`

### Step 3 — Share with sisters!

Send this on WhatsApp (one time only):
> 🎬 Our watch party link: https://uturn-watchparty.onrender.com

Every time you want to watch:
1. You open the link → Create Room → get a code like `XK92PL`
2. Send the code to sisters on WhatsApp
3. They open the link → Join Room → type the code
4. Everyone is synced! 🎉

---

## 💻 Run locally first (to test)

```bash
# Install Node.js from https://nodejs.org (if you haven't)

# In the watchparty folder:
npm install
npm start

# Open http://localhost:3000 in two different tabs
# Create a room in one tab, join with the code in the other
# They should sync! ✅
```

---

## Features

| Feature | Phase 1 | Phase 2 (this) |
|---------|---------|----------------|
| Video player | ✅ | ✅ |
| Sync (same device, same browser) | ✅ | ✅ |
| Sync (different devices, different networks) | ❌ | ✅ |
| Real-time chat | Same tab only | ✅ Cross-device |
| Voice chat (WebRTC) | ❌ | ✅ |
| Room codes | ✅ | ✅ |
| Reactions | ✅ | ✅ |
| Free hosting | ❌ | ✅ Render |

---

## ⚠️ Notes

- **Free Render tier** spins down after 15 min of inactivity — first load after that takes ~30 sec. Totally fine for personal use!
- **Voice chat** uses WebRTC peer-to-peer — audio goes directly between devices, not through the server. Very low latency.
- **YouTube sync** — play/pause is synced instantly. Seek (dragging the progress bar) is not auto-synced yet; use the ⚡ Sync All button if someone falls behind.
- The server keeps room state in memory — rooms disappear if the server restarts (which is fine for watching sessions).
