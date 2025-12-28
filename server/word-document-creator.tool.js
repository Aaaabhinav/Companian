import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun, ExternalHyperlink } from 'docx';
import fse from 'fs-extra';

// Helper to ensure paths are within workspace
function validatePath(filePath) {
    const workspaceRoot = process.cwd();
    const resolvedPath = path.resolve(workspaceRoot, filePath);
    
    if (!resolvedPath.startsWith(workspaceRoot)) {
        throw new Error('Access denied: Path must be within workspace');
    }
    
    return resolvedPath;
}

// Create Word document with custom content
async function createWordDocument(content, outputFilePath, options = {}) {
    try {
        const safeOutputPath = validatePath(outputFilePath);
        
        // Create directory if it doesn't exist
        const dirPath = path.dirname(safeOutputPath);
        await fse.ensureDir(dirPath);
        
        // Default options
        const {
            title = "Document",
            author = "Generated Document",
            subject = "",
            description = "",
            includeTableOfContents = false,
            includePageNumbers = true,
            fontSize = 12,
            fontFamily = "Calibri"
        } = options;
        
        // Create document structure
        const children = [];
        
        // Title
        children.push(
            new Paragraph({
                text: title,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 }
            })
        );
        
        // Add spacing after title
        children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
        
        // Process content based on type
        if (typeof content === 'string') {
            // Simple text content
            const lines = content.split('\n').filter(line => line.trim());
            
            lines.forEach(line => {
                if (line.trim()) {
                    // Check if it's a heading (starts with number, #, or is all caps)
                    if (line.match(/^#\s+/) || line.match(/^\d+\./) || (line.match(/^[A-Z\s]+$/) && line.length > 3)) {
                        const headingText = line.replace(/^#\s+/, '').replace(/^\d+\.\s*/, '');
                        children.push(
                            new Paragraph({
                                text: headingText,
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200, after: 100 }
                            })
                        );
                    } else if (line.match(/^##\s+/)) {
                        const headingText = line.replace(/^##\s+/, '');
                        children.push(
                            new Paragraph({
                                text: headingText,
                                heading: HeadingLevel.HEADING_3,
                                spacing: { before: 150, after: 100 }
                            })
                        );
                    } else if (line.startsWith('- ') || line.startsWith('* ')) {
                        // Bullet points
                        const bulletText = line.replace(/^[-*]\s+/, '');
                        children.push(
                            new Paragraph({
                                text: bulletText,
                                bullet: { level: 0 },
                                spacing: { before: 50, after: 50 }
                            })
                        );
                    } else {
                        // Regular paragraph
                        children.push(
                            new Paragraph({
                                text: line,
                                spacing: { before: 50, after: 50 }
                            })
                        );
                    }
                }
            });
        } else if (Array.isArray(content)) {
            // Array of content objects
            content.forEach(item => {
                if (typeof item === 'string') {
                    children.push(
                        new Paragraph({
                            text: item,
                            spacing: { before: 50, after: 50 }
                        })
                    );
                } else if (item.type === 'heading') {
                    children.push(
                        new Paragraph({
                            text: item.text,
                            heading: item.level === 1 ? HeadingLevel.HEADING_1 : 
                                   item.level === 2 ? HeadingLevel.HEADING_2 : 
                                   item.level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2,
                            spacing: { before: 200, after: 100 }
                        })
                    );
                } else if (item.type === 'paragraph') {
                    children.push(
                        new Paragraph({
                            text: item.text,
                            spacing: { before: 50, after: 50 }
                        })
                    );
                } else if (item.type === 'table' && item.data) {
                    // Create table from data
                    const tableRows = [];
                    
                    // Header row
                    if (item.headers) {
                        const headerRow = new TableRow({
                            children: item.headers.map(header => 
                                new TableCell({
                                    children: [new Paragraph({ 
                                        children: [new TextRun({ text: header, bold: true })]
                                    })],
                                    shading: { fill: "E0E0E0" }
                                })
                            )
                        });
                        tableRows.push(headerRow);
                    }
                    
                    // Data rows
                    item.data.forEach(row => {
                        const tableRow = new TableRow({
                            children: row.map(cell => 
                                new TableCell({
                                    children: [new Paragraph({ text: String(cell) })]
                                })
                            )
                        });
                        tableRows.push(tableRow);
                    });
                    
                    children.push(
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: tableRows,
                            margins: { top: 200, bottom: 200 }
                        })
                    );
                }
            });
        } else if (typeof content === 'object') {
            // Object content - create structured document
            if (content.sections) {
                content.sections.forEach(section => {
                    if (section.title) {
                        children.push(
                            new Paragraph({
                                text: section.title,
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200, after: 100 }
                            })
                        );
                    }
                    
                    if (section.content) {
                        if (Array.isArray(section.content)) {
                            section.content.forEach(item => {
                                children.push(
                                    new Paragraph({
                                        text: item,
                                        spacing: { before: 50, after: 50 }
                                    })
                                );
                            });
                        } else {
                            children.push(
                                new Paragraph({
                                    text: section.content,
                                    spacing: { before: 50, after: 50 }
                                })
                            );
                        }
                    }
                });
            }
        }
        
        // Create document
        const doc = new Document({
            creator: author,
            title: title,
            subject: subject,
            description: description,
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: 1440,
                            right: 1440,
                            bottom: 1440,
                            left: 1440
                        }
                    }
                },
                children: children
            }]
        });
        
        // Generate the document
        const buffer = await Packer.toBuffer(doc);
        await fs.writeFile(safeOutputPath, buffer);
        
        return {
            content: [
                {
                    type: "text",
                    text: `Successfully created Word document: ${outputFilePath}`
                }
            ]
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error creating Word document: ${error.message}`
                }
            ],
            isError: true
        };
    }
}

// Export tool schema for registration
export const toolSchema = {
    name: "createWordDocument",
    description: "Create Word documents with custom content and formatting",
    schema: {
        content: z.string().describe("Content for the document (text, markdown-like formatting, or JSON structure)"),
        output_file: z.string().describe("Path for output Word document (e.g., 'output.doc' or 'report.docx')"),
        title: z.string().optional().describe("Document title"),
        author: z.string().optional().describe("Document author"),
        subject: z.string().optional().describe("Document subject"),
        description: z.string().optional().describe("Document description")
    }
};

// Main handler function
export async function handleWordDocumentCreator(args) {
    const { content, output_file, title, author, subject, description } = args;

    if (!content) throw new Error('Content is required');
    if (!output_file) throw new Error('Output file path is required');
    
    // Parse content if it's JSON
    let parsedContent = content;
    try {
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
            parsedContent = JSON.parse(content);
        }
    } catch (e) {
        // If JSON parsing fails, use as string
        parsedContent = content;
    }
    
    const options = {
        title: title || "Generated Document",
        author: author || "Document Creator",
        subject: subject || "",
        description: description || ""
    };
    
    return await createWordDocument(parsedContent, output_file, options);
} 