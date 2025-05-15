import { config } from 'dotenv';
import readline from 'readline/promises'
import { GoogleGenAI } from "@google/genai"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

// Load environment variables
config()

// Check if the API key is available
//if (!process.env.GEMINI_API_KEY) {
   // console.error('Error: GEMINI_API_KEY is not set in the .env file');
    //console.log('Please create a .env file with your Gemini API key:');
    //console.log('GEMINI_API_KEY=your_gemini_api_key_here');
    //process.exit(1);
//}

let tools = []
const ai = new GoogleGenAI({ apiKey: "AIzaSyABMrfTBME_9wZ7GettHxdx54idErt86Rk" });
const mcpClient = new Client({
    name: "example-client",
    version: "1.0.0",
})

const chatHistory = [];
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Connect to the MCP server with proper error handling
try {
    mcpClient.connect(new SSEClientTransport(new URL("http://localhost:3001/sse")))
        .then(async () => {
            console.log("Connected to MCP server");

            try {
                const toolList = await mcpClient.listTools();
                tools = toolList.tools.map(tool => {
                    return {
                        name: tool.name,
                        description: tool.description,
                        parameters: {
                            type: tool.inputSchema.type,
                            properties: tool.inputSchema.properties,
                            required: tool.inputSchema.required
                        }
                    }
                });
                console.log(`Loaded ${tools.length} tools from the server`);
                chatLoop();
            } catch (error) {
                console.error("Error loading tools:", error.message);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error("Failed to connect to MCP server:", error.message);
            console.log("Make sure the server is running at http://localhost:3001");
            process.exit(1);
        });
} catch (error) {
    console.error("Error initializing connection:", error.message);
    process.exit(1);
}

async function chatLoop(toolCall) {
    try {
        if (toolCall) {
            console.log("Calling tool:", toolCall.name);

            chatHistory.push({
                role: "model",
                parts: [
                    {
                        text: `Calling tool ${toolCall.name}`,
                        type: "text"
                    }
                ]
            });

            try {
                const toolResult = await mcpClient.callTool({
                    name: toolCall.name,
                    arguments: toolCall.args
                });

                if (toolResult && Array.isArray(toolResult.content) && toolResult.content.length > 0) {
                    chatHistory.push({
                        role: "user",
                        parts: [
                            {
                                text: "Tool result: " + toolResult.content[0].text,
                                type: "text"
                            }
                        ]
                    });
                } else {
                    chatHistory.push({
                        role: "user",
                        parts: [
                            {
                                text: "Tool returned no content",
                                type: "text"
                            }
                        ]
                    });
                }
            } catch (error) {
                console.error(`Error calling tool ${toolCall.name}:`, error.message);
                chatHistory.push({
                    role: "user",
                    parts: [
                        {
                            text: `Error calling tool ${toolCall.name}: ${error.message}`,
                            type: "text"
                        }
                    ]
                });
            }
        } else {
            const question = await rl.question('You: ');
            
            // Exit command
            if (question.toLowerCase() === 'exit' || question.toLowerCase() === 'quit') {
                console.log('Goodbye!');
                process.exit(0);
            }
            
            chatHistory.push({
                role: "user",
                parts: [
                    {
                        text: question,
                        type: "text"
                    }
                ]
            });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: chatHistory,
            config: {
                tools: tools.length > 0 ? [{ functionDeclarations: tools }] : []
            }
        });

        let functionCall = null;
        let responseText = "Sorry, I couldn't generate a response.";
        
        if (response && 
            response.candidates && 
            Array.isArray(response.candidates) && 
            response.candidates.length > 0 && 
            response.candidates[0].content && 
            Array.isArray(response.candidates[0].content.parts) && 
            response.candidates[0].content.parts.length > 0) {
            
            functionCall = response.candidates[0].content.parts[0].functionCall;
            responseText = response.candidates[0].content.parts[0].text || responseText;
        }

        if (functionCall) {
            return chatLoop(functionCall);
        }

        chatHistory.push({
            role: "model",
            parts: [
                {
                    text: responseText,
                    type: "text"
                }
            ]
        });

        console.log(`AI: ${responseText}`);
        chatLoop();
    } catch (error) {
        console.error("Error in chat loop:", error.message);
        console.log("Restarting chat loop...");
        chatLoop();
    }
}

