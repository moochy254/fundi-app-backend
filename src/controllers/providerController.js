const {
  createProviderProfile,
  getProviderByUserId,
  getAllProviders,
  updateProviderProfile,
  getNearbyProviders
} = require('../models/providerModel');

// @desc Create provider profile
const createProfile = async (req, res) => {
  const { category_id, bio, location, latitude, longitude } = req.body;

  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only service providers can create a profile' });
    }

    const existing = await getProviderByUserId(req.user.id);
    if (existing) {
      return res.status(400).json({ message: 'Provider profile already exists' });
    }

    if (!category_id || !location) {
      return res.status(400).json({ message: 'Category and location are required' });
    }

    const profile = await createProviderProfile(
      req.user.id, category_id, bio, location, latitude, longitude
    );

    res.status(201).json({ message: 'Profile created successfully', profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get my provider profile
const getMyProfile = async (req, res) => {
  try {
    const profile = await getProviderByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get all available providers (optionally filter by category)
const getProviders = async (req, res) => {
  const { category_id } = req.query;
  try {
    const providers = await getAllProviders(category_id);
    res.json(providers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Update provider profile
const updateProfile = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can update their profile' });
    }

    const updated = await updateProviderProfile(req.user.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: 'Provider profile not found' });
    }

    res.json({ message: 'Profile updated successfully', profile: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get nearby providers based on location
const getNearby = async (req, res) => {
  const { latitude, longitude, category_id, radius } = req.query;

  try {
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const providers = await getNearbyProviders(latitude, longitude, category_id, radius);
    res.json(providers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createProfile, getMyProfile, getProviders, updateProfile, getNearby };