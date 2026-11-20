const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INPUT = 15 * 1024 * 1024;
const fail = (userMessage) => Object.assign(new Error(userMessage), { userMessage });

// Valida, corrige a orientação, recorta em quadrado e reduz para JPEG (~100 KB).
// O arquivo enviado é sempre o resultado desta função, não o original.
export async function processPhoto(file) {
  if (file.type && !ALLOWED.includes(file.type)) throw fail('Formato não suportado. Use JPG, PNG ou WebP.');
  if (file.size > MAX_INPUT) throw fail('A foto é muito grande (máximo 15 MB).');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw fail('Não foi possível ler essa imagem. Tente outra foto.'); }
  const side = Math.min(bmp.width, bmp.height), size = Math.min(640, side);
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
  if (!blob || blob.size > 1048576) throw fail('Não foi possível preparar a foto. Tente outra.');
  return blob;
}
