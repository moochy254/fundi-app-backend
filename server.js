const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const providerRoutes = require('./src/routes/providerRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const passwordRoutes = require('./src/routes/passwordRoutes');
const verificationRoutes = require('./src/routes/verificationRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const photoRoutes = require('./src/routes/photoRoutes');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: '🚀 Fundi App API is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/photos', photoRoutes);

// Socket.io real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a chat room
  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`User joined chat: ${chatId}`);
  });

  // Send a message
  socket.on('send_message', async (data) => {
    const { chat_id, sender_id, message } = data;
    try {
      const pool = require('./src/config/db');
      const result = await pool.query(
        `INSERT INTO messages (chat_id, sender_id, message)
         VALUES ($1, $2, $3) RETURNING *`,
        [chat_id, sender_id, message]
      );
      // Broadcast message to all users in the chat room
      io.to(`chat_${chat_id}`).emit('receive_message', result.rows[0]);
    } catch (error) {
      console.error('Message error:', error);
    }
  });

  // Mark messages as read
  socket.on('mark_read', async (data) => {
    const { chat_id, user_id } = data;
    try {
      const pool = require('./src/config/db');
      await pool.query(
        `UPDATE messages SET is_read = true
         WHERE chat_id = $1 AND sender_id != $2`,
        [chat_id, user_id]
      );
      io.to(`chat_${chat_id}`).emit('messages_read', { chat_id, user_id });
    } catch (error) {
      console.error('Mark read error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get('/fix-withdrawal', async (req, res) => {
  const pool = require('./src/config/db');
  try {
    await pool.query(`
      ALTER TABLE withdrawal_requests 
      DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
      
      ALTER TABLE withdrawal_requests 
      ADD CONSTRAINT withdrawal_requests_status_check 
      CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed'));
    `);
    res.json({ message: '✅ Constraint fixed!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { io };