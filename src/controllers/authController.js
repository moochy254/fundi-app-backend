const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, findUserByEmail, findUserByPhone, findUserById } = require('../models/userModel');
require('dotenv').config();

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// @desc Register a new user
const registerUser = async (req, res) => {
  const { full_name, email, phone, password, role } = req.body;

  try {
    // Validate fields
    if (!full_name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!['client', 'provider'].includes(role)) {
      return res.status(400).json({ message: 'Role must be client or provider' });
    }

    // Check if email exists
    const emailExists = await findUserByEmail(email);
    if (emailExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Check if phone exists
    const phoneExists = await findUserByPhone(phone);
    if (phoneExists) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await createUser(full_name, email, phone, hashedPassword, role);

    // Return token
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token: generateToken(user),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// @desc Login user
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token: generateToken(user),
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc Get logged in user profile
const getProfile = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { registerUser, loginUser, getProfile };