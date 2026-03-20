import { getSupabaseAdmin } from './supabase-admin.js';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/webp; codecs=vp8': 'webp',
};

/**
 * Downloads a Meta WhatsApp media file and uploads it to Supabase Storage.
 * Returns the public URL of the stored file.
 *
 * NOTE: Meta media URLs expire within minutes — this must be called synchronously
 * inside the webhook handler before any async delays.
 */
export async function downloadAndStoreMetaMedia(
  mediaId: string,
  mimeType: string,
  filename?: string,
): Promise<string> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_ACCESS_TOKEN not configured');

  // Step 1: Get the temporary download URL from Meta
  const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) {
    throw new Error(`Meta media lookup failed: ${metaRes.status} ${await metaRes.text()}`);
  }
  const { url: downloadUrl } = await metaRes.json() as { url: string };

  // Step 2: Download the binary content
  const fileRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Meta media download failed: ${fileRes.status}`);
  }
  const arrayBuffer = await fileRes.arrayBuffer();

  // Step 3: Determine file extension
  const baseMime = mimeType.split(';')[0].trim();
  const ext = filename?.split('.').pop() || MIME_TO_EXT[baseMime] || 'bin';
  const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const storagePath = `media/${yearMonth}/${mediaId}.${ext}`;

  // Step 4: Upload to Supabase Storage (upsert=true for idempotency on webhook retries)
  const { error } = await getSupabaseAdmin()
    .storage
    .from('media')
    .upload(storagePath, Buffer.from(arrayBuffer), {
      contentType: baseMime,
      upsert: true,
    });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  // Step 5: Return the public URL
  const { data } = getSupabaseAdmin().storage.from('media').getPublicUrl(storagePath);
  return data.publicUrl;
}
