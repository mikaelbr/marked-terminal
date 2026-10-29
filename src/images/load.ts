import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LoadOptions {
  baseDir: string;
  remote: boolean;
  maxBytes: number;
}

const FETCH_TIMEOUT = 5000;

/**
 * Load the image bytes for an `href`: a local path, `file:` URL, `data:`
 * URI or (when allowed) an http(s) URL. Returns `undefined` when the image
 * can't be loaded, so the renderer falls back to text.
 */
export async function loadImage(
  href: string,
  options: LoadOptions
): Promise<Uint8Array | undefined> {
  try {
    if (/^data:/i.test(href)) return fromDataUri(href, options.maxBytes);
    if (/^https?:/i.test(href)) {
      return options.remote
        ? await fetchImage(href, options.maxBytes)
        : undefined;
    }
    // Other URL schemes. Single letters are Windows drive letters.
    if (/^[a-z][a-z\d+.-]+:/i.test(href) && !/^file:/i.test(href)) {
      return undefined;
    }
    const path = /^file:/i.test(href)
      ? fileURLToPath(href)
      : resolve(options.baseDir, decodeURI(href));
    if ((await stat(path)).size > options.maxBytes) return undefined;
    return await readFile(path);
  } catch {
    return undefined;
  }
}

function fromDataUri(href: string, maxBytes: number): Uint8Array | undefined {
  const base64 = /^data:[^,]*;base64,(.*)$/is.exec(href)?.[1];
  if (!base64 || base64.length * 0.75 > maxBytes) return undefined;
  return Buffer.from(base64, 'base64');
}

async function fetchImage(
  href: string,
  maxBytes: number
): Promise<Uint8Array | undefined> {
  const response = await fetch(href, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  if (!response.ok) return undefined;
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    return undefined;
  }
  const data = new Uint8Array(await response.arrayBuffer());
  return data.length > maxBytes ? undefined : data;
}
