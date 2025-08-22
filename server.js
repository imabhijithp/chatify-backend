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

const PORT = process.env.PORT || 3001;
const CHAT_ID = 'global_chatroom';

// --- In-memory Data Store ---
// In a real app, this would be a database
const users = {}; // Stores active users { socketId: { id, name, avatar } }
const messages = []; // Stores messages for the global chat room

// --- API Endpoints ---
app.get('/', (req, res) => res.send('Chat server is running!'));

// Get all messages for the global chat
app.get('/api/messages/global_chatroom', (req, res) => {
  res.json(messages);
});

// Get all currently active users
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

  // Store user details
  users[socket.id] = socket.user;

  // Notify all other clients that a new user has joined
  socket.broadcast.emit('user joined', socket.user);
  
  // Send the current list of active users to the newly connected client
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
    messages.push(message); // Save message to our in-memory store
    // Broadcast the message to everyone else in the room
    socket.to(chatId).emit('newMessage', message);
  });

  socket.on('typing', (data) => {
    socket.to(CHAT_ID).emit('typing', { user: socket.user, isTyping: data.isTyping });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.name} (${socket.id})`);
    // Remove user from our store
    const disconnectedUser = users[socket.id];
    delete users[socket.id];
    // Notify all other clients that this user has left
    if (disconnectedUser) {
        io.emit('user left', disconnectedUser.id);
    }
  });
});


// --- START THE SERVER ---
server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
