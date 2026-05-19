const { stkPush } = require('../config/mpesa');
const pool = require('../config/db');

// @desc Initiate M-Pesa STK Push
const initiatePayment = async (req, res) => {
  const { booking_id, amount, phone } = req.body;

  try {
    if (!booking_id || !amount || !phone) {
      return res.status(400).json({ message: 'Booking ID, amount and phone are required' });
    }

    // Check booking exists and belongs to client
    const booking = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND client_id = $2',
      [booking_id, req.user.id]
    );

    if (!booking.rows[0]) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Initiate STK Push
    const mpesaResponse = await stkPush(phone, amount, booking_id);

    // Save payment record
    await pool.query(
      `INSERT INTO payments (booking_id, client_id, amount, phone, checkout_request_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [booking_id, req.user.id, amount, phone, mpesaResponse.CheckoutRequestID]
    );

    res.json({
      message: 'Payment initiated! Check your phone for M-Pesa prompt.',
      checkoutRequestId: mpesaResponse.CheckoutRequestID,
    });

  } catch (error) {
    console.error('Payment error:', error.message);
    res.status(500).json({ message: error.message || 'Payment initiation failed' });
  }
};

// @desc M-Pesa Callback
const mpesaCallback = async (req, res) => {
  const { Body } = req.body;

  try {
    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode } = stkCallback;

    if (ResultCode === 0) {
      const mpesaCode = stkCallback.CallbackMetadata.Item.find(
        item => item.Name === 'MpesaReceiptNumber'
      )?.Value;

      // Update payment status
      const payment = await pool.query(
        `UPDATE payments SET status = 'completed', mpesa_code = $1
         WHERE checkout_request_id = $2
         RETURNING *`,
        [mpesaCode, CheckoutRequestID]
      );

      // Update booking status to paid
      if (payment.rows[0]) {
        await pool.query(
          `UPDATE bookings SET status = 'paid'
           WHERE id = $1`,
          [payment.rows[0].booking_id]
        );

        // Notify provider that payment is received
        const booking = await pool.query(
          'SELECT * FROM bookings WHERE id = $1',
          [payment.rows[0].booking_id]
        );

        if (booking.rows[0]) {
          await sendNotification(
            booking.rows[0].provider_id,
            'Payment Received!',
            `Client has paid KES ${payment.rows[0].amount}. You can now start the job!`
          );
        }
      }

      console.log('✅ Payment successful:', mpesaCode);
    } else {
      await pool.query(
        `UPDATE payments SET status = 'failed'
         WHERE checkout_request_id = $1`,
        [CheckoutRequestID]
      );
      console.log('❌ Payment failed');
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ message: 'Callback processing failed' });
  }
};

// @desc Check payment status
const checkPaymentStatus = async (req, res) => {
  const { booking_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
      [booking_id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'No payment found for this booking' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { initiatePayment, mpesaCallback, checkPaymentStatus };