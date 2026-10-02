// Compression des photos dans le navigateur, avant l'envoi vers Firestore.
// Une photo de téléphone (3–8 Mo) devient une image WebP de ~200–700 Ko,
// ce qui tient dans la limite de 1 Mo par document Firestore.

let webpSupported;
function encoderType() {
  if (webpSupported === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupported ? 'image/webp' : 'image/jpeg';
}

/** Décode un fichier ou une data URL en tenant compte de l'orientation EXIF. */
export async function decodeImage(source) {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
  if (!blob.type.startsWith('image/')) throw new Error(`« ${blob.name || 'fichier'} » n'est pas une image.`);
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }
}

function draw(img, maxDim) {
  const w0 = img.width, h0 = img.height;
  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Encode l'image en réduisant qualité puis dimensions jusqu'à passer sous maxChars.
 * @returns {{ data: string, width: number, height: number }}
 */
export function encode(img, { maxDim, maxChars }) {
  const type = encoderType();
  let dim = maxDim;
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = draw(img, dim);
    for (const q of [0.86, 0.8, 0.72, 0.64, 0.56]) {
      const data = canvas.toDataURL(type, q);
      if (data.length <= maxChars) return { data, width: canvas.width, height: canvas.height };
    }
    dim = Math.round(dim * 0.8);
  }
  throw new Error('Image impossible à compresser suffisamment.');
}

export const FULL = { maxDim: 2000, maxChars: 900_000 };   // photo affichée en grand
export const THUMB = { maxDim: 720, maxChars: 110_000 };   // vignette de couverture
export const PROFILE = { maxDim: 1000, maxChars: 450_000 }; // photo de profil

/** Prépare une photo : version grande + vignette. */
export async function processPhoto(file) {
  const img = await decodeImage(file);
  try {
    const full = encode(img, FULL);
    const thumb = encode(img, THUMB);
    return { full, thumb };
  } finally { img.close?.(); }
}

/** Recalcule une vignette à partir d'une image déjà enregistrée. */
export async function thumbFromDataUrl(dataUrl) {
  const img = await decodeImage(dataUrl);
  try { return encode(img, THUMB).data; } finally { img.close?.(); }
}
