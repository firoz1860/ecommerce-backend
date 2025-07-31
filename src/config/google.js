import { OAuth2Client } from 'google-auth-library';
import 'dotenv/config';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Verify Google ID token
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    return {
      googleId: payload.sub,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      avatar: payload.picture,
      emailVerified: payload.email_verified
    };
  } catch (error) {
    throw new Error(`Google token verification failed: ${error.message}`);
  }
};

// Generate Google OAuth URL
const getGoogleAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
};

// Exchange authorization code for tokens
const getGoogleTokens = async (code) => {
  try {
    const { tokens } = await client.getToken(code);
    return tokens;
  } catch (error) {
    throw new Error(`Failed to exchange code for tokens: ${error.message}`);
  }
};

export { verifyGoogleToken, getGoogleAuthUrl, getGoogleTokens };