import { Capacitor } from '@capacitor/core';
import { AppInstaller } from './appUpdateService';
import type { jsPDF } from 'jspdf';

export interface SaveFileOptions {
  filename: string;
  mimeType: string;
  data: jsPDF | Blob | string;
}

/**
 * Universally saves/downloads a file.
 * On Android (Capacitor Native): Saves directly to the public Android Downloads folder (/storage/emulated/0/Download/)
 * and indexes it via MediaScanner so it appears immediately in the Downloads & Files app.
 * In Web Browser: Uses standard HTML5 blob download link.
 */
export async function saveFile(options: SaveFileOptions): Promise<boolean> {
  const { filename, mimeType, data } = options;

  if (Capacitor.isNativePlatform()) {
    try {
      let base64Data = '';

      if (typeof (data as any)?.output === 'function') {
        // jsPDF instance
        const pdfInstance = data as jsPDF;
        const dataUri = pdfInstance.output('datauristring');
        base64Data = dataUri.split(',')[1] || '';
      } else if (data instanceof Blob) {
        base64Data = await blobToBase64(data);
      } else if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          base64Data = data.split(',')[1] || '';
        } else {
          // Plain text / XML / GPX string
          base64Data = btoa(unescape(encodeURIComponent(data)));
        }
      }

      if (base64Data) {
        const res = await AppInstaller.saveFileToDownloads({
          base64Data,
          filename,
          mimeType,
        });
        if (res?.success) {
          return true;
        }
      }
    } catch (err) {
      console.warn('[FileDownload] Native saveFileToDownloads failed, falling back to browser download:', err);
    }
  }

  // Fallback / Web download
  try {
    if (typeof (data as any)?.save === 'function') {
      (data as jsPDF).save(filename);
      return true;
    }

    if (typeof data === 'string' && data.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = data;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: mimeType });
    } else {
      throw new Error('Unsupported data format for download');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('[FileDownload] Download failed completely:', err);
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      if (res && res.includes(',')) {
        resolve(res.split(',')[1]);
      } else {
        resolve(res || '');
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
