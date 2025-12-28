import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
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

// Create Word document from text file
async function createDocFromText(inputFilePath, outputFilePath) {
    try {
        const safeInputPath = validatePath(inputFilePath);
        const safeOutputPath = validatePath(outputFilePath);
        
        // Read the text file
        const textContent = await fs.readFile(safeInputPath, 'utf-8');
        
        // Create directory if it doesn't exist
        const dirPath = path.dirname(safeOutputPath);
        await fse.ensureDir(dirPath);
        
        // Split content into lines
        const lines = textContent.split('\n').filter(line => line.trim());
        
        // Create document structure
        const children = [
            // Title
            new Paragraph({
                text: "LABORATORY EVALUATION REPORT",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 }
            }),
            
            new Paragraph({ text: "", spacing: { before: 400 } }),
            
            // Student information table
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: "Student Name:", bold: true })]
                                })],
                                width: { size: 30, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "_________________" })],
                                width: { size: 70, type: WidthType.PERCENTAGE }
                            })
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: "Roll Number:", bold: true })]
                                })]
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "_________________" })]
                            })
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [new TextRun({ text: "Date:", bold: true })]
                                })]
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: new Date().toLocaleDateString() })]
                            })
                        ]
                    })
                ]
            }),
            
            new Paragraph({ text: "", spacing: { before: 400 } }),
            
            // Content from text file
            new Paragraph({
                text: "EXPERIMENT CONTENT",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            })
        ];
        
        const doc = new Document({
            sections: [{
                properties: {},
                children: children
            }]
        });
        
        // Add content from text file
        const contentChildren = [];
        lines.forEach(line => {
            if (line.trim()) {
                // Check if it's a heading (starts with number or is all caps)
                if (line.match(/^\d+\./) || line.match(/^[A-Z\s]+$/) && line.length > 3) {
                    contentChildren.push(
                        new Paragraph({
                            text: line,
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 200, after: 100 }
                        })
                    );
                } else {
                    contentChildren.push(
                        new Paragraph({
                            text: line,
                            spacing: { before: 50, after: 50 }
                        })
                    );
                }
            }
        });
        
        // Add all content children to the main children array
        children.push(...contentChildren);
        
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
    name: "simpleDocCreator",
    description: "Create Word documents from text files",
    schema: {
        input_file: z.string().describe("Path to input text file"),
        output_file: z.string().describe("Path for output Word document")
    }
};

// Main handler function
export async function handleSimpleDocCreator(args) {
    const { input_file, output_file } = args;

    if (!input_file) throw new Error('Input file path is required');
    if (!output_file) throw new Error('Output file path is required');
    
    return await createDocFromText(input_file, output_file);
} 