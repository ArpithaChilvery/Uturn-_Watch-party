const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname,"index.html")));
app.get("/health", (req, res) => res.send("OK"));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const rooms = {};

function generateCode() {
  let code;
  do { code = Math.random().toString(36).substring(2, 8).toUpperCase(); } while (rooms[code]);
  return code;
}

function getMembers(code) {
  return rooms[code] ? Object.values(rooms[code].members) : [];
}

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on("create_room", ({ name, avatar, roomName }, cb) => {
    try {
      const code = generateCode();
      rooms[code] = {
        name: roomName || "Watch Party",
        members: { [socket.id]: { socketId: socket.id, name, avatar, mic: false } },
        videoState: { videoId: null, isPlaying: false, currentTime: 0, updatedAt: Date.now() }
      };
      socket.join(code);
      socket.data = { roomCode: code, name, avatar };
      cb({ success: true, code, roomName: rooms[code].name, members: getMembers(code) });
      console.log(`[Room] Created ${code} by ${name}`);
    } catch (e) {
      cb({ success: false, error: "Could not create room." });
    }
  });

  socket.on("join_room", ({ name, avatar, code }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ success: false, error: "Room not found! Check the code." });
    room.members[socket.id] = { socketId: socket.id, name, avatar, mic: false };
    socket.join(code);
    socket.data = { roomCode: code, name, avatar };
    socket.to(code).emit("member_joined", { socketId: socket.id, name, avatar });
    cb({ success: true, code, roomName: room.name, members: getMembers(code), videoState: room.videoState });
    console.log(`[Room] ${name} joined ${code}`);
  });

  socket.on("load_video", ({ videoId }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    rooms[code].videoState = { videoId, isPlaying: false, currentTime: 0, updatedAt: Date.now() };
    io.to(code).emit("load_video", { videoId, from: socket.data.name });
  });

  socket.on("play", ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    Object.assign(rooms[code].videoState, { isPlaying: true, currentTime, updatedAt: Date.now() });
    socket.to(code).emit("play", { currentTime, from: socket.data.name });
  });

  socket.on("pause", ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    Object.assign(rooms[code].videoState, { isPlaying: false, currentTime, updatedAt: Date.now() });
    socket.to(code).emit("pause", { currentTime, from: socket.data.name });
  });

  socket.on("seek", ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    Object.assign(rooms[code].videoState, { currentTime, updatedAt: Date.now() });
    socket.to(code).emit("seek", { currentTime, from: socket.data.name });
  });

  socket.on("sync_request", ({ currentTime }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    Object.assign(rooms[code].videoState, { currentTime, updatedAt: Date.now() });
    socket.to(code).emit("sync", { currentTime, from: socket.data.name });
  });

  socket.on("chat", ({ text }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    io.to(code).emit("chat", { text, from: socket.data.name, avatar: socket.data.avatar });
  });

  socket.on("reaction", ({ emoji }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    io.to(code).emit("reaction", { emoji, from: socket.data.name });
  });

  socket.on("mic_state", ({ active }) => {
    const code = socket.data?.roomCode;
    if (!rooms[code]) return;
    if (rooms[code].members[socket.id]) rooms[code].members[socket.id].mic = active;
    socket.to(code).emit("mic_state", { socketId: socket.id, active });
  });

  socket.on("webrtc_offer",  ({ to, offer })     => io.to(to).emit("webrtc_offer",  { from: socket.id, offer }));
  socket.on("webrtc_answer", ({ to, answer })    => io.to(to).emit("webrtc_answer", { from: socket.id, answer }));
  socket.on("webrtc_ice",    ({ to, candidate }) => io.to(to).emit("webrtc_ice",    { from: socket.id, candidate }));

  socket.on("disconnect", () => {
    const code = socket.data?.roomCode;
    if (code && rooms[code]) {
      const member = rooms[code].members[socket.id];
      if (member) {
        delete rooms[code].members[socket.id];
        socket.to(code).emit("member_left", { socketId: socket.id, name: member.name, avatar: member.avatar });
        if (Object.keys(rooms[code].members).length === 0) delete rooms[code];
        console.log(`[-] ${member.name} left ${code}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🌙 U Turn Watch Party → http://localhost:${PORT}`));
