# MCP Server - AI Assistant with Context Management

A Model Context Protocol (MCP) server implementation that provides an AI assistant with advanced context management, personality persistence, and interactive tools for file operations, document creation, and web automation.

## Features

- **AI Assistant with Persistent Personality**: Maintains conversation context, mood, and personality across sessions
- **MCP Protocol Support**: Implements the Model Context Protocol for standardized AI tool interactions
- **File Operations**: Read, write, create, and delete files with full path support
- **Document Creation**: Generate Word documents and simple text documents
- **Web Automation**: YouTube video playback and web browser control using Playwright
- **Context Management**: Stores conversation history, mood tracking, and relationship data
- **Enhanced Tool System**: Intelligent tool selection and context-aware responses
- **Dynamic Mood System**: AI assistant mood adapts based on conversation context
- **Relationship Management**: Maintains relationship context, history, and emotional dynamics

## Architecture

The project consists of two main components:

### Server (`/server`)
- MCP server implementation with Express.js
- Tool definitions for file operations, document creation, and web automation
- Playwright integration for browser automation
- SSE (Server-Sent Events) transport layer
- RESTful API endpoints for tool execution

### Client (`/client`)
- MCP client implementation
- Google Gemini AI integration (Gemini 2.0 Flash)
- Context management system with persistent storage
- Enhanced tool descriptions and selection guidance
- Conversation state persistence
- Dynamic mood and objective tracking

## Project Structure

```
mcp-server/
├── server/
│   ├── index.js                 # Main server file with MCP implementation
│   ├── file-ops.tool.js         # File operations tool
│   ├── word-document-creator.tool.js  # Word document creation tool
│   ├── simple-doc-creator.tool.js     # Simple document creation tool
│   ├── package.json
│   └── node_modules/
├── client/
│   ├── index.js                 # Main client file with AI integration
│   ├── toolManager.js           # Tool management system
│   ├── enhancedTools.js         # Enhanced tool descriptions
│   ├── context_for_bot/         # Context persistence files
│   │   ├── conversation_state.json
│   │   ├── mood.json
│   │   ├── identity.json
│   │   ├── relationship.json
│   │   ├── personality.json
│   │   ├── partner_details.json
│   │   ├── objective.json
│   │   └── history.txt
│   ├── package.json
│   └── node_modules/
└── README.md
```

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Chrome browser (for web automation features)
- Google Gemini API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mcp-server
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Environment Configuration**
   
   Create a `.env` file` in the server directory (optional):
   ```env
   USERNAME=YourUsername
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   Note: The client currently uses a hardcoded API key in `client/index.js`. For production use, move this to environment variables.

## Usage

### Starting the Server

1. **Navigate to server directory**
   ```bash
   cd server
   ```

2. **Start the MCP server**
   ```bash
   npm start
   ```

   The server will start on `http://localhost:3001` and initialize the browser automation.

### Starting the Client

1. **Navigate to client directory**
   ```bash
   cd client
   ```

2. **Start the MCP client**
   ```bash
   npm start
   ```

   The client will connect to the server and start the AI assistant interface. You can interact with the assistant through the command line.

## Available Tools

### File Operations (`fileOperations`)
- **Read**: Read file contents with path validation
- **Write**: Write content to files
- **Create**: Create new files
- **Delete**: Remove files
- **Execute**: Run system commands (with security restrictions)

### Document Creation
- **Word Document Creator**: Generate formatted Word documents (.docx) with custom content
- **Simple Document Creator**: Create plain text documents

### Web Automation
- **YouTube Video Player**: Search and play YouTube videos automatically
- **Browser Control**: Navigate and interact with web pages using Playwright

## Configuration

### Context Management

The system maintains several context files in `client/context_for_bot/`:

- `conversation_state.json`: Current conversation state, history, and interaction tracking
- `mood.json`: AI assistant's current mood, emotional state, and intensity
- `identity.json`: Core identity, personality traits, background, and communication style
- `relationship.json`: Relationship context, dynamics, emotional tone, and shared memories
- `personality.json`: Detailed personality characteristics (MBTI, Big Five, temperament)
- `partner_details.json`: Information about the user/partner
- `objective.json`: Current goals, objectives, and conversation intentions
- `history.txt`: Complete conversation history log

### Customization

You can modify the AI assistant's personality by editing the context files:

