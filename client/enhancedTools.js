// Enhanced tool descriptions with better context and examples
export const enhancedToolDescriptions = {
    fileOperations: {
        name: "fileOperations",
        description: "Perform file system operations including read, write, append, delete, and command execution. Use this for file management tasks.",
        examples: [
            "Read a file: { operation: 'read', path: 'example.txt' }",
            "Write content: { operation: 'write', path: 'newfile.txt', content: 'Hello World' }",
            "Append content: { operation: 'append', path: 'log.txt', content: 'New log entry' }",
            "Delete file: { operation: 'delete', path: 'temp.txt' }",
            "Execute command: { operation: 'execute', command: 'ls -la' }"
        ],
        usage_guidelines: [
            "Always specify the operation type first",
            "For file operations, provide the full path",
            "Use 'write' to create new files, 'append' to add to existing files",
            "Be careful with delete operations - they cannot be undone",
            "Command execution runs in the current working directory"
        ]
    },
    playYouTubeVideo: {
        name: "playYouTubeVideo",
        description: "Search for and play YouTube videos by providing a search query. The tool will automatically search and play the first relevant video.",
        examples: [
            "Play music: { query: 'lofi hip hop radio' }",
            "Watch tutorial: { query: 'JavaScript tutorial for beginners' }",
            "Find entertainment: { query: 'funny cat videos' }"
        ],
        usage_guidelines: [
            "Provide specific search terms for better results",
            "The tool will automatically select the first video from search results",
            "Works best with popular or well-known content",
            "Requires an active internet connection"
        ]
    }
};

// Tool combination strategies
export const toolCombinationStrategies = {
    fileWorkflow: {
        description: "Common file operation workflows",
        patterns: [
            {
                name: "Read and Process",
                steps: [
                    "1. Read a file using fileOperations with 'read' operation",
                    "2. Process the content in your response",
                    "3. Optionally write results using 'write' operation"
                ]
            },
            {
                name: "Backup and Update",
                steps: [
                    "1. Read original file",
                    "2. Write backup with 'write' operation",
                    "3. Update original with new content"
                ]
            },
            {
                name: "Log Management",
                steps: [
                    "1. Check if log file exists",
                    "2. Append new entries with 'append' operation",
                    "3. Optionally clean old logs"
                ]
            }
        ]
    },
    entertainmentWorkflow: {
        description: "Entertainment and media workflows",
        patterns: [
            {
                name: "Video Search and Play",
                steps: [
                    "1. Use playYouTubeVideo with specific search terms",
                    "2. Provide feedback about the video selection",
                    "3. Suggest related content if needed"
                ]
            }
        ]
    }
};

// Tool context helpers
export const getToolContext = (toolManager) => {
    const summary = toolManager.getToolChainSummary();
    if (!summary) return "";

    let context = `\nTool Chain Summary: ${summary.completed}/${summary.total} completed, ${summary.failed} failed\n`;
    
    if (summary.tools.length > 0) {
        context += "Recent operations:\n";
        summary.tools.slice(-3).forEach(tool => {
            const status = tool.status === 'completed' ? '✅' : 
                          tool.status === 'failed' ? '❌' : '⏳';
            context += `${status} ${tool.name}\n`;
        });
    }

    return context;
};

// Tool selection guidance
export const getToolSelectionGuidance = (userRequest, toolManager) => {
    const guidance = [];
    
    // Check for file-related requests
    if (userRequest.toLowerCase().includes('file') || 
        userRequest.toLowerCase().includes('read') || 
        userRequest.toLowerCase().includes('write') ||
        userRequest.toLowerCase().includes('delete') ||
        userRequest.toLowerCase().includes('create')) {
        guidance.push("Use fileOperations tool for file management tasks");
    }
    
    // Check for video/entertainment requests
    if (userRequest.toLowerCase().includes('video') || 
        userRequest.toLowerCase().includes('youtube') ||
        userRequest.toLowerCase().includes('play') ||
        userRequest.toLowerCase().includes('watch') ||
        userRequest.toLowerCase().includes('song') ||
        userRequest.toLowerCase().includes('music')) {
        guidance.push("Use playYouTubeVideo tool for video and music content");
    }
    
    // Check for command execution
    if (userRequest.toLowerCase().includes('command') || 
        userRequest.toLowerCase().includes('run') ||
        userRequest.toLowerCase().includes('execute')) {
        guidance.push("Use fileOperations with 'execute' operation for command execution");
    }
    
    // Check for recent tool usage
    if (toolManager.wasToolRecentlyUsed('fileOperations')) {
        guidance.push("fileOperations was recently used - consider building on previous operations");
    }
    
    return guidance;
}; 