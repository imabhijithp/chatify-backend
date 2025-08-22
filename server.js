// server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors()); // Enable CORS for all routes

const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = new Server(server, {
  cors: {
    origin: "*", // In production, you should restrict this to your frontend's URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// --- MOCK DATA (same as frontend for consistency) ---
const mockUsers = {
  'user1': { name: 'You', avatar: 'https://placehold.co/100x100/3B82F6/FFFFFF?text=You' },
  'user2': { name: 'Alice', avatar: 'https://placehold.co/100x100/F97316/FFFFFF?text=A' },
  'user3': { name: 'Bob', avatar: 'https://placehold.co/100x100/10B981/FFFFFF?text=B' },
};

const mockChats = [
  { id: 'chat1', members: ['user1', 'user2'], lastMessage: 'Sounds good! See you then.', timestamp: '10:42 AM', unread: 0, typing: false, online: true, },
  { id: 'chat2', members: ['user1', 'user3'], lastMessage: 'Can you send me the file?', timestamp: 'Yesterday', unread: 2, typing: true, online: false, },
];

const mockMessages = {
  'chat1': [
    { id: 'msg1', senderId: 'user2', content: 'Hey, are we still on for lunch tomorrow?', timestamp: '10:40 AM', status: 'seen' },
    { id: 'msg2', senderId: 'user1', content: 'Yep! 1 PM at the usual spot.', timestamp: '10:41 AM', status: 'seen' },
    { id: 'msg3', senderId: 'user2', content: 'Sounds good! See you then.', timestamp: '10:42 AM', status: 'sent' },
  ],
  'chat2': [
    { id: 'msg4', senderId: 'user3', content: 'Hey, I need the report we discussed.', timestamp: 'Yesterday', status: 'seen' },
    { id: 'msg5', senderId: 'user1', content: 'Sure, I\'m just finishing it up. I\'ll send it over in a bit.', timestamp: 'Yesterday', status: 'delivered' },
    { id: 'msg6', senderId: 'user3', content: 'Thanks!', timestamp: 'Yesterday', status: 'seen' },
    { id: 'msg7', senderId: 'user3', content: 'Can you send me the file?', timestamp: 'Yesterday', status: 'delivered' },
  ],
};
// --- END MOCK DATA ---


// --- API ENDPOINTS ---
app.get('/', (req, res) => {
  res.send('Chat server is running!');
});

app.get('/api/chats', (req, res) => {
  console.log('GET /api/chats');
  res.json(mockChats);
});

app.get('/api/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  console.log(`GET /api/messages/${chatId}`);
  res.json(mockMessages[chatId] || []);
});

app.get('/api/users', (req, res) => {
    console.log('GET /api/users');
    res.json(mockUsers);
});


// --- SOCKET.IO REAL-TIME LOGIC ---
io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);

  // When a user joins a specific chat room
  socket.on('joinRoom', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined room: ${chatId}`);
  });

  // When a user sends a message
  socket.on('sendMessage', (data) => {
    const { chatId, message } = data;
    console.log(`Message received for chat ${chatId}:`, message);
    
    // In a real app, you'd save this to the database here.
    if(mockMessages[chatId]) {
        mockMessages[chatId].push(message);
    } else {
        mockMessages[chatId] = [message];
    }

    // *** THE FIX IS HERE ***
    // Broadcast the new message to everyone in the chat room EXCEPT the sender
    socket.to(chatId).emit('newMessage', message);
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { chatId, isTyping } = data;
    // Broadcast to everyone in the room *except* the sender
    socket.to(chatId).emit('typing', { isTyping, chatId });
  });

  // When a user disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});


// --- START THE SERVER ---
server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
