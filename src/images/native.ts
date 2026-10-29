const ESC = '\u001b';
const ST = `${ESC}\\`;

// Terminals don't report their cell size in pixels without a round trip,
// so assume a common cell width to size images naturally.
const CELL_WIDTH = 10;

/** Columns an image takes up at its natural size, at most `maxColumns`. */
export function fitColumns(widthPx: number, maxColumns: number): number {
  return Math.max(1, Math.min(maxColumns, Math.ceil(widthPx / CELL_WIDTH)));
}

/**
 * Draw a PNG with the Kitty graphics protocol. The height follows from the
 * aspect ratio when only the width is given.
 * https://sw.kovidgoyal.net/kitty/graphics-protocol/
 */
export function kitty(png: Uint8Array, columns: number): string {
  const base64 = Buffer.from(png).toString('base64');
  let out = '';
  for (let at = 0; at < base64.length; at += 4096) {
    const more = at + 4096 < base64.length ? 1 : 0;
    // q=2 stops the terminal from answering, which would show up as input
    const control = at ? 'q=2' : `a=T,f=100,c=${columns},q=2`;
    out += `${ESC}_G${control},m=${more};${base64.slice(at, at + 4096)}${ST}`;
  }
  return out;
}

/**
 * Draw an image of any format the terminal can decode with the iTerm2
 * inline images protocol.
 * https://iterm2.com/documentation-images.html
 */
export function iterm2(data: Uint8Array, columns: number): string {
  const base64 = Buffer.from(data).toString('base64');
  return `${ESC}]1337;File=inline=1;size=${data.length};width=${columns};preserveAspectRatio=1:${base64}\u0007`;
}
