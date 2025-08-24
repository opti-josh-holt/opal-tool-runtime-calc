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
    
    const pdf = await mdToPdf(
      { content: markdown },
      {
        launch_options: {
          executablePath: executablePath || undefined,
          args: chromium.args,
          headless: true,
        },
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          }
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

    return {
      pdfUrl: `/pdfs/${pdfFilename}`,
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