/**
 * 浏览器端 FLAC VorbisComment 轻量解析器
 * 不依赖任何 npm 包，仅读取 TITLE / ALBUM / TRACKNUMBER
 */
export interface FlacTags {
  title: string;
  album: string;
  track_number: string;
}

export async function readFlacTagsBrowser(file: File): Promise<FlacTags> {
  const buf = new Uint8Array(await file.arrayBuffer());

  // 1. FLAC magic: 'fLaC'
  if (buf[0] !== 0x66 || buf[1] !== 0x4C || buf[2] !== 0x61 || buf[3] !== 0x43) {
    return { title: file.name.replace(/\.flac$/i, ''), album: '', track_number: '' };
  }

  let pos = 4;
  const tags: Record<string, string> = {};

  // 2. Walk metadata blocks
  let isLast = false;
  while (pos < buf.length && !isLast) {
    const header = buf[pos];
    isLast = !!(header & 0x80);
    const blockType = header & 0x7F;
    const blockSize = (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3];
    pos += 4;

    if (pos + blockSize > buf.length) break;

    if (blockType === 4) {
      // VORBIS_COMMENT
      const blockData = buf.slice(pos, pos + blockSize);
      try {
        parseVorbisComment(new DataView(blockData.buffer, blockData.byteOffset, blockData.byteLength), tags);
      } catch { /* malformed → skip */ }
      break; // VorbisComment is enough
    }

    pos += blockSize;
  }

  return {
    title: tags.TITLE || file.name.replace(/\.flac$/i, ''),
    album: tags.ALBUM || '',
    track_number: tags.TRACKNUMBER || '',
  };
}

function parseVorbisComment(view: DataView, tags: Record<string, string>): void {
  let off = 0;
  // Vendor string length (little-endian)
  const vendorLen = view.getUint32(off, true);
  off += 4 + vendorLen;

  // Comment count
  const count = view.getUint32(off, true);
  off += 4;

  // VORBIS_COMMENT 字符串是 UTF-8 编码，需要用 TextDecoder 正确解码
  const decoder = new TextDecoder('utf-8');

  for (let i = 0; i < count; i++) {
    if (off + 4 > view.byteLength) break;
    const len = view.getUint32(off, true);
    off += 4;
    if (off + len > view.byteLength) break;

    // 用 TextDecoder 把 UTF-8 字节正确解码为 JS 字符串（支持中文等多字节字符）
    const str = decoder.decode(new Uint8Array(view.buffer, view.byteOffset + off, len));
    off += len;

    const eq = str.indexOf('=');
    if (eq > 0) {
      const key = str.slice(0, eq).toUpperCase();
      if (key === 'TITLE' || key === 'ALBUM' || key === 'TRACKNUMBER') {
        tags[key] = str.slice(eq + 1).trim();
      }
    }
  }
}
