import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { chromium } from 'playwright';
import { z } from "zod";
import { handleFileOperation, toolSchema as fileOpsSchema } from "./file-ops.tool.js";

// Initialize Playwright browser variables
let browser = null;
let context = null;
let page = null;

// Initialize the browser if not already initialized
async function ensureBrowserInitialized() {
  if (!browser || browser._closed) {
    try {
      const username = process.env.USERNAME || 'Abhinav Dixit';
      const chromeUserDataDir = `C:\\Users\\${username}\\AppData\\Local\\Google\\Chrome\\User Data`;
      
      browser = await chromium.launchPersistentContext(chromeUserDataDir, {
        headless: false,
        channel: 'chrome'
      });
      
      const pages = await browser.pages();
      page = pages.length > 0 ? pages[0] : await browser.newPage();
      console.log("Browser initialized successfully using existing Chrome profile");
    } catch (error) {
      console.error("Error initializing browser with user profile, falling back to default:", error);
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
    
    return await action();
  } catch (error) {
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

const app = express();

// YouTube tool
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
            
            // Accept cookies if the dialog appears
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
});

// File Operations tool
server.tool(
    fileOpsSchema.name,
    fileOpsSchema.description,
    fileOpsSchema.schema,
    async (args) => {
        return await handleFileOperation(args);
    }
);

// Server setup for SSE and messages
const transports = {};

app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
    });
    await server.connect(transport);
});

app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).send('No transport found for sessionId');
    }
});

app.listen(3001, () => {
    console.log("Server is running on http://localhost:3001");
});