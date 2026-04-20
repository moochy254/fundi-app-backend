const pool = require('../config/db');

const createUser = async (full_name, email, phone, password, role) => {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, phone, password, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, phone, role`,
    [full_name, email, phone, password, role]
  );
  return result.rows[0];
};

const findUserByEmail = async (email) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1`, [email]
  );
  return result.rows[0];
};

const findUserByPhone = async (phone) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE phone = $1`, [phone]
  );
  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await pool.query(
    `SELECT id, full_name, email, phone, role, profile_image, is_verified, created_at 
     FROM users WHERE id = $1`, [id]
  );
  return result.rows[0];
};

module.exports = { createUser, findUserByEmail, findUserByPhone, findUserById };