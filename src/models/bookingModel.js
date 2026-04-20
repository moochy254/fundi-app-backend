const pool = require('../config/db');

const createBooking = async (client_id, provider_id, category_id, description, location, latitude, longitude, scheduled_at) => {
  const result = await pool.query(
    `INSERT INTO bookings (client_id, provider_id, category_id, description, location, latitude, longitude, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [client_id, provider_id, category_id, description, location, latitude, longitude, scheduled_at]
  );
  return result.rows[0];
};

const getBookingById = async (id) => {
  const result = await pool.query(
    `SELECT b.*, 
      c.full_name AS client_name, c.phone AS client_phone,
      p.full_name AS provider_name, p.phone AS provider_phone,
      cat.name AS category
     FROM bookings b
     JOIN users c ON b.client_id = c.id
     JOIN users p ON b.provider_id = p.id
     JOIN categories cat ON b.category_id = cat.id
     WHERE b.id = $1`,
    [id]
  );
  return result.rows[0];
};

const getClientBookings = async (client_id) => {
  const result = await pool.query(
    `SELECT b.*, 
      p.full_name AS provider_name, p.phone AS provider_phone,
      cat.name AS category
     FROM bookings b
     JOIN users p ON b.provider_id = p.id
     JOIN categories cat ON b.category_id = cat.id
     WHERE b.client_id = $1
     ORDER BY b.created_at DESC`,
    [client_id]
  );
  return result.rows;
};

const getProviderBookings = async (provider_id) => {
  const result = await pool.query(
    `SELECT b.*, 
      c.full_name AS client_name, c.phone AS client_phone,
      cat.name AS category
     FROM bookings b
     JOIN users c ON b.client_id = c.id
     JOIN categories cat ON b.category_id = cat.id
     WHERE b.provider_id = $1
     ORDER BY b.created_at DESC`,
    [provider_id]
  );
  return result.rows;
};

const updateBookingStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0];
};

module.exports = {
  createBooking,
  getBookingById,
  getClientBookings,
  getProviderBookings,
  updateBookingStatus
};