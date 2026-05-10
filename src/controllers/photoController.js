const { uploadImage } = require('../config/cloudinary');
const pool = require('../config/db');
const fs = require('fs');

// @desc Upload photos for a booking
const uploadBookingPhotos = async (req, res) => {
  const { booking_id, photo_type } = req.body;

  try {
    if (!booking_id) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }

    // Check booking exists
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

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    const uploadedPhotos = [];

    // Upload each photo to Cloudinary
    for (const file of req.files) {
      const photoUrl = await uploadImage(file.path, `bookings/${booking_id}`);

      // Save to database
      const photo = await pool.query(
        `INSERT INTO booking_photos (booking_id, uploaded_by, photo_url, photo_type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [booking_id, req.user.id, photoUrl, photo_type || 'other']
      );

      uploadedPhotos.push(photo.rows[0]);

      // Delete temp file
      fs.unlinkSync(file.path);
    }

    res.status(201).json({
      message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
      photos: uploadedPhotos
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload photos' });
  }
};

// @desc Get photos for a booking
const getBookingPhotos = async (req, res) => {
  const { booking_id } = req.params;

  try {
    const photos = await pool.query(
      `SELECT bp.*, u.full_name AS uploaded_by_name
       FROM booking_photos bp
       JOIN users u ON bp.uploaded_by = u.id
       WHERE bp.booking_id = $1
       ORDER BY bp.created_at ASC`,
      [booking_id]
    );

    res.json(photos.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Upload profile photo
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    const photoUrl = await uploadImage(req.file.path, 'profiles');

    // Update user profile image
    await pool.query(
      'UPDATE users SET profile_image = $1 WHERE id = $2',
      [photoUrl, req.user.id]
    );

    // Delete temp file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Profile photo updated successfully',
      photo_url: photoUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to upload profile photo' });
  }
};

module.exports = { uploadBookingPhotos, getBookingPhotos, uploadProfilePhoto };