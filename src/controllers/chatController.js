const pool = require('../config/db');

// @desc Create or get chat for a booking
const getOrCreateChat = async (req, res) => {
  const { booking_id } = req.params;

  try {
    // Check if chat already exists
    const existing = await pool.query(
      'SELECT * FROM chats WHERE booking_id = $1',
      [booking_id]
    );

    if (existing.rows[0]) {
      return res.json(existing.rows[0]);
    }

    // Get booking details
    const booking = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [booking_id]
    );

    if (!booking.rows[0]) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check user is part of this booking
    if (
      booking.rows[0].client_id !== req.user.id &&
      booking.rows[0].provider_id !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create new chat
    const chat = await pool.query(
      `INSERT INTO chats (booking_id, client_id, provider_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [booking_id, booking.rows[0].client_id, booking.rows[0].provider_id]
    );

    res.status(201).json(chat.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get chat messages
const getChatMessages = async (req, res) => {
  const { chat_id } = req.params;

  try {
    const messages = await pool.query(
      `SELECT m.*, u.full_name AS sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1
       ORDER BY m.created_at ASC`,
      [chat_id]
    );

    res.json(messages.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all chats for a user
const getUserChats = async (req, res) => {
  try {
    const chats = await pool.query(
      `SELECT c.*,
        b.description AS booking_description,
        b.status AS booking_status,
        b.agreed_price,
        client.full_name AS client_name,
        provider.full_name AS provider_name,
        cat.name AS category,
        (SELECT message FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_time,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND sender_id != $1 AND is_read = false) AS unread_count
       FROM chats c
       JOIN bookings b ON c.booking_id = b.id
       JOIN users client ON c.client_id = client.id
       JOIN users provider ON c.provider_id = provider.id
       JOIN categories cat ON b.category_id = cat.id
       WHERE c.client_id = $1 OR c.provider_id = $1
       ORDER BY last_message_time DESC NULLS LAST`,
      [req.user.id]
    );

    res.json(chats.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getOrCreateChat, getChatMessages, getUserChats };