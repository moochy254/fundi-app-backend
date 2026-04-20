const pool = require('../config/db');

const createProviderProfile = async (user_id, category_id, bio, location, latitude, longitude) => {
  const result = await pool.query(
    `INSERT INTO provider_profiles (user_id, category_id, bio, location, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user_id, category_id, bio, location, latitude, longitude]
  );
  return result.rows[0];
};

const getProviderByUserId = async (user_id) => {
  const result = await pool.query(
    `SELECT pp.*, u.full_name, u.email, u.phone, u.profile_image, c.name AS category
     FROM provider_profiles pp
     JOIN users u ON pp.user_id = u.id
     JOIN categories c ON pp.category_id = c.id
     WHERE pp.user_id = $1`,
    [user_id]
  );
  return result.rows[0];
};

const getAllProviders = async (category_id) => {
  let query = `
    SELECT pp.*, u.full_name, u.email, u.phone, u.profile_image, c.name AS category
    FROM provider_profiles pp
    JOIN users u ON pp.user_id = u.id
    JOIN categories c ON pp.category_id = c.id
    WHERE pp.is_available = true
  `;
  const params = [];

  if (category_id) {
    params.push(category_id);
    query += ` AND pp.category_id = $1`;
  }

  query += ` ORDER BY pp.rating DESC`;
  const result = await pool.query(query, params);
  return result.rows;
};

const updateProviderProfile = async (user_id, fields) => {
  const { category_id, bio, location, latitude, longitude, is_available } = fields;
  const result = await pool.query(
    `UPDATE provider_profiles
     SET category_id = COALESCE($1, category_id),
         bio = COALESCE($2, bio),
         location = COALESCE($3, location),
         latitude = COALESCE($4, latitude),
         longitude = COALESCE($5, longitude),
         is_available = COALESCE($6, is_available)
     WHERE user_id = $7
     RETURNING *`,
    [category_id, bio, location, latitude, longitude, is_available, user_id]
  );
  return result.rows[0];
};

const getNearbyProviders = async (latitude, longitude, category_id, radius = 10) => {
  let query = `
    SELECT * FROM (
      SELECT pp.*, u.full_name, u.phone, u.profile_image, c.name AS category,
      (6371 * acos(
        GREATEST(-1, LEAST(1,
          cos(radians($1)) * cos(radians(pp.latitude)) *
          cos(radians(pp.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(pp.latitude))
        ))
      )) AS distance
      FROM provider_profiles pp
      JOIN users u ON pp.user_id = u.id
      JOIN categories c ON pp.category_id = c.id
      WHERE pp.is_available = true
  `;

  const params = [latitude, longitude];

  if (category_id) {
    params.push(category_id);
    query += ` AND pp.category_id = $${params.length}`;
  }

  params.push(radius);
  query += `
    ) AS providers_with_distance
    WHERE distance < $${params.length}
    ORDER BY distance ASC
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

module.exports = {
  createProviderProfile,
  getProviderByUserId,
  getAllProviders,
  updateProviderProfile,
  getNearbyProviders
};