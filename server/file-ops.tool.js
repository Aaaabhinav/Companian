import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper to ensure paths are within workspace
function validatePath(filePath) {
    const workspaceRoot = process.cwd();
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    
    if (!resolvedPath.startsWith(workspaceRoot)) {
        throw new Error('Access denied: Path must be within workspace');
    }
    
    return resolvedPath;
}

// Read file content
async function readFile(filePath) {
    try {
        const safePath = validatePath(filePath);
        const content = await fs.readFile(safePath, 'utf-8');
        return {
            content: [
                {
                    type: "text",
                    text: `Successfully read file: ${filePath}`
                },
                {
                    type: "resource",
                    resource: {
                        type: "text",
                        text: "File Content",
                        uri: safePath,
                        data: content
                    }
                }
            ]
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error reading file: ${error.message}`
                }
            ],
            isError: true
        };
    }
}

// Write content to file
async function writeFile(filePath, content, mode = 'write') {
    try {
        const safePath = validatePath(filePath);
        const dirPath = path.dirname(safePath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(dirPath, { recursive: true });
        
        if (mode === 'append') {
            await fs.appendFile(safePath, content);
        } else {
            await fs.writeFile(safePath, content);
        }
        
        return {
            content: [
                {
                    type: "text",
                    text: `Successfully ${mode === 'append' ? 'appended to' : 'wrote to'} file: ${filePath}`
                }
            ]
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error writing to file: ${error.message}`
                }
            ],
            isError: true
        };
    }
}

// Execute command
async function executeCommand(command) {
    try {
        const { stdout, stderr } = await execAsync(command);
        return {
            content: [
                {
                    type: "text",
                    text: "Command executed successfully"
                },
                {
                    type: "resource",
                    resource: {
                        type: "text",
                        text: "Command Output",
                        uri: "command-output",
                        data: stdout || stderr
                    }
                }
            ]
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error executing command: ${error.message}`
                }
            ],
            isError: true
        };
    }
}

// Delete file
async function deleteFile(filePath) {
    console.log(`Attempting to delete file: ${filePath}`); // Debug log
    
    try {
        if (!filePath) {
            throw new Error('File path is required');
        }

        const safePath = validatePath(filePath);
        console.log(`Resolved safe path: ${safePath}`); // Debug log
        
        // Check if file exists and get stats
        let stats;
        try {
            stats = await fs.stat(safePath);
            console.log(`File stats: ${JSON.stringify(stats)}`); // Debug log
        } catch (error) {
            console.error(`File access error: ${error.message}`); // Debug log
            throw new Error(`File not found or not accessible: ${filePath}`);
        }
        
        // Check if it's a directory
        if (stats.isDirectory()) {
            console.log('Attempted to delete a directory'); // Debug log
            throw new Error('Cannot delete directories with this operation');
        }
        
        // Attempt to delete the file
        try {
            await fs.unlink(safePath);
            console.log(`Successfully deleted file: ${safePath}`); // Debug log
            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully deleted file: ${filePath}`
                    }
                ]
            };
        } catch (deleteError) {
            console.error(`Delete operation failed: ${deleteError.message}`); // Debug log
            throw new Error(`Failed to delete file: ${deleteError.message}`);
        }
    } catch (error) {
        console.error(`Delete operation error: ${error.message}`); // Debug log
        return {
            content: [
                {
                    type: "text",
                    text: `Error deleting file: ${error.message}`
                }
            ],
            isError: true
        };
    }
}

// Export tool schema for registration
export const toolSchema = {
    name: "fileOperations",
    description: "Perform file system operations (read, write, append, delete, execute commands)",
    schema: {
        operation: z.enum(['read', 'write', 'append', 'delete', 'execute']).describe("The operation to perform"),
        path: z.string().optional().describe("File path for read/write/delete operations"),
        content: z.string().optional().describe("Content to write (for write/append operations)"),
        command: z.string().optional().describe("Command to execute (for execute operation)")
    }
};

// Main handler function
export async function handleFileOperation(args) {
    const { operation, path: filePath, content, command } = args;

    switch (operation) {
        case 'read':
            if (!filePath) throw new Error('File path is required for read operation');
            return await readFile(filePath);
            
        case 'write':
        case 'append':
            if (!filePath) throw new Error('File path is required for write/append operation');
            if (!content) throw new Error('Content is required for write/append operation');
            return await writeFile(filePath, content, operation);
            
        case 'delete':
            if (!filePath) throw new Error('File path is required for delete operation');
            return await deleteFile(filePath);
            
        case 'execute':
            if (!command) throw new Error('Command is required for execute operation');
            return await executeCommand(command);
            
        default:
            throw new Error(`Unknown operation: ${operation}`);
    }
} 