import { config } from "dotenv"
import { TwitterApi } from "twitter-api-v2"
config()

let twitterClient = null;

try {
    // Only initialize the Twitter client if all required environment variables are present
    if (process.env.TWITTER_API_KEY && 
        process.env.TWITTER_API_SECRET && 
        process.env.TWITTER_ACCESS_TOKEN && 
        process.env.TWITTER_ACCESS_TOKEN_SECRET) {
        
        twitterClient = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
        });
        console.log("Twitter client initialized successfully");
    } else {
        console.log("Missing Twitter API credentials. Tweet functionality will be mocked.");
    }
} catch (error) {
    console.error("Error initializing Twitter client:", error);
}

export async function createPost(status) {
    try {
        if (twitterClient) {
            const newPost = await twitterClient.v2.tweet(status);
            return {
                content: [
                    {
                        type: "text",
                        text: `Tweeted: ${status}`
                    }
                ]
            };
        } else {
            // Mock implementation when Twitter client is not available
            console.log(`MOCK TWEET: ${status}`);
            return {
                content: [
                    {
                        type: "text",
                        text: `[TEST MODE] Would have tweeted: ${status}`
                    }
                ]
            };
        }
    } catch (error) {
        console.error("Error posting tweet:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error posting tweet: ${error.message}`
                }
            ]
        };
    }
}