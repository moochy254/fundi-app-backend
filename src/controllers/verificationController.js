const pool = require('../config/db');

// @desc Provider submits verification request
const submitVerification = async (req, res) => {
  const { id_number, id_type, certificate } = req.body;

  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can submit verification' });
    }

    if (!id_number || !id_type) {
      return res.status(400).json({ message: 'ID number and type are required' });
    }

    // Check if already submitted
    const existing = await pool.query(
      `SELECT * FROM verification_requests 
       WHERE provider_id = $1 AND status = 'pending'`,
      [req.user.id]
    );

    if (existing.rows[0]) {
      return res.status(400).json({ message: 'You already have a pending verification request' });
    }

    // Update provider profile status
    await pool.query(
      `UPDATE provider_profiles 
       SET verification_status = 'pending'
       WHERE user_id = $1`,
      [req.user.id]
    );

    // Create verification request
    const request = await pool.query(
      `INSERT INTO verification_requests 
       (provider_id, id_number, id_type, certificate)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, id_number, id_type, certificate]
    );

    res.status(201).json({
      message: 'Verification request submitted successfully! We will review within 24 hours.',
      request: request.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get verification status
const getVerificationStatus = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, pp.is_verified, pp.verification_status
       FROM verification_requests vr
       JOIN provider_profiles pp ON vr.provider_id = pp.user_id
       WHERE vr.provider_id = $1
       ORDER BY vr.created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (!result.rows[0]) {
      return res.json({ status: 'none', is_verified: false });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Admin approves or rejects verification
const reviewVerification = async (req, res) => {
  const { request_id, status, admin_note } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can review verifications' });
    }

    const request = await pool.query(
      'SELECT * FROM verification_requests WHERE id = $1',
      [request_id]
    );

    if (!request.rows[0]) {
      return res.status(404).json({ message: 'Verification request not found' });
    }

    // Update verification request
    await pool.query(
      `UPDATE verification_requests 
       SET status = $1, admin_note = $2
       WHERE id = $3`,
      [status, admin_note, request_id]
    );

    // Update provider profile
    await pool.query(
      `UPDATE provider_profiles
       SET is_verified = $1, verification_status = $2, verification_note = $3
       WHERE user_id = $4`,
      [
        status === 'approved',
        status,
        admin_note,
        request.rows[0].provider_id
      ]
    );

    res.json({ message: `Verification ${status} successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all pending verifications (admin)
const getPendingVerifications = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view verifications' });
    }

    const result = await pool.query(
      `SELECT vr.*, u.full_name, u.email, u.phone
       FROM verification_requests vr
       JOIN users u ON vr.provider_id = u.id
       WHERE vr.status = 'pending'
       ORDER BY vr.created_at ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  submitVerification,
  getVerificationStatus,
  reviewVerification,
  getPendingVerifications
};