// Compresses every raster <img> (jpg/png) that ends up in the build output
// into AVIF and WebP variants via sharp directly, and rewrites the markup to
// a <picture> element so browsers actually pick up the smaller formats.
// Runs only for `vite build` - dev serves the raw source images untouched
// (this project references every image as a plain string path from Twig/JSON
// data rather than a JS import, which is the only thing a module-graph-based
// tool like vite-imagetools can intercept - so dev stays uncompressed here).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const RASTER_IMAGE_RE = /\.(jpe?g|png)$/i;
const IMG_OR_PICTURE_RE =
  /<picture\b[^>]*>[\s\S]*?<\/picture>|<img\b[^>]*\/?>/gi;
const IMG_TAG_RE = /<img\b[^>]*>/i;
const SRC_ATTR_RE = /\ssrc=(["'])(.*?)\1/i;

function extractSrc(imgTag) {
  const match = imgTag.match(SRC_ATTR_RE);
  return match ? match[2] : null;
}

function buildSources(entry) {
  return ['avif', 'webp']
    .filter((format) => entry[format])
    .map(
      (format) => `<source type="image/${format}" srcset="/${entry[format]}">`,
    )
    .join('');
}

function* walkHtmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walkHtmlFiles(entryPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield entryPath;
    }
  }
}

function rewriteImgTags(html, converted) {
  return html.replace(IMG_OR_PICTURE_RE, (match) => {
    const isPicture = match[1] === 'p' || match[1] === 'P';
    const imgTag = isPicture ? match.match(IMG_TAG_RE)?.[0] : match;

    if (!imgTag) {
      return match;
    }

    const src = extractSrc(imgTag);
    const entry = src && converted.get(src.replace(/^\//, ''));

    if (!entry) {
      return match;
    }

    const sources = buildSources(entry);

    return isPicture
      ? match.replace(imgTag, sources + imgTag)
      : `<picture class="picture-reset">${sources}${imgTag}</picture>`;
  });
}

export default function avifWebpPlugin() {
  // Populated in generateBundle, consumed in writeBundle (see below for why
  // the HTML rewrite can't happen in generateBundle itself).
  let converted = new Map();

  return {
    name: 'avif-webp',
    apply: 'build',
    async generateBundle(_options, bundle) {
      converted = new Map();

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'asset' || !RASTER_IMAGE_RE.test(fileName)) {
          continue;
        }

        const source = Buffer.isBuffer(chunk.source)
          ? chunk.source
          : Buffer.from(chunk.source);
        const base = fileName.replace(/\.[^./]+$/, '');
        // rotate() with no args auto-orients from EXIF and bakes it into the
        // pixels - avif/webp EXIF-orientation support is spottier than
        // jpeg's, so bake it in rather than risk a sideways image.
        const image = sharp(source).rotate();

        const entry = {};
        for (const format of ['avif', 'webp']) {
          const outFileName = `${base}.${format}`;
          const outputBuffer = await image.clone()[format]().toBuffer();
          this.emitFile({
            type: 'asset',
            fileName: outFileName,
            source: outputBuffer,
          });
          entry[format] = outFileName;
        }

        converted.set(fileName, entry);
      }
    },
    // vituum renders the final Twig->HTML output and writes it to disk in its
    // own writeBundle hook (registered before this plugin, so it runs first)
    // under a final path that no longer matches the placeholder chunk name
    // seen in generateBundle (e.g. `src/pages/index.twig.html` -> `index.html`)
    // - so rather than trust the bundle's file list, just walk the actual
    // output directory for whatever .html files ended up there.
    async writeBundle(options) {
      if (!converted.size) {
        return;
      }

      const outDir =
        options.dir ?? path.dirname(options.file ?? 'dist/index.html');

      for (const filePath of walkHtmlFiles(outDir)) {
        const html = fs.readFileSync(filePath, 'utf-8');
        const rewritten = rewriteImgTags(html, converted);

        if (rewritten !== html) {
          fs.writeFileSync(filePath, rewritten, 'utf-8');
        }
      }
    },
  };
}
