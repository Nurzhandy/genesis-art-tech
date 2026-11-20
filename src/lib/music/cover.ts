// Обложки альбомов через наш прокси (план 20.11, B2): только известные CDN, только https.

const COVER_HOSTS = [/^([a-z0-9-]+\.)*dzcdn\.net$/, /^i\.scdn\.co$/, /^i\.ytimg\.com$/, /^([a-z0-9-]+\.)*mzstatic\.com$/];

export function isAllowedCoverUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  return COVER_HOSTS.some((re) => re.test(u.hostname.toLowerCase()));
}

export const coverProxyUrl = (coverUrl: string) => `/api/music/cover?url=${encodeURIComponent(coverUrl)}`;
