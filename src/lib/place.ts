// Подпись места по ответу OpenStreetMap: город + приметное место рядом (река, парк, пляж, гора).

export interface OsmAddress {
  name?: string;
  type?: string;
  category?: string;
  address?: Record<string, string | undefined>;
}

const NOTABLE = new Set(['river', 'water', 'lake', 'beach', 'park', 'peak', 'bay', 'reservoir', 'forest', 'garden', 'island', 'stream', 'canal']);

export function placeLabel(o: OsmAddress): string | null {
  const a = o.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county ?? a.state ?? null;
  // Река/озеро/парк рядом — то, что человек и сам назвал бы: «на Иртыше», «в парке Горького».
  const feature = (o.type && NOTABLE.has(o.type) ? o.name : null)
    ?? a.river ?? a.water ?? a.park ?? a.beach ?? a.leisure ?? a.natural ?? null;
  const parts = [city, feature && feature !== city ? feature : null].filter((x): x is string => !!x);
  return parts.length ? parts.join(', ').slice(0, 80) : null;
}
