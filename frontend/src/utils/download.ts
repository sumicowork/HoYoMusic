/**
 * Shared Blob download utilities for service layer.
 */

/**
 * Parse filename from Content-Disposition header.
 * Supports RFC 5987 `filename*=UTF-8''...` and plain `filename="..."`.
 *
 * @param contentDisposition - The Content-Disposition header value.
 * @param fallback           - Default filename when parsing fails.
 */
export const parseDownloadFileName = (contentDisposition?: string, fallback = 'export.json'): string => {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/(^"|"$)/g, '');
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return fallback;
};

/**
 * Attempt to extract a human-readable error message from an error Blob response.
 * Returns `null` if the body is not JSON or does not contain `error.message`.
 */
export const extractBlobErrorMessage = async (blob: Blob): Promise<string | null> => {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || null;
  } catch {
    return null;
  }
};
