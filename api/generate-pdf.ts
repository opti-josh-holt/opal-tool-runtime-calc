import { mdToPdf } from 'md-to-pdf';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import chromium from '@sparticuz/chromium';

type GeneratePdfParams = {
  markdown: string;
  filename?: string;
};

export async function generatePdfFromMarkdown(
  params: GeneratePdfParams
): Promise<{ pdfUrl: string; expiresAt: string }> {
  const { markdown, filename } = params;
  
  const pdfFilename = filename ? `${filename}.pdf` : `document-${randomUUID()}.pdf`;
  const tempDir = '/tmp';
  const outputPath = path.join(tempDir, pdfFilename);
  
  try {
    console.log('Starting PDF generation...');
    
    // Configure Chromium for Vercel
    const executablePath = await chromium.executablePath();
    console.log('Chromium executable path:', executablePath);
    
    // Create custom CSS for Optimizely branding
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
        padding: 20px 0;
        margin-bottom: 30px;
        border-bottom: 2px solid #eee;
      }
      .optimizely-logo {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .logo-icon {
        width: 50px;
        height: 50px;
        position: relative;
      }
      .circle {
        position: absolute;
        width: 20px;
        height: 20px;
        border-radius: 50% 50% 0 50%;
      }
      .circle-1 { background: #7C3AED; top: 0; left: 15px; transform: rotate(-45deg); }
      .circle-2 { background: #FB923C; top: 0; right: 0; transform: rotate(45deg); }
      .circle-3 { background: #2563EB; bottom: 0; left: 0; transform: rotate(-135deg); }
      .circle-4 { background: #10B981; bottom: 0; left: 15px; transform: rotate(135deg); }
      .circle-5 { background: #06B6D4; bottom: 15px; left: 30px; transform: rotate(225deg); }
      .logo-text {
        font-size: 32px;
        font-weight: 600;
        color: #000;
        letter-spacing: -0.5px;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #1a1a1a;
        margin-top: 24px;
        margin-bottom: 12px;
      }
      h1 { font-size: 28px; }
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Courier New', monospace;
      }
      pre {
        background: #f5f5f5;
        padding: 16px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 16px 0;
      }
      ul, ol { padding-left: 24px; margin-bottom: 12px; }
      li { margin-bottom: 6px; }
      strong { font-weight: 600; }
    `;

    // Prepend the Optimizely header to the markdown content
    const markdownWithHeader = `
<div class="optimizely-header">
  <div class="optimizely-logo">
    <div class="logo-icon">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
      <div class="circle circle-4"></div>
      <div class="circle circle-5"></div>
    </div>
    <div class="logo-text">Optimizely</div>
  </div>
</div>

${markdown}`;

    const pdf = await mdToPdf(
      { content: markdownWithHeader },
      {
        launch_options: {
          executablePath: executablePath || undefined,
          args: chromium.args,
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
      }
    );

    if (!pdf?.content) {
      console.error('PDF generation returned no content');
      throw new Error('Failed to generate PDF content');
    }

    console.log('PDF generated successfully, writing to file...');
    await fs.writeFile(outputPath, pdf.content);
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
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function cleanupExpiredPdfs(): Promise<void> {
  try {
    const tempDir = '/tmp';
    const files = await fs.readdir(tempDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf') && file.includes('document-'));
    
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    for (const file of pdfFiles) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime < oneHourAgo) {
          await fs.unlink(filePath);
        }
      } catch (error) {
        // File might already be deleted, continue
      }
    }
  } catch (error) {
    // Cleanup is best effort, don't throw
  }
}