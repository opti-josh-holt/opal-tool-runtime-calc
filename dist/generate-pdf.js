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
const chromium_1 = __importDefault(require("@sparticuz/chromium"));
async function generatePdfFromMarkdown(params) {
    const { markdown, filename } = params;
    const pdfFilename = filename ? `${filename}.pdf` : `document-${(0, crypto_1.randomUUID)()}.pdf`;
    const tempDir = '/tmp';
    const outputPath = path_1.default.join(tempDir, pdfFilename);
    try {
        console.log('Starting PDF generation...');
        // Configure Chromium for Vercel
        const executablePath = await chromium_1.default.executablePath();
        console.log('Chromium executable path:', executablePath);
        // Read the Optimizely SVG logo
        const logoPath = path_1.default.join(__dirname, 'assets', 'optimizely_logo.svg');
        const logoSvg = await fs_1.promises.readFile(logoPath, 'utf8');
        // Create custom CSS for professional document styling
        const customCSS = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 20px;
      }
      .optimizely-header {
        display: flex;
        align-items: center;
        padding: 20px 0 30px 0;
        margin-bottom: 30px;
        border-bottom: 2px solid #eee;
      }
      .optimizely-header svg {
        height: 40px;
        width: auto;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #1a1a1a;
        margin-top: 24px;
        margin-bottom: 12px;
      }
      h1 { font-size: 28px; }
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      h4 { font-size: 18px; }
      p { margin-bottom: 12px; }
      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Courier New', monospace;
        font-size: 0.9em;
      }
      pre {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 16px 0;
      }
      pre code {
        background: none;
        padding: 0;
      }
      ul, ol { padding-left: 24px; margin-bottom: 12px; }
      li { margin-bottom: 6px; }
      strong { font-weight: 600; }
      em { font-style: italic; }
      blockquote {
        border-left: 4px solid #ddd;
        margin: 16px 0;
        padding-left: 16px;
        color: #666;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 16px 0;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #f5f5f5;
        font-weight: 600;
      }
    `;
        // Prepend the Optimizely header to the markdown content
        const markdownWithHeader = `
<div class="optimizely-header">
  ${logoSvg}
</div>

${markdown}`;
        const pdf = await (0, md_to_pdf_1.mdToPdf)({ content: markdownWithHeader }, {
            launch_options: {
                executablePath: executablePath || undefined,
                args: chromium_1.default.args,
                headless: true,
            },
            pdf_options: {
                format: 'A4',
                margin: {
                    top: '15mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                }
            },
            css: customCSS,
            marked_options: {
                headerIds: false,
                mangle: false
            }
        });
        if (!pdf?.content) {
            console.error('PDF generation returned no content');
            throw new Error('Failed to generate PDF content');
        }
        console.log('PDF generated successfully, writing to file...');
        await fs_1.promises.writeFile(outputPath, pdf.content);
        console.log('PDF written to:', outputPath);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        // Use environment variable for base URL, fallback to Vercel URL pattern
        const baseUrl = process.env.BASE_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';
        const fullPdfUrl = `${baseUrl}/pdfs/${pdfFilename}`;
        console.log('Generated PDF URL:', fullPdfUrl);
        return {
            pdfUrl: fullPdfUrl,
            expiresAt: expiresAt.toISOString()
        };
    }
    catch (error) {
        console.error('PDF generation error:', error);
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
