const {
  getWalletByProviderId,
  getWalletTransactions,
  requestWithdrawal,
  createWallet
} = require('../models/walletModel');

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

// @desc Request withdrawal
const withdraw = async (req, res) => {
  const { amount, phone } = req.body;

  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ message: 'Only providers can withdraw' });
    }

    if (!amount || !phone) {
      return res.status(400).json({ message: 'Amount and phone are required' });
    }

    const request = await requestWithdrawal(req.user.id, amount, phone);
    res.json({
      message: 'Withdrawal request submitted successfully',
      request
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message || 'Withdrawal failed' });
  }
};

module.exports = { getWallet, getTransactions, withdraw };