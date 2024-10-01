require('dotenv').config();
const fetch = require('node-fetch');
const getAccessToken = async () => {
  const response = await fetch(`${process.env.DWOLLA_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'Client_credentials',
      client_id: process.env.DWOLLA_KEY,
      client_secret: process.env.DWOLLA_SECRET,
    }),
  });
  if (response.ok) {
    const data = await response.json();
    return data.access_token;
  } else {
    throw new Error('Failed to obtain access token');
  }
};
const checkDwollaApi = async () => {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(process.env.DWOLLA_BASE_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      const data = await response.json();
      console.log('API is reachable:', data);
    } else {
      console.error('API returned an error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error reaching the API:', error);
  }
};
checkDwollaApi();
