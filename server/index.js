import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createPost } from "./mcp.tool.js";
import { chromium } from 'playwright';
import { z } from "zod";

// Initialize Playwright browser variables
let browser = null;
let context = null;
let page = null;

// Initialize the browser if not already initialized
async function ensureBrowserInitialized() {
  if (!browser || browser._closed) {
    try {
      // User profile directories for different browsers
      // Chrome: C:\Users\{username}\AppData\Local\Google\Chrome\User Data
      // Edge: C:\Users\{username}\AppData\Local\Microsoft\Edge\User Data
      const username = process.env.USERNAME || 'Abhinav Dixit';
      const chromeUserDataDir = `C:\\Users\\${username}\\AppData\\Local\\Google\\Chrome\\User Data`;
      
      // Use the existing user profile so we retain logged-in state
      browser = await chromium.launchPersistentContext(chromeUserDataDir, {
        headless: false,
        channel: 'chrome'
      });
      
      // Get the first page or create a new one if none exists
      const pages = await browser.pages();
      page = pages.length > 0 ? pages[0] : await browser.newPage();
      console.log("Browser initialized successfully using existing Chrome profile");
    } catch (error) {
      console.error("Error initializing browser with user profile, falling back to default:", error);
      // Fallback to regular browser launch if profile access fails
      try {
        browser = await chromium.launch({ 
          headless: false,
          channel: 'chrome'
        });
        context = await browser.newContext();
        page = await context.newPage();
        console.log("Browser initialized successfully using default profile");
      } catch (fallbackError) {
        console.error("Error initializing fallback browser:", fallbackError);
        throw fallbackError;
      }
    }
  }
  
  return { browser, context, page };
}

// Safely execute a browser action with proper error handling
async function safeBrowserAction(action) {
  try {
    // First check if browser and page are still valid
    if (!browser || browser._closed) {
      console.log("Browser was closed. Reinitializing...");
      browser = null;
      context = null;
      page = null;
      await ensureBrowserInitialized();
    }
    
    if (!page || page.isClosed()) {
      console.log("Page was closed. Creating a new page...");
      if (context) {
        page = await context.newPage();
      } else {
        const pages = await browser.pages();
        page = pages.length > 0 ? pages[0] : await browser.newPage();
      }
    }
    
    // Execute the provided action
    return await action();
  } catch (error) {
    // If the error is about closed browser/page, reset variables for next time
    if (error.message.includes("closed")) {
      console.log("Browser or page was closed during operation. Will reinitialize on next use.");
      browser = null;
      context = null;
      page = null;
    }
    throw error;
  }
}

const server = new McpServer({
    name: "example-server",
    version: "1.0.0"
});

// ... set up server resources, tools, and prompts ...

const app = express();


server.tool(
    "addTwoNumbers",
    "Add two numbers",
    {
        a: z.number(),
        b: z.number()
    },
    async (arg) => {
        const { a, b } = arg;
        return {
            content: [
                {
                    type: "text",
                    text: `The sum of ${a} and ${b} is ${a + b}`
                }
            ]
        }
    }
)

server.tool(
    "createPost",
    "Create a post on X formally known as Twitter ", {
    status: z.string()
}, async (arg) => {
    const { status } = arg;
    return createPost(status);
})

// Add Playwright tools

server.tool(
    "playYouTubeVideo",
    "Play a YouTube video by searching for the provided query", {
    query: z.string().describe("Search query for the YouTube video")
}, async (arg) => {
    const { query } = arg;
    try {
        return await safeBrowserAction(async () => {
            await ensureBrowserInitialized();
            
            // Navigate to YouTube
            await page.goto('https://www.youtube.com/');
            
            // Accept cookies if the dialog appears (common in some regions)
            try {
                const acceptButton = await page.waitForSelector('button:has-text("Accept all")', { timeout: 5000 });
                if (acceptButton) {
                    await acceptButton.click();
                }
            } catch (e) {
                // Cookie dialog might not appear, which is fine
            }
            
            // Search for the video
            await page.fill('input[name="search_query"]', query);
            await page.press('input[name="search_query"]', 'Enter');
            
            // Wait for search results and click on the first video
            await page.waitForSelector('ytd-video-renderer, ytd-grid-video-renderer');
            await page.click('ytd-video-renderer a#thumbnail, ytd-grid-video-renderer a#thumbnail');
            
            // Get the current video title
            try {
                await page.waitForSelector('h1.title', { timeout: 10000 });
                const videoTitle = await page.$eval('h1.title', el => el.textContent.trim());
                return {
                    content: [
                        {
                            type: "text",
                            text: `Playing YouTube video: "${videoTitle}"`
                        }
                    ]
                };
            } catch (titleError) {
                // If we can't get the title, just return a generic message
                return {
                    content: [
                        {
                            type: "text",
                            text: `Playing YouTube video for: "${query}"`
                        }
                    ]
                };
            }
        });
    } catch (error) {
        console.error("Error playing YouTube video:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error playing YouTube video: ${error.message}`
                }
            ]
        };
    }
})

server.tool(
    "navigateToUrl",
    "Navigate to a specific URL in the browser", {
    url: z.string().describe("URL to navigate to (include http:// or https:// prefix)")
}, async (arg) => {
    const { url } = arg;
    try {
        return await safeBrowserAction(async () => {
            await ensureBrowserInitialized();
            
            await page.goto(url);
            
            const title = await page.title();
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Navigated to: ${title} (${url})`
                    }
                ]
            };
        });
    } catch (error) {
        console.error("Error navigating to URL:", error);
        return {
            content: [
                {
                    type: "text",
                    text: `Error navigating to URL: ${error.message}`
                }
            ]
        };
    }
})

server.tool(
    "closeBrowser",
    "Close the browser if it's open", 
    {}, 
    async () => {
    try {
        if (browser) {
            await browser.close();
            browser = null;
            context = null;
            page = null;
            
            return {
                content: [
                    {
                        type: "text",
                        text: "Browser closed successfully"
                    }
                ]
            };
        }
        
        return {
            content: [
                {
                    type: "text",
                    text: "No browser was open"
                }
            ]
        };
    } catch (error) {
        console.error("Error closing browser:", error);
        // Reset variables anyway
        browser = null;
        context = null;
        page = null;
        return {
            content: [
                {
                    type: "text",
                    text: `Error closing browser: ${error.message}, but variables have been reset`
                }
            ]
        };
    }
})

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports = {};

app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports[ transport.sessionId ] = transport;
    res.on("close", () => {
        delete transports[ transport.sessionId ];
    });
    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[ sessionId ];
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).send('No transport found for sessionId');
    }
});

app.listen(3001, () => {
    console.log("Server is running on http://localhost:3001");
});