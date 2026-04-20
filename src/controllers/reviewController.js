const {
  createReview,
  getProviderReviews,
  checkExistingReview,
  updateProviderRating
} = require('../models/reviewModel');
const { getBookingById } = require('../models/bookingModel');

// @desc Client submits a review after completed booking
const submitReview = async (req, res) => {
  const { booking_id, rating, comment } = req.body;

  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Only clients can submit reviews' });
    }

    if (!booking_id || !rating) {
      return res.status(400).json({ message: 'Booking ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check booking exists and belongs to this client
    const booking = await getBookingById(booking_id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.client_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only review your own bookings' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'You can only review completed bookings' });
    }

    // Check if already reviewed
    const existing = await checkExistingReview(booking_id);
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this booking' });
    }

    // Create review
    const review = await createReview(
      booking_id,
      req.user.id,
      booking.provider_id,
      rating,
      comment
    );

    // Update provider average rating
    await updateProviderRating(booking.provider_id);

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all reviews for a provider
const getReviews = async (req, res) => {
  const { provider_id } = req.params;

  try {
    const reviews = await getProviderReviews(provider_id);
    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { submitReview, getReviews };