// adsRoutes.js
import express from "express";
import { GoogleAdsApi } from "google-ads-api";
import User from "../models/User.js";

const router = express.Router();

router.get("/accounts/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user and get refresh token
    const user = await User.findOne({ googleId: userId });

    console.log("User:", user);

    if (!user || !user.refreshToken) {
      return res
        .status(401)
        .json({ error: "User not found or not authenticated" });
    }

    // Initialize Google Ads client
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    console.log("googleAdsClient:", client);

    // Create customer instance
    const getAccountsInfo = async () => {
      const accounts = await client.listAccessibleCustomers(user.accessToken);

      const customer = client.Customer({
        customer_id: accounts.resource_names[0].split("/")[1],
        refresh_token: user.refreshToken,
      });
      console.log("Accounts:", accounts, customer);

      const accountInfo = await customer.query(`
        SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.status
        FROM
          customer_client
        WHERE
          customer_client.level <= 1
      `);

      console.log("Account Info:", accountInfo);
      return accountInfo; // Return account info from the async function
    };

    // Wait for accountInfo to be fetched
    const accountInfo = await getAccountsInfo();
    console.log("Account Info:", accountInfo);
    // Return account info as the response
    res.json({ accountInfo });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({
      error: "Failed to fetch accounts",
      details: error.message,
    });
  }
});


router.get("/userAds/:userId/:customerId", async (req, res) => {
  try {
    const { userId, customerId } = req.params;

    // Find user and get refresh token
    const user = await User.findOne({ googleId: userId });

    if (!user || !user.refreshToken) {
      return res
        .status(401)
        .json({ error: "User not found or not authenticated" });
    }

    // Initialize Google Ads client
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    // Create customer instance for the selected subaccount
    const customer = client.Customer({
      customer_id: customerId,
      login_customer_id: process.env.MANAGER_ACCOUNT_ID,
      refresh_token: user.refreshToken,
    });

    // Query to fetch ads information (e.g., campaigns)
    const adsInfo = await customer.query(`
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.start_date,
          campaign.end_date
        FROM
          campaign
      `);

    res.json({ adsInfo });
  } catch (error) {
    console.error("Error fetching ads:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch ads", details: error.message });
  }
});


export default router;
