// API para subir backups a S3 de Hetzner
// Este archivo se puede usar con un servidor Express o similar

import crypto from 'crypto';

interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

/**
 * Subir archivo a S3 compatible (Hetzner)
 */
export async function uploadBackupToS3(
  backupData: any,
  fileName: string,
  config: S3Config
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const jsonContent = JSON.stringify(backupData, null, 2);
    const contentLength = Buffer.from(jsonContent).length;

    // Construir URL
    const url = `${config.endpoint}/${config.bucket}/${fileName}`;

    // Fecha para headers
    const date = new Date().toUTCString();

    console.log('📤 Subiendo a S3:', url);

    // Hacer petición PUT a S3
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': contentLength.toString(),
        'Date': date,
        'Authorization': `AWS ${config.accessKey}:${config.secretKey}`,
        'x-amz-acl': 'private',
      },
      body: jsonContent,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error S3:', response.status, errorText);
      throw new Error(`Error S3: ${response.status}`);
    }

    console.log('✅ Subido exitosamente');

    return {
      success: true,
      url,
    };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
