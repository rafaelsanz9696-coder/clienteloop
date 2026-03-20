import { Router } from 'express';
import multer from 'multer';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/', 'video/', 'audio/',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument',
    ];
    const ok = allowed.some((t) => file.mimetype.startsWith(t));
    cb(null, ok);
  },
});

// POST /api/media/upload — upload a file from the agent composer to Supabase Storage
router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const file = req.file;
    const ext = file.originalname.split('.').pop() || 'bin';
    const yearMonth = new Date().toISOString().slice(0, 7);
    const storagePath = `media/${yearMonth}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await getSupabaseAdmin()
      .storage
      .from('media')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('[Media Upload] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    const { data } = getSupabaseAdmin().storage.from('media').getPublicUrl(storagePath);
    res.json({ url: data.publicUrl, name: file.originalname, mime: file.mimetype });
  } catch (err: any) {
    console.error('[Media Upload] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
