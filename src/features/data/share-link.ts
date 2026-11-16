export function getSequenceCodeFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    return new URLSearchParams(url.hash.slice(1)).get('code');
  } catch {
    return null;
  }
}

export function createSequenceShareUrl(href: string, code: string): string {
  const url = new URL(href);
  url.hash = new URLSearchParams({ code }).toString();
  return url.toString();
}
