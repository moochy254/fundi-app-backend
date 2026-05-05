require('dotenv').config();
const axios = require('axios');

const sendSMS = async (phone, message) => {
  try {
    // Format phone number for Kenya
    const formattedPhone = phone.startsWith('0')
      ? `+254${phone.slice(1)}`
      : phone.startsWith('254')
      ? `+${phone}`
      : phone;

    console.log('Sending SMS to:', formattedPhone);
    console.log('Using username:', process.env.AT_USERNAME);
    console.log('API Key starts with:', process.env.AT_API_KEY?.substring(0, 10));

    const response = await axios.post(
      'https://api.sandbox.africastalking.com/version1/messaging',
      new URLSearchParams({
        username: process.env.AT_USERNAME,
        to: formattedPhone,
        message: message,
      }).toString(),
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': process.env.AT_API_KEY,
        },
      }
    );

    console.log('SMS response:', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error('SMS error:', JSON.stringify(error.response?.data || error.message));
    throw new Error('Failed to send SMS');
  }
};

module.exports = { sendSMS };