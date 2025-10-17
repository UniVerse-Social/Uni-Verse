// server/routes/uploads.js
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

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

const uploadVideo = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^video\/(mp4|webm)$/i.test(file.mimetype);
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

const { promises: fsp } = fs;

const TMP_PREFIX = path.join(os.tmpdir(), 'fc-gif-');
const MAX_VIDEO_BYTES = 1.1 * 1024 * 1024; // target ~1 MB
const SECOND_PASS_WIDTH = 320;
const MAX_WIDTH = 512;
const MAX_DURATION = 4; // seconds
const MAX_FPS = 15;

const ensureTranscode = async (inputBuffer) => {
  const tmpDir = await fsp.mkdtemp(TMP_PREFIX);
  const inputPath = path.join(tmpDir, 'input.gif');
  const firstPassPath = path.join(tmpDir, 'out.webm');
  const secondPassPath = path.join(tmpDir, 'out-small.webm');
  await fsp.writeFile(inputPath, inputBuffer);

  const runFfmpeg = (outputPath, widthLimit, qualityCrf) =>
    new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions(['-y'])
        .outputOptions([
          '-c:v', 'libvpx-vp9',
          '-pix_fmt', 'yuva420p',
          '-b:v', '0',
          '-crf', String(qualityCrf),
          '-auto-alt-ref', '0',
          '-an',
          '-t', String(MAX_DURATION),
          '-vf', `scale='min(${widthLimit},iw)':-2:flags=lanczos,fps=${MAX_FPS},format=yuva420p`
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

  try {
    await runFfmpeg(firstPassPath, MAX_WIDTH, 32);
    let chosenPath = firstPassPath;
    let stats = await fsp.stat(chosenPath);
    if (stats.size > MAX_VIDEO_BYTES) {
      await runFfmpeg(secondPassPath, SECOND_PASS_WIDTH, 38);
      chosenPath = secondPassPath;
      stats = await fsp.stat(chosenPath);
      if (stats.size > MAX_VIDEO_BYTES) {
        const err = new Error('Animated sticker is too large after compression');
        err.code = 'TOO_LARGE';
        throw err;
      }
    }

    const videoBuffer = await fsp.readFile(chosenPath);
    const posterBuffer = await sharp(inputBuffer, { animated: true, pages: 1 })
      .resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    const posterMeta = await sharp(posterBuffer).metadata();

    return {
      videoBuffer,
      posterBuffer,
      width: posterMeta.width,
      height: posterMeta.height,
      bytes: stats.size,
      format: 'webm',
    };
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
};

router.post('/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });

    // Normalize/convert to webp, cap size
    let buf = req.file.buffer;
    const isGif = /gif$/i.test(req.file.mimetype);
    if (!isGif) {
      try {
        const meta = await sharp(buf).metadata();
        const pipeline = sharp(buf)
          .resize({ width: Math.min(meta.width || 1600, 1600), withoutEnlargement: true })
          .webp({ quality: 86 });
        buf = await pipeline.toBuffer();
      } catch (e) {
        console.warn('sharp error, passing original buffer:', e?.message || e);
      }
    }

    // Optional safety scan
    let scan = { safe: true, labels: [], score: 0 };
    if (!isGif) {
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
    }

    if (!scan.safe) {
      const userId = req.headers['x-user-id'] || req.body?.userId;
      if (userId) await addStrike(userId, 'image_nsfw');
      return res.status(400).json({ message: 'Image rejected by safety scanner', scan });
    }

    if (isGif) {
      try {
        const { videoBuffer, posterBuffer, width, height, bytes, format } = await ensureTranscode(buf);
        const base = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const videoName = `${base}.${format}`;
        const posterName = `${base}.webp`;
        await fsp.writeFile(path.join(uploadDir, videoName), videoBuffer);
        await fsp.writeFile(path.join(uploadDir, posterName), posterBuffer);

        return res.json({
          url: `/uploads/${videoName}`,
          type: 'video',
          poster: `/uploads/${posterName}`,
          width,
          height,
          duration: MAX_DURATION,
          size: bytes,
          format,
          autoPlay: true,
        });
      } catch (err) {
        if (err?.code === 'TOO_LARGE') {
          return res.status(413).json({ message: err.message });
        }
        console.error('GIF transcode failed:', err);
        return res.status(500).json({ message: 'Failed to process animated image' });
      }
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    await fsp.writeFile(path.join(uploadDir, filename), buf);

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

router.post('/video', uploadVideo.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const duration = Number(req.body.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ message: 'Video duration missing or invalid' });
    }
    if (duration > 20.2) {
      return res.status(400).json({ message: 'Video must be 20 seconds or shorter' });
    }

    const ext = /webm$/i.test(req.file.mimetype) ? '.webm' : '.mp4';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await fs.promises.writeFile(path.join(uploadDir, filename), req.file.buffer);

    res.json({
      url: `/uploads/${filename}`,
      type: 'video',
      duration: Math.round(duration * 100) / 100,
    });
  } catch (e) {
    console.error('Upload video failed:', e);
    res.status(500).json({ message: 'Upload failed' });
  }
});

module.exports = router;
