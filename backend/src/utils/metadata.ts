/**
 * Convert any metadata value to a list of strings.
 * Used for extracting credit information from FLAC tags.
 */
export const toStringList = (val: unknown): string[] => {
  if (val === null || val === undefined) return [];
  if (typeof val === 'string') return [val];
  if (typeof val === 'number' || typeof val === 'boolean') return [String(val)];
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) return []; // binary – skip
  if (Array.isArray(val)) {
    return val.flatMap(item => toStringList(item));
  }
  // Object – try common text-carrying shapes
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj['text'] === 'string' && obj['text']) return [obj['text']];
    if (typeof obj['dB'] === 'number') return [`${obj['dB'].toFixed(2)} dB`];
    if ('no' in obj && 'of' in obj) return [];
    return [];
  }
  return [];
};

