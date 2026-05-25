const {
  getWalletByProviderId,
  getWalletTransactions,
  requestWithdrawal,
  createWallet
} = require('../models/walletModel');
const { b2cPayment } = require('../config/mpesa');
const pool = require('../config/db');

// @desc Get provider wallet
const getWallet = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can access wallet' });
    }

    let wallet = await getWalletByProviderId(req.user.id);
    if (!wallet) {
      wallet = await createWallet(req.user.id);
    }

    res.json(wallet);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Get wallet transactions
const getTransactions = async (req, res) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can access transactions' });
    }

    const transactions = await getWalletTransactions(req.user.id);
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Request withdrawal with automatic M-Pesa B2C
const withdraw = async (req, res) => {
  const { amount, phone } = req.body;

  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can withdraw' });
    }

    if (!amount || !phone) {
      return res.status(400).json({ message: 'Amount and phone are required' });
    }

    if (parseFloat(amount) < 100) {
      return res.status(400).json({ message: 'Minimum withdrawal is KES 100' });
    }

    let wallet = await getWalletByProviderId(req.user.id);
    if (!wallet) {
      wallet = await createWallet(req.user.id);
    }

    if (parseFloat(wallet.balance) < parseFloat(amount)) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Create withdrawal request
    const withdrawal = await pool.query(
      `INSERT INTO withdrawal_requests (provider_id, wallet_id, amount, phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, wallet.id, amount, phone]
    );

    const withdrawalId = withdrawal.rows[0].id;

    // Deduct from wallet immediately
    await pool.query(
      `UPDATE wallets
       SET balance = balance - $1,
           total_withdrawn = total_withdrawn + $1
       WHERE provider_id = $2`,
      [amount, req.user.id]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO wallet_transactions
       (wallet_id, type, amount, description, status)
       VALUES ($1, 'withdrawal', $2, $3, 'pending')`,
      [wallet.id, amount, `Withdrawal request of KES ${amount}`]
    );

    // Initiate M-Pesa B2C payment
    try {
      const b2cResponse = await b2cPayment(phone, amount, withdrawalId);
      console.log('B2C Response:', b2cResponse);

      // Update withdrawal status
      await pool.query(
        `UPDATE withdrawal_requests SET status = 'completed'
         WHERE id = $1`,
        [withdrawalId]
      );

      res.json({
        message: `✅ KES ${amount} sent to ${phone} via M-Pesa successfully!`,
        withdrawal: withdrawal.rows[0]
      });
    } catch (mpesaError) {
      // If B2C fails restore wallet balance
      await pool.query(
        `UPDATE wallets
         SET balance = balance + $1,
             total_withdrawn = total_withdrawn - $1
         WHERE provider_id = $2`,
        [amount, req.user.id]
      );

      await pool.query(
        `UPDATE withdrawal_requests SET status = 'failed'
         WHERE id = $1`,
        [withdrawalId]
      );

      console.error('B2C failed:', mpesaError.message);
      res.status(500).json({
        message: 'M-Pesa payment failed. Your balance has been restored.',
        error: mpesaError.message
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Withdrawal failed' });
  }
};

// @desc B2C Result Callback
const b2cResult = async (req, res) => {
  try {
    const { Result } = req.body;
    console.log('B2C Result:', JSON.stringify(Result));

    if (Result.ResultCode === 0) {
      console.log('✅ B2C Payment successful');
    } else {
      console.log('❌ B2C Payment failed:', Result.ResultDesc);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('B2C Result error:', error);
    res.status(500).json({ message: 'Error processing B2C result' });
  }
};

// @desc B2C Timeout Callback
const b2cTimeout = async (req, res) => {
  try {
    console.log('B2C Timeout:', JSON.stringify(req.body));
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('B2C Timeout error:', error);
    res.status(500).json({ message: 'Error processing B2C timeout' });
  }
};

module.exports = { getWallet, getTransactions, withdraw, b2cResult, b2cTimeout };
