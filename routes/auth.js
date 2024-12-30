import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const router = express.Router();
import FBUser from '../models/FBUser.js';


router.post("/exchange-code", async (req, res) => {
  const { code } = req.body;
  console.log("Received code:", code);

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: "http://localhost:8080",
        grant_type: "authorization_code",
      }
    );

    console.log("Token response:", tokenResponse.data);

    const { access_token, refresh_token, id_token } = tokenResponse.data;

    // Decode ID token to get user info
    const decoded = jwt.decode(id_token);
    console.log("Decoded ID token:", decoded);

    let user = await User.findOne({ googleId: decoded.sub });

    // console.log("User:", user);

    if (!user) {
      user = new User({
        googleId: decoded.sub,
        email: decoded.email,
        accessToken: access_token,
        refreshToken: refresh_token,
      });
    } else {
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
    }

    await user.save();

    res.json({ success: true, userId: decoded.sub });
  } catch (error) {
    console.error("Token exchange failed:", error.response?.data);
    if (error.response?.data?.error === "invalid_grant") {
      res
        .status(400)
        .json({
          error: "Invalid authorization code",
          details: error.response?.data?.error_description,
        });
    } else {
      res.status(500).json({ error: "Token exchange failed", details: error });
    }
  }
});

router.post('/fb-login', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided.' });
  }

  try {
    // Exchange the code for an access token
    const response = await axios.get('https://graph.facebook.com/v17.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: 'http://localhost:8080/',
        code,
      },
    });

    const accessToken = response.data.access_token;
    console.log(accessToken, 'access_token');

    // Fetch user data using the access token
    const userInfo = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name,email,picture',
      },
    });

    const { id: facebookId, name } = userInfo.data;

    // Check if user already exists
    let user = await FBUser.findOne({ facebookId });

    if (user) {
      // Update access token if user exists
      user.accessToken = accessToken;
      await user.save();
    } else {
      // Create a new user if not exists
      user = new FBUser({
        facebookId,
        name,
        accessToken,
      });
      await user.save();
    }

    // Send the user data back to the frontend
    res.json({ user: { facebookId, name } });
  } catch (err) {
    console.error('Error during Facebook login:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to login with Facebook.' });
  }
});

// Create an endpoint to revoke Google OAuth token when disconnecting
router.post("/disconnect", async (req, res) => {
    const { userId } = req.body;  // Assume the userId is passed in the request body
  
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
  
    const user = await User.findOne({ googleId: userId });

    console.log("User:", user);
  
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
  
    try {
      // Make a POST request to Google's OAuth2 revoke endpoint with the refresh token
      const response = await axios.post(
        `https://oauth2.googleapis.com/revoke?token=${user?.refreshToken}`,
      );

      console.log("Revoke response:", response);
  
      // Check if the response status is successful
      if (response.status === 200) {
        // Revoke successful, now remove the refresh token from the user's record
        user.refreshToken = "";  // Remove the refresh token
  
        // Save the updated user record
        await user.save();
        console.log("Refresh token removed successfully");
  
        return res.status(200).json({ message: "Google token revoked and refresh token removed successfully", disconnect: true });
      } else {
        return res.status(400).json({ error: "Failed to revoke token" });
      }
    } catch (error) {
      console.error("Error revoking Google token:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
});
  
export default router;

