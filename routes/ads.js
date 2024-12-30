// adsRoutes.js
import express from "express";
import { GoogleAdsApi } from "google-ads-api";
import User from "../models/User.js";
import FBUser from "../models/FBUser.js";
import axios from "axios";
import { FacebookAdsApi, AdAccount, User as Fb } from 'facebook-nodejs-business-sdk';


const router = express.Router();

//google-ads-api-------------------------------------------------------------------------------------
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
        // customer_id: "5522791049",
        // login_customer_id: accounts.resource_names[0].split("/")[1],
        refresh_token: user.refreshToken,
      });
      console.log("Accounts:", accounts, customer);

      const manager = await customer.query(`    SELECT
      customer.id,
      customer.manager,
      customer.descriptive_name
      FROM
        customer
      `);

      console.log("manager:", manager);

      const accountInfo = await customer.query(`
        SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.status
        FROM
          customer_client
        WHERE
          customer_client.level <= 0
      `);

      console.log("Account Info:", accountInfo);
      return accountInfo;
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

// router.post('/fb-ads-accounts', async (req, res) => {
//   const { userId } = req.body;

//   if (!userId) {
//     return res.status(400).json({ error: 'User ID is required.' });
//   }

//   try {
//     // Find the user in MongoDB by userId
//     const user = await FBUser.findOne({ facebookId: userId });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found.' });
//     }

//     const accessToken = user.accessToken;

//     // Helper function to fetch all paginated data with additional fields
//     const fetchAllAdsAccounts = async (url, accumulatedData = []) => {
//       const response = await axios.get(url, {
//         params: {
//           access_token: accessToken,
//           fields: 'id,account_id,name,currency,account_status,spend_cap', // Add fields to retrieve
//         },
//       });

//       const newData = response.data.data || [];
//       const allData = accumulatedData.concat(newData);

//       // Check if there's a next page and recursively fetch it
//       if (response.data.paging && response.data.paging.next) {
//         return fetchAllAdsAccounts(response.data.paging.next, allData);
//       }

//       return allData;
//     };

//     // Initial URL for fetching ad accounts
//     const initialUrl = `https://graph.facebook.com/v17.0/${userId}/adaccounts`;

//     // Fetch all paginated data with additional fields
//     const adsAccounts = await fetchAllAdsAccounts(initialUrl);

//     res.json({ adsAccounts });
//   } catch (err) {
//     console.error('Error fetching ads accounts:', err);
//     res.status(500).json({ error: 'Failed to fetch ads accounts.' });
//   }
// });


// // Route to fetch ads information
// router.post('/fb-ads', async (req, res) => {
//   const { accountIds, userId } = req.body;

//   if (!userId || !accountIds || !Array.isArray(accountIds)) {
//     return res.status(400).json({ error: 'User ID and an array of account IDs are required.' });
//   }

//   try {
//     // Find the user in MongoDB by userId
//     const user = await FBUser.findOne({ facebookId: userId });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found.' });
//     }

//     const accessToken = user.accessToken;

//     // Helper function to fetch ads for a single account
//     const fetchAdsForAccount = async (accountId) => {
//       const url = `https://graph.facebook.com/v17.0/${accountId}/ads`;
//       const response = await axios.get(url, {
//         params: {
//           access_token: accessToken,
//           fields: 'id,name,status,effective_status,created_time,updated_time', // Specify required ad fields
//         },
//       });

//       return response.data.data || [];
//     };

//     // Fetch ads for each account
//     const adsData = {};
//     for (const accountId of accountIds) {
//       adsData[accountId] = await fetchAdsForAccount(accountId);
//     }

//     res.json({ adsData });
//   } catch (err) {
//     console.error('Error fetching ads:', err);
//     res.status(500).json({ error: 'Failed to fetch ads.' });
//   }
// });


//fb-------------------------------------------------------------------------------------


router.post('/fb-ads-accounts', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // Find the user in MongoDB by userId
    const user = await FBUser.findOne({ facebookId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const accessToken = user.accessToken;

    // Initialize the Facebook Ads API
    FacebookAdsApi.init(accessToken);

    // Fetch all ad accounts using the Ads API
    const me = new Fb('me');
    const adsAccounts = await me.getAdAccounts(['id', 'account_id', 'name', 'currency', 'account_status', 'spend_cap']);
    const pages = await me.getAccounts(['id', 'name', 'category', 'access_token', 'fan_count']);

    console.log(pages, 'page');
    // Format and send the response
    const formattedPages = pages.map(page => ({
      id: page.id,
      name: page.name,
      category: page.category,
      fan_count: page.fan_count,
      access_token: page.access_token,
    }));
    console.log(formattedPages, 'formattedPages');

    // res.json({ pages: formattedPages });

    res.json({ adsAccounts });
  } catch (err) {
    console.error('Error fetching ads accounts:', err);
    res.status(500).json({ error: 'Failed to fetch ads accounts.' });
  }
});

// Route to fetch ads information
router.post('/fb-ads', async (req, res) => {
  const { accountIds, userId } = req.body;

  if (!userId || !accountIds || !Array.isArray(accountIds)) {
    return res.status(400).json({ error: 'User ID and an array of account IDs are required.' });
  }

  try {
    // Find the user in MongoDB by userId
    const user = await FBUser.findOne({ facebookId: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const accessToken = user.accessToken;

    // Initialize the Facebook Ads API
    FacebookAdsApi.init(accessToken);

    // Fetch ads for each account
    const adsData = {};
    for (const accountId of accountIds) {
      console.log('Fetching ads for account ID:', accountId); // Log accountId to debug

      // Ensure accountId is a string (or properly formatted)
      if (typeof accountId !== 'string') {
        throw new Error('Account ID should be a string');
      }

      const account = new AdAccount(accountId);
      const ads = await account.getAds(['id', 'name', 'status', 'effective_status', 'created_time', 'updated_time']);
      adsData[accountId] = ads;
    }

    res.json({ adsData });
  } catch (err) {
    console.error('Error fetching ads:', err);
    res.status(500).json({ error: 'Failed to fetch ads.' });
  }
});



export default router;