1. **Personality**: Edit `personality.json` to change character traits, MBTI type, and behavioral patterns
2. **Identity**: Modify `identity.json` for core characteristics, background, and communication style
3. **Objectives**: Update `objective.json` for new goals and conversation objectives
4. **Relationship**: Edit `relationship.json` to adjust relationship dynamics, emotional tone, and shared context
5. **Mood**: The system automatically tracks and updates mood based on interactions, but you can manually adjust `mood.json`

### Mood System

The mood system dynamically adjusts based on:
- User input sentiment (positive/negative words)
- Conversation context
- Relationship triggers
- Emotional keywords

Mood states include: calm, curious, neutral, happy, excited, thoughtful, sad, confused, frustrated, amused, jealous, loving, playful, romantic

## API Integration

### Google Gemini AI
The client integrates with Google's Gemini AI model (Gemini 2.0 Flash) for natural language processing and conversation management. The AI uses function calling to interact with MCP tools.

### MCP Protocol
The server implements the Model Context Protocol, allowing it to:
- Register and manage tools dynamically
- Handle client requests via SSE transport
- Provide standardized tool responses
- Support multiple transport layers (currently SSE)

## Technical Details

### Server Architecture
- **Framework**: Express.js
- **MCP SDK**: @modelcontextprotocol/sdk v1.8.0
- **Browser Automation**: Playwright v1.52.0
- **Validation**: Zod v3.24.2
- **Transport**: Server-Sent Events (SSE)

### Client Architecture
- **AI Model**: Google Gemini 2.0 Flash
- **MCP SDK**: @modelcontextprotocol/sdk v1.8.0
- **Transport**: SSE Client Transport
- **Context Storage**: JSON files with persistent state

### Tool Execution Flow
1. User input is processed by Gemini AI
2. AI determines if tool calling is needed
3. Tool call is sent to MCP server via SSE
4. Server executes tool and returns result
5. Result is integrated into conversation context
6. AI generates response based on tool result

## Troubleshooting

### Common Issues

1. **Browser Initialization Failed**
   - Ensure Chrome is installed and accessible
   - Check if the USERNAME environment variable is set correctly
   - Verify Chrome user data directory permissions
   - The system will fall back to a default browser profile if user profile fails

2. **Tool Execution Errors**
   - Check file permissions for file operations
   - Ensure the server is running before starting the client
   - Verify tool schemas and parameters match expected format
   - Check server console for detailed error messages

3. **Context Loading Issues**
   - Check if context files exist and are valid JSON
   - Verify file paths and permissions
   - Restart the client to reload context
   - Empty or corrupted JSON files will be handled gracefully

4. **Connection Errors**
   - Verify server is running on `http://localhost:3001`
   - Check firewall settings
   - Ensure no other process is using port 3001

5. **API Key Issues**
   - Verify Gemini API key is valid
   - Check API quota and rate limits
   - Ensure network connectivity to Google's API servers

### Debug Mode

Enable debug logging by setting environment variables:
```env
DEBUG=true
NODE_ENV=development
```

## Development

### Adding New Tools

1. Create a new tool file in `server/` directory
2. Define tool schema using Zod
3. Implement tool handler function
4. Register tool in `server/index.js`
5. Update `client/enhancedTools.js` with enhanced descriptions

### Modifying AI Behavior

- Edit system prompt in `client/index.js` (`createSystemPrompt` function)
- Adjust mood detection logic in `updateMood` function
- Modify objective tracking in `updateObjectives` function
- Update tool calling instructions in system prompt

## Security Considerations

- File operations are restricted to workspace directory
- Command execution should be carefully controlled
- API keys should be stored in environment variables (not hardcoded)
- Browser automation runs in non-headless mode for security
- User data directory access requires proper permissions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- Model Context Protocol (MCP) team for the protocol specification
- Google for Gemini AI integration
- Playwright team for web automation capabilities
- Express.js community for the web framework

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review existing issues in the repository
3. Create a new issue with detailed information including:
   - System information (OS, Node.js version)
   - Error messages and logs
   - Steps to reproduce
   - Expected vs actual behavior

## Notes

- This is an experimental AI assistant system
- Use responsibly and be aware of the implications of AI-generated content and automated actions
- Browser automation requires Chrome to be installed
- Context files are stored locally and persist between sessions
- The system maintains conversation history up to a configurable limit (default: 15 exchanges)

---

**Version**: 1.0.0  
**Last Updated**: 2024
