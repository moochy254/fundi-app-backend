const AfricasTalking = require('africastalking');
require('dotenv').config();

const africastalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

const sms = africastalking.SMS;

const sendSMS = async (phone, message) => {
  try {
    // Format phone number for Kenya
    const formattedPhone = phone.startsWith('0')
      ? `+254${phone.slice(1)}`
      : phone.startsWith('254')
      ? `+${phone}`
      : phone;

    console.log('Sending SMS to:', formattedPhone);

    const result = await sms.send({
      to: [formattedPhone],
      message,
    });

    console.log('SMS result:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('SMS error details:', JSON.stringify(error.response?.data || error.message));
    throw new Error('Failed to send SMS');
  }
};

module.exports = { sendSMS };