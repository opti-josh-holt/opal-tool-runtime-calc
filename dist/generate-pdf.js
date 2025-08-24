"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePdfFromMarkdown = generatePdfFromMarkdown;
exports.cleanupExpiredPdfs = cleanupExpiredPdfs;
const md_to_pdf_1 = require("md-to-pdf");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
async function generatePdfFromMarkdown(params) {
    const { markdown, filename } = params;
    const pdfFilename = filename ? `${filename}.pdf` : `document-${(0, crypto_1.randomUUID)()}.pdf`;
    const tempDir = '/tmp';
    const outputPath = path_1.default.join(tempDir, pdfFilename);
    try {
        const pdf = await (0, md_to_pdf_1.mdToPdf)({ content: markdown }, {
            pdf_options: {
                format: 'A4',
                margin: {
                    top: '20mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                }
            }
        });
        if (!pdf?.content) {
            throw new Error('Failed to generate PDF content');
        }
        await fs_1.promises.writeFile(outputPath, pdf.content);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        return {
            pdfUrl: `/pdfs/${pdfFilename}`,
            expiresAt: expiresAt.toISOString()
        };
    }
    catch (error) {
        throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
async function cleanupExpiredPdfs() {
    try {
        const tempDir = '/tmp';
        const files = await fs_1.promises.readdir(tempDir);
        const pdfFiles = files.filter(file => file.endsWith('.pdf') && file.includes('document-'));
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        for (const file of pdfFiles) {
            const filePath = path_1.default.join(tempDir, file);
            try {
                const stats = await fs_1.promises.stat(filePath);
                if (stats.mtime < oneHourAgo) {
                    await fs_1.promises.unlink(filePath);
                }
            }
            catch (error) {
                // File might already be deleted, continue
            }
        }
    }
    catch (error) {
        // Cleanup is best effort, don't throw
    }
}
