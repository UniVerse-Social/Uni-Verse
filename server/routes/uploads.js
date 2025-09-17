// server/routes/uploads.js
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

let tf = null, nsfw = null;
try { tf = require('@tensorflow/tfjs-node'); } catch { /* ok: may be missing */ }
try { nsfw = require('nsfwjs'); } catch { /* ok: may be missing */ }

const { addStrike } = require('../middleware/moderation');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

let modelPromise = null;
async function getModel() {
  // disabled via env OR missing deps -> skip scanning
  if ((process.env.NSFW_ENABLED || 'true').toLowerCase() === 'false') return null;
  if (!tf || !nsfw) return null;
  if (!modelPromise) {
    modelPromise = nsfw.load().catch((e) => {
      console.warn('NSFW model load failed; continuing without scan:', e?.message || e);
      return null;
    });
  }
  return modelPromise;
}

router.post('/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });

    // Normalize/convert to webp, cap size
    let buf = req.file.buffer;
    try {
      const meta = await sharp(buf).metadata();
      const pipeline = sharp(buf)
        .resize({ width: Math.min(meta.width || 1600, 1600), withoutEnlargement: true })
        .webp({ quality: 86 });
      buf = await pipeline.toBuffer();
    } catch (e) {
      console.warn('sharp error, passing original buffer:', e?.message || e);
    }

    // Optional safety scan
    let scan = { safe: true, labels: [], score: 0 };
    try {
      const model = await getModel();
      if (model && tf) {
        const tensor = tf.node.decodeImage(buf, 3);
        const preds = await model.classify(tensor);
        tensor.dispose();
        scan.labels = preds.map(p => `${p.className}:${p.probability.toFixed(2)}`);
        const pornish = preds.find(p => ['Porn', 'Hentai', 'Sexy'].includes(p.className));
        scan.score = pornish ? pornish.probability : 0;
        scan.safe = scan.score < 0.8;
      }
    } catch (e) {
      console.warn('scanner failed, allowing upload:', e?.message || e);
      scan.safe = true;
    }

    if (!scan.safe) {
      const userId = req.headers['x-user-id'] || req.body?.userId;
      if (userId) await addStrike(userId, 'image_nsfw');
      return res.status(400).json({ message: 'Image rejected by safety scanner', scan });
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    await fs.promises.writeFile(path.join(uploadDir, filename), buf);

    res.json({
      url: `/uploads/${filename}`,
      type: 'image',
      width: undefined,
      height: undefined,
      scan,
    });
  } catch (e) {
    console.error('Upload failed:', e);
    res.status(500).json({ message: 'Upload failed' });
  }
});

module.exports = router;
