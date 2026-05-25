require('dotenv').config();
const axios = require('axios');

const getAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw new Error('Failed to get M-Pesa access token');
  }
};

const stkPush = async (phone, amount, bookingId) => {
  try {
    const token = await getAccessToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14);

    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const formattedPhone = phone.startsWith('0')
      ? `254${phone.slice(1)}`
      : phone;

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: `FundiApp-${bookingId}`,
        TransactionDesc: `Payment for booking ${bookingId}`,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    throw new Error('Failed to initiate M-Pesa payment');
  }
};

const b2cPayment = async (phone, amount, withdrawalId) => {
  try {
    const token = await getAccessToken();

    const formattedPhone = phone.startsWith('0')
      ? `254${phone.slice(1)}`
      : phone;

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
      {
        OriginatorConversationID: `withdrawal-${withdrawalId}-${Date.now()}`,
        InitiatorName: process.env.MPESA_INITIATOR_NAME,
        SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
        CommandID: 'BusinessPayment',
        Amount: amount,
        PartyA: process.env.MPESA_SHORTCODE,
        PartyB: formattedPhone,
        Remarks: `FundiApp withdrawal ${withdrawalId}`,
        QueueTimeOutURL: `${process.env.MPESA_CALLBACK_URL}/b2c/timeout`,
        ResultURL: `${process.env.MPESA_CALLBACK_URL}/b2c/result`,
        Occasion: `Withdrawal ${withdrawalId}`,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  } catch (error) {
    console.error('B2C error:', error.response?.data || error.message);
    throw new Error('Failed to initiate B2C payment');
  }
};

module.exports = { getAccessToken, stkPush, b2cPayment };