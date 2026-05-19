const {
  createBooking,
  getBookingById,
  getClientBookings,
  getProviderBookings,
  updateBookingStatus
} = require('../models/bookingModel');
const pool = require('../config/db');
const axios = require('axios');
const { creditWallet } = require('../models/walletModel');

// Helper function to send push notification
const sendNotification = async (userId, title, body) => {
  try {
    const result = await pool.query(
      'SELECT push_token FROM users WHERE id = $1',
      [userId]
    );
    const pushToken = result.rows[0]?.push_token;
    if (!pushToken) return;

    await axios.post('https://exp.host/--/api/v2/push/send', {
      to: pushToken,
      sound: 'default',
      title,
      body,
    });
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};

// @desc Client creates a booking
const makeBooking = async (req, res) => {
  const { provider_id, category_id, description, location, latitude, longitude, scheduled_at, agreed_price } = req.body;

  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Only clients can make bookings' });
    }

    if (!provider_id || !category_id || !location) {
      return res.status(400).json({ message: 'Provider, category and location are required' });
    }

    const booking = await createBooking(
      req.user.id, provider_id, category_id,
      description, location, latitude, longitude, scheduled_at
    );

    // Save agreed price
    await pool.query(
      'UPDATE bookings SET agreed_price = $1 WHERE id = $2',
      [agreed_price || 0, booking.id]
    );

    // Notify provider
    await sendNotification(
      provider_id,
      'New Booking Request!',
      `You have a new booking request for ${location}`
    );

    res.status(201).json({
      message: 'Booking created successfully',
      booking: { ...booking, agreed_price: agreed_price || 0 }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get a single booking
const getBooking = async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.client_id !== req.user.id && booking.provider_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this booking' });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all bookings for logged in client
const myClientBookings = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Only clients can access this' });
    }
    const bookings = await getClientBookings(req.user.id);
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all bookings for logged in provider
const myProviderBookings = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can access this' });
    }
    const bookings = await getProviderBookings(req.user.id);
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Update booking status
const updateStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['accepted','paid','in_progress', 'completed', 'cancelled'];

  try {
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const booking = await getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (status === 'cancelled' && booking.client_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the client can cancel a booking' });
    }

    if (['accepted', 'in_progress', 'completed'].includes(status) && booking.provider_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the provider can update this status' });
    }

    const updated = await updateBookingStatus(req.params.id, status);

    // Send notifications based on status
    if (status === 'accepted') {
      await sendNotification(
        booking.client_id,
        'Booking Accepted!',
        'Your booking has been accepted by the provider'
      );
    } else if (status === 'in_progress') {
      await sendNotification(
        booking.client_id,
        'Job Started!',
        'Your service provider is now working on your request'
      );
    } else if (status === 'completed') {
      await sendNotification(
        booking.client_id,
        'Job Completed!',
        'Your service has been completed. Please confirm to release payment!'
      );
    } else if (status === 'cancelled') {
      await sendNotification(
        booking.provider_id,
        'Booking Cancelled',
        'A client has cancelled their booking'
      );
    }

    res.json({ message: 'Booking status updated', booking: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Client confirms job completion and releases payment
const confirmJob = async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.client_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the client can confirm this job' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Job must be marked completed by provider first' });
    }

    if (booking.payment_released) {
      return res.status(400).json({ message: 'Payment already released' });
    }

    if (!booking.agreed_price || booking.agreed_price <= 0) {
      return res.status(400).json({ message: 'No agreed price found for this booking' });
    }

    // Confirm job and release payment
    await pool.query(
      `UPDATE bookings SET client_confirmed = true, payment_released = true WHERE id = $1`,
      [id]
    );

    // Credit provider wallet (after 5% commission deduction)
    await creditWallet(booking.provider_id, id, booking.agreed_price);

    // Notify provider
    await sendNotification(
      booking.provider_id,
      'Payment Released!',
      `Client confirmed job completion. KES ${(booking.agreed_price * 0.95).toFixed(2)} added to your wallet!`
    );

    res.json({ message: 'Job confirmed and payment released to provider wallet!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  makeBooking,
  getBooking,
  myClientBookings,
  myProviderBookings,
  updateStatus,
  confirmJob
};