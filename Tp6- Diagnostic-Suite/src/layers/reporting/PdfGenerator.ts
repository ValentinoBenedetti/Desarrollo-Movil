import RNFS from 'react-native-fs';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import { InstallationOrderInput } from '../../core/types';
import { ReportTemplate } from './ReportTemplate';

export interface GeneratedPdfReport {
  reportId: string;
  filePath: string;
  fileUri: string;
  sizeBytes: number;
  generatedAtUtc: string;
}

/**
 * Compiles corporate HTML installation reports into persistent local PDF documents
 * via `react-native-html-to-pdf`.
 */
export class PdfGenerator {
  /**
   * Generates a PDF document on the local device filesystem from an installation order.
   */
  public async generateInstallationPdf(
    order: InstallationOrderInput,
  ): Promise<GeneratedPdfReport> {
    const reportId = `RPT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const generatedAtUtc = new Date().toISOString();

    let photoBase64 = order.photoBase64;
    if (!photoBase64 && order.photoUri) {
      const cleanPath = order.photoUri.replace(/^file:\/\//, '');
      const exists = await RNFS.exists(cleanPath);
      if (exists) {
        const rawBase64 = await RNFS.readFile(cleanPath, 'base64');
        photoBase64 = `data:image/jpeg;base64,${rawBase64}`;
      }
    }

    const htmlContent = ReportTemplate.buildHtml({
      ...order,
      photoBase64,
      reportId,
      generatedAtUtc,
    });

    const sanitizedFileName = `installation_${reportId.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    const pdfResult = await RNHTMLtoPDF.convert({
      html: htmlContent,
      fileName: sanitizedFileName,
      directory: 'Documents',
      base64: false,
      width: 595, // A4 width in pt
      height: 842, // A4 height in pt
    });

    if (!pdfResult.filePath) {
      throw new Error('Native PDF conversion failed to return a valid file path');
    }

    const stat = await RNFS.stat(pdfResult.filePath);
    const fileUri = pdfResult.filePath.startsWith('file://')
      ? pdfResult.filePath
      : `file://${pdfResult.filePath}`;

    return {
      reportId,
      filePath: pdfResult.filePath,
      fileUri,
      sizeBytes: Number(stat.size) || 0,
      generatedAtUtc,
    };
  }

  /**
   * Reads a generated PDF from local storage as a base64 string for deferred sync upload.
   */
  public async readPdfAsBase64(pdfPathOrUri: string): Promise<string> {
    const cleanPath = pdfPathOrUri.replace(/^file:\/\//, '');
    return RNFS.readFile(cleanPath, 'base64');
  }
}

export const pdfGenerator = new PdfGenerator();

