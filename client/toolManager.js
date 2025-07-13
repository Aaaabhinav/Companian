// Tool Manager for handling sequential tool calls and maintaining context
class ToolManager {
    constructor() {
        this.toolHistory = [];
        this.currentToolChain = [];
        this.toolResults = new Map();
        this.maxToolChainLength = 5; // Maximum tools in a single chain
    }

    // Add a tool call to the current chain
    addToChain(toolCall) {
        this.currentToolChain.push({
            name: toolCall.name,
            args: toolCall.args,
            timestamp: new Date().toISOString(),
            status: 'pending'
        });

        // Limit chain length
        if (this.currentToolChain.length > this.maxToolChainLength) {
            this.currentToolChain.shift();
        }
    }

    // Execute a tool and store the result
    async executeTool(mcpClient, toolCall) {
        try {
            this.addToChain(toolCall);
            
            console.log(`🔧 Executing tool: ${toolCall.name}`);
            console.log(`📝 Arguments: ${JSON.stringify(toolCall.args, null, 2)}`);

            const result = await mcpClient.callTool({
                name: toolCall.name,
                arguments: toolCall.args
            });

            // Store the result
            const toolKey = `${toolCall.name}_${Date.now()}`;
            this.toolResults.set(toolKey, {
                tool: toolCall.name,
                args: toolCall.args,
                result: result,
                timestamp: new Date().toISOString(),
                success: !result.isError
            });

            // Update chain status
            const lastTool = this.currentToolChain[this.currentToolChain.length - 1];
            if (lastTool) {
                lastTool.status = result.isError ? 'failed' : 'completed';
                lastTool.result = result;
            }

            return {
                success: !result.isError,
                result: result,
                toolKey: toolKey
            };

        } catch (error) {
            console.error(`❌ Tool execution failed: ${error.message}`);
            
            // Update chain status
            const lastTool = this.currentToolChain[this.currentToolChain.length - 1];
            if (lastTool) {
                lastTool.status = 'failed';
                lastTool.error = error.message;
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get context for the AI about recent tool calls
    getToolContext() {
        const recentTools = this.currentToolChain.slice(-3); // Last 3 tools
        const context = [];

        if (recentTools.length > 0) {
            context.push("Recent tool operations:");
            recentTools.forEach((tool, index) => {
                const status = tool.status === 'completed' ? '✅' : 
                             tool.status === 'failed' ? '❌' : '⏳';
                context.push(`${status} ${tool.name}: ${tool.status}`);
                
                if (tool.result && tool.result.content) {
                    const textContent = tool.result.content.find(item => item.type === "text");
                    if (textContent) {
                        context.push(`   Result: ${textContent.text}`);
                    }
                }
            });
        }

        return context.join('\n');
    }

    // Check if we should continue with more tools
    shouldContinueToolChain() {
        const recentFailures = this.currentToolChain
            .slice(-2)
            .filter(tool => tool.status === 'failed').length;
        
        // Stop if we have too many recent failures
        return recentFailures < 2;
    }

    // Get summary of tool chain for conversation context
    getToolChainSummary() {
        if (this.currentToolChain.length === 0) return null;

        const completed = this.currentToolChain.filter(t => t.status === 'completed').length;
        const failed = this.currentToolChain.filter(t => t.status === 'failed').length;
        const pending = this.currentToolChain.filter(t => t.status === 'pending').length;

        return {
            total: this.currentToolChain.length,
            completed,
            failed,
            pending,
            tools: this.currentToolChain.map(t => ({
                name: t.name,
                status: t.status,
                timestamp: t.timestamp
            }))
        };
    }

    // Clear the current tool chain
    clearChain() {
        this.currentToolChain = [];
    }

    // Get the last successful tool result
    getLastSuccessfulResult() {
        const successfulTools = this.currentToolChain
            .filter(tool => tool.status === 'completed' && tool.result);
        
        return successfulTools.length > 0 ? successfulTools[successfulTools.length - 1] : null;
    }

    // Check if a specific tool was recently used
    wasToolRecentlyUsed(toolName, withinMinutes = 5) {
        const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);
        return this.currentToolChain.some(tool => 
            tool.name === toolName && 
            new Date(tool.timestamp) > cutoffTime
        );
    }
}

export default ToolManager; 