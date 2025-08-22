// server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// **THE FIX IS HERE:** We rely solely on the port provided by the environment (Render).
// This is more stable for production deployments.
const PORT = process.env.PORT;

if (!PORT) {
    throw new Error("PORT environment variable is not set. The application cannot start.");
}

const CHAT_ID = 'global_chatroom';

// --- In-memory Data Store ---
const users = {}; 
const messages = []; 

// --- API Endpoints ---
app.get('/', (req, res) => res.send('Chat server is running!'));
app.get('/api/messages/global_chatroom', (req, res) => res.json(messages));
app.get('/api/users', (req, res) => {
    const activeUsers = Object.values(users).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
    }, {});
    res.json(activeUsers);
});

// --- Socket.IO Middleware for Authentication ---
io.use((socket, next) => {
    const user = socket.handshake.auth.user;
    if (!user || !user.id || !user.name) {
        return next(new Error('Invalid user details'));
    }
    socket.user = user;
    next();
});

// --- Socket.IO Real-time Logic ---
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.id})`);
  users[socket.id] = socket.user;
  socket.broadcast.emit('user joined', socket.user);
  
  const activeUsers = Object.values(users).reduce((acc, u) => {
    acc[u.id] = u;
    return acc;
  }, {});
  socket.emit('active users', activeUsers);

  socket.on('joinRoom', (chatId) => {
    socket.join(chatId);
    console.log(`${socket.user.name} joined room: ${chatId}`);
  });

  socket.on('sendMessage', (data) => {
    const { chatId, message } = data;
    messages.push(message); 
    socket.to(chatId).emit('newMessage', message);
  });

  socket.on('typing', (data) => {
    socket.to(CHAT_ID).emit('typing', { user: socket.user, isTyping: data.isTyping });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.name} (${socket.id})`);
    const disconnectedUser = users[socket.id];
    delete users[socket.id];
    if (disconnectedUser) {
        io.emit('user left', disconnectedUser.id);
    }
  });
});

// --- START THE SERVER ---
server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
