/**
 * U Turn Watch Party — Phase 2 Server
 * Node.js + Socket.io
 *
 * Handles:
 *  - Room creation & joining (with codes like "XK92PL")
 *  - Cross-device video sync (PLAY / PAUSE / SEEK / LOAD_VIDEO)
 *  - Chat relay
 *  - Reaction relay
 *  - WebRTC signaling (offer / answer / ICE candidates) for voice chat
 *  - Member join / leave events
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Serve the frontend HTML as a static file
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory room state ──────────────────────────────────────────────────────
// rooms = {
//   "XK92PL": {
//     name: "Sisters Night 🌙",
//     members: { socketId: { name, avatar, mic } },
//     videoState: { videoId, isPlaying, currentTime, updatedAt }
//   }
// }
const rooms = {};

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomMembers(roomCode) {
  if (!rooms[roomCode]) return [];
  return Object.values(rooms[roomCode].members);
}

// ── Socket.io connection ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── CREATE ROOM ──
  socket.on('create_room', ({ name, avatar, roomName }, cb) => {
    const code = generateCode();
    rooms[code] = {
      name: roomName || 'Sisters Night 🌙',
      members: {
        [socket.id]: { name, avatar, mic: false, socketId: socket.id }
      },
      videoState: { videoId: null, isPlaying: false, currentTime: 0, updatedAt: Date.now() }
    };
    socket.join(code);
    socket.data = { name, avatar, roomCode: code };
    console.log(`[ROOM] Created: ${code} by ${name}`);
    cb({ success: true, code, roomName: rooms[code].name, members: getRoomMembers(code) });
  });

  // ── JOIN ROOM ──
  socket.on('join_room', ({ name, avatar, code }, cb) => {
    const room = rooms[code];
    if (!room) {
      cb({ success: false, error: 'Room not found. Check the code and try again!' });
      return;
    }
    room.members[socket.id] = { name, avatar, mic: false, socketId: socket.id };
    socket.join(code);
    socket.data = { name, avatar, roomCode: code };

    // Tell everyone else someone joined
    socket.to(code).emit('member_joined', { name, avatar, socketId: socket.id });

    // Send joiner the current room state (video, members)
    const state = {
      success: true,
      code,
      roomName: room.name,
      members: getRoomMembers(code),
      videoState: room.videoState
    };
    console.log(`[ROOM] ${name} joined: ${code}`);
    cb(state);
  });

  // ── LOAD VIDEO ──
  socket.on('load_video', ({ videoId }) => {
    const code = socket.data?.roomCode;
    if (!code || !rooms[code]) return;
    rooms[code].videoState = { videoId, isPlaying: false, currentTime: 0, updatedAt: Date.now() };
    socket.to(code).emit('load_video', { videoId, from: socket.data.name, avatar: socket.data.avatar });
    console.log(`[VIDEO] Load ${videoId} in ${code}`);
  });

  // ── PLAY ──
  socket.on('play', ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!code || !rooms[code]) return;
    rooms[code].videoState.isPlaying = true;
    rooms[code].videoState.currentTime = currentTime;
    rooms[code].videoState.updatedAt = Date.now();
    socket.to(code).emit('play', { currentTime, from: socket.data.name, avatar: socket.data.avatar });
  });

  // ── PAUSE ──
  socket.on('pause', ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!code || !rooms[code]) return;
    rooms[code].videoState.isPlaying = false;
    rooms[code].videoState.currentTime = currentTime;
    rooms[code].videoState.updatedAt = Date.now();
    socket.to(code).emit('pause', { currentTime, from: socket.data.name, avatar: socket.data.avatar });
  });

  // ── SEEK ──
  socket.on('seek', ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!code || !rooms[code]) return;
    rooms[code].videoState.currentTime = currentTime;
    rooms[code].videoState.updatedAt = Date.now();
    socket.to(code).emit('seek', { currentTime, from: socket.data.name, avatar: socket.data.avatar });
  });

  // ── SYNC REQUEST — host broadcasts current time to latecomers ──
  socket.on('sync_request', ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!code || !rooms[code]) return;
    rooms[code].videoState.currentTime = currentTime;
    rooms[code].videoState.updatedAt = Date.now();
    socket.to(code).emit('sync', { currentTime, from: socket.data.name });
  });

  // ── CHAT ──
  socket.on('chat', ({ text }) => {
    const code = socket.data?.roomCode;
    if (!code) return;
    socket.to(code).emit('chat', { text, from: socket.data.name, avatar: socket.data.avatar });
  });

  // ── REACTION ──
  socket.on('reaction', ({ emoji }) => {
    const code = socket.data?.roomCode;
    if (!code) return;
    socket.to(code).emit('reaction', { emoji, from: socket.data.name });
  });

  // ── MIC STATE ──
  socket.on('mic_state', ({ active }) => {
    const code = socket.data?.roomCode;
    if (!code || !rooms[code]) return;
    if (rooms[code].members[socket.id]) {
      rooms[code].members[socket.id].mic = active;
    }
    socket.to(code).emit('mic_state', { socketId: socket.id, name: socket.data.name, active });
  });

  // ── WebRTC SIGNALING ─────────────────────────────────────────────────────
  // The server just relays these between peers — audio goes directly peer-to-peer

  socket.on('webrtc_offer', ({ to, offer }) => {
    io.to(to).emit('webrtc_offer', { from: socket.id, offer });
  });

  socket.on('webrtc_answer', ({ to, answer }) => {
    io.to(to).emit('webrtc_answer', { from: socket.id, answer });
  });

  socket.on('webrtc_ice', ({ to, candidate }) => {
    io.to(to).emit('webrtc_ice', { from: socket.id, candidate });
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    const code = socket.data?.roomCode;
    if (code && rooms[code]) {
      const member = rooms[code].members[socket.id];
      if (member) {
        delete rooms[code].members[socket.id];
        socket.to(code).emit('member_left', {
          socketId: socket.id,
          name: member.name,
          avatar: member.avatar
        });
        console.log(`[-] ${member.name} left room ${code}`);
        // Clean up empty rooms
        if (Object.keys(rooms[code].members).length === 0) {
          delete rooms[code];
          console.log(`[ROOM] Deleted empty room: ${code}`);
        }
      }
    }
    console.log(`[-] Disconnected: ${socket.id}`);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 U Turn Watch Party server running on port ${PORT}`);
  console.log(`   Open: http://localhost:${PORT}\n`);
});
