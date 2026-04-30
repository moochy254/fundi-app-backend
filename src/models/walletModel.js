const pool = require('../config/db');

const CLIENT_COMMISSION_RATE = 0.03; // 3% from client
const PROVIDER_COMMISSION_RATE = 0.05; // 5% from provider

const createWallet = async (provider_id) => {
  const result = await pool.query(
    `INSERT INTO wallets (provider_id) VALUES ($1)
     ON CONFLICT (provider_id) DO NOTHING
     RETURNING *`,
    [provider_id]
  );
  return result.rows[0];
};

const getWalletByProviderId = async (provider_id) => {
  const result = await pool.query(
    `SELECT * FROM wallets WHERE provider_id = $1`,
    [provider_id]
  );
  return result.rows[0];
};

const creditWallet = async (provider_id, booking_id, amount) => {
  const commission = amount * PROVIDER_COMMISSION_RATE;
  const net_amount = amount - commission;

  // Get or create wallet
  await createWallet(provider_id);

  // Update wallet balance
  const wallet = await pool.query(
    `UPDATE wallets
     SET balance = balance + $1,
         total_earned = total_earned + $1
     WHERE provider_id = $2
     RETURNING *`,
    [net_amount, provider_id]
  );

  // Record transaction
  await pool.query(
    `INSERT INTO wallet_transactions
     (wallet_id, booking_id, type, amount, commission, description, status)
     VALUES ($1, $2, 'credit', $3, $4, $5, 'completed')`,
    [
      wallet.rows[0].id,
      booking_id,
      net_amount,
      commission,
      `Payment for booking #${booking_id}`
    ]
  );

  return wallet.rows[0];
};

const getWalletTransactions = async (provider_id) => {
  const result = await pool.query(
    `SELECT wt.*, w.provider_id
     FROM wallet_transactions wt
     JOIN wallets w ON wt.wallet_id = w.id
     WHERE w.provider_id = $1
     ORDER BY wt.created_at DESC`,
    [provider_id]
  );
  return result.rows;
};

const requestWithdrawal = async (provider_id, amount, phone) => {
  const wallet = await getWalletByProviderId(provider_id);

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  if (wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }

  if (amount < 100) {
    throw new Error('Minimum withdrawal amount is KES 100');
  }

  // Deduct from wallet
  await pool.query(
    `UPDATE wallets
     SET balance = balance - $1,
         total_withdrawn = total_withdrawn + $1
     WHERE provider_id = $2`,
    [amount, provider_id]
  );

  // Record transaction
  await pool.query(
    `INSERT INTO wallet_transactions
     (wallet_id, type, amount, description, status)
     VALUES ($1, 'withdrawal', $2, $3, 'pending')`,
    [wallet.id, amount, `Withdrawal request of KES ${amount}`]
  );

  // Create withdrawal request
  const request = await pool.query(
    `INSERT INTO withdrawal_requests (provider_id, wallet_id, amount, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [provider_id, wallet.id, amount, phone]
  );

  return request.rows[0];
};

module.exports = {
  createWallet,
  getWalletByProviderId,
  creditWallet,
  getWalletTransactions,
  requestWithdrawal,
  CLIENT_COMMISSION_RATE,
  PROVIDER_COMMISSION_RATE
};