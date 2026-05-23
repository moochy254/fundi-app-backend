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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Temporary migration route - DELETE AFTER USE
app.get('/migrate', async (req, res) => {
  const pool = require('./src/config/db');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('client', 'provider', 'admin')) NOT NULL,
        profile_image VARCHAR(255),
        is_verified BOOLEAN DEFAULT false,
        push_token VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS provider_profiles (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        category_id INT REFERENCES categories(id),
        bio TEXT,
        location VARCHAR(255),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        is_available BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        verification_status VARCHAR(20) DEFAULT 'none',
        verification_note TEXT,
        rating DECIMAL(3,2) DEFAULT 0.00,
        total_jobs INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        client_id INT REFERENCES users(id) ON DELETE CASCADE,
        provider_id INT REFERENCES users(id) ON DELETE CASCADE,
        category_id INT REFERENCES categories(id),
        description TEXT,
        status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'paid', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
        location VARCHAR(255),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        scheduled_at TIMESTAMP,
        agreed_price DECIMAL(10,2) DEFAULT 0.00,
        client_confirmed BOOLEAN DEFAULT false,
        payment_released BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
        client_id INT REFERENCES users(id),
        provider_id INT REFERENCES users(id),
        rating INT CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
        client_id INT REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        mpesa_code VARCHAR(50),
        checkout_request_id VARCHAR(100),
        status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
        booking_status_updated BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        provider_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        balance DECIMAL(10,2) DEFAULT 0.00,
        total_earned DECIMAL(10,2) DEFAULT 0.00,
        total_withdrawn DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INT REFERENCES wallets(id) ON DELETE CASCADE,
        booking_id INT REFERENCES bookings(id),
        type VARCHAR(20) CHECK (type IN ('credit', 'debit', 'withdrawal')) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        commission DECIMAL(10,2) DEFAULT 0.00,
        description TEXT,
        status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id SERIAL PRIMARY KEY,
        provider_id INT REFERENCES users(id) ON DELETE CASCADE,
        wallet_id INT REFERENCES wallets(id),
        amount DECIMAL(10,2) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
        client_id INT REFERENCES users(id),
        provider_id INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id INT REFERENCES chats(id) ON DELETE CASCADE,
        sender_id INT REFERENCES users(id),
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS otp_codes (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS verification_requests (
        id SERIAL PRIMARY KEY,
        provider_id INT REFERENCES users(id) ON DELETE CASCADE,
        id_number VARCHAR(50) NOT NULL,
        id_type VARCHAR(20) CHECK (id_type IN ('national_id', 'passport', 'driving_license')) NOT NULL,
        certificate TEXT,
        status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS booking_photos (
        id SERIAL PRIMARY KEY,
        booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
        uploaded_by INT REFERENCES users(id),
        photo_url TEXT NOT NULL,
        photo_type VARCHAR(20) CHECK (photo_type IN ('problem', 'before', 'after', 'other')) DEFAULT 'other',
        created_at TIMESTAMP DEFAULT NOW()
      );
      INSERT INTO categories (name) VALUES
      ('Plumbing'),('Electrical'),('Cleaning'),('Carpentry'),
      ('Painting'),('Gardening'),('Security'),('Appliance Repair')
      ON CONFLICT DO NOTHING;
    `);
    res.json({ message: '✅ All tables created successfully!' });
  } catch (error) {
    res.status(500).json({ message: '❌ Migration failed', error: error.message });
  }
});
module.exports = { io };