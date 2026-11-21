/**
 * Token artwork resolution — mirrors the extension's `parseTokenImageUrl`.
 *
 * Token metadata carries artwork in several shapes: a URL, an `<artimage>`
 * wrapper around base64 (how Minima serialises NFT images), an `ipfs://` URI,
 * or raw hex of the image bytes. All of them have to render as a `src`, or a
 * token shows a bare letter while the extension shows its logo.
 */

function detectImageMimeFromHex(hex: string): string | undefined {
  const lower = hex.toLowerCase();
  if (lower.startsWith('89504e47')) return 'image/png';
  if (lower.startsWith('ffd8ff')) return 'image/jpeg';
  if (lower.startsWith('47494638')) return 'image/gif';
  if (lower.startsWith('52494646') && lower.substring(16, 24) === '57454250') return 'image/webp';
  if (lower.startsWith('3c737667') || lower.startsWith('3c3f786d')) return 'image/svg+xml';
  return undefined;
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function parseTokenImageUrl(url?: string): string | undefined {
  if (!url || url.trim() === '') return undefined;

  const trimmed = url.trim();

  if (trimmed.startsWith('<artimage>')) {
    let base64Data = trimmed.slice('<artimage>'.length).trim();
    if (base64Data.endsWith('</artimage>')) {
      base64Data = base64Data.slice(0, -'</artimage>'.length).trim();
    }
    if (!base64Data) return undefined;
    if (base64Data.startsWith('data:image/')) return base64Data;
    if (base64Data.startsWith('iVBOR')) return `data:image/png;base64,${base64Data}`;
    return `data:image/jpeg;base64,${base64Data}`;
  }

  if (trimmed.startsWith('data:image/')) return trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  if (trimmed.startsWith('ipfs://')) {
    let path = trimmed.slice('ipfs://'.length);
    if (path.startsWith('ipfs/')) path = path.slice('ipfs/'.length);
    return `https://ipfs.io/ipfs/${path}`;
  }

  if (trimmed.startsWith('ipfs/')) {
    return `https://ipfs.io/ipfs/${trimmed.slice('ipfs/'.length)}`;
  }

  const hexBody = trimmed.startsWith('0x') ? trimmed.slice(2) : null;
  if (hexBody && hexBody.length >= 8 && /^[0-9a-fA-F]+$/.test(hexBody)) {
    const mime = detectImageMimeFromHex(hexBody);
    if (mime) {
      try {
        return `data:${mime};base64,${hexToBase64(hexBody)}`;
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

/** Artwork for a portfolio entry, trying each metadata field in turn. */
export function tokenArtwork(entry: {
  icon?: string | null;
  url?: string | null;
  artimage?: string | null;
}): string | undefined {
  return (
    parseTokenImageUrl(entry.icon ?? undefined) ||
    parseTokenImageUrl(entry.url ?? undefined) ||
    parseTokenImageUrl(entry.artimage ?? undefined)
  );
}
