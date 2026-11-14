import type { Card, Library } from './model';

export function indexLibrary(data: Library) {
  const areas = new Map(data.areas.map(area => [area.id, area]));
  const decks = new Map(data.decks.map(deck => [deck.id, deck]));
  const cardsByArea = new Map<string, Card[]>();
  const activeCardCounts = new Map<string, number>();

  for (const card of data.cards) {
    const areaId = decks.get(card.deckId)?.areaId;
    if (areaId === undefined) continue;

    const cards = cardsByArea.get(areaId);
    if (cards) cards.push(card);
    else cardsByArea.set(areaId, [card]);

    if (!card.deleted) activeCardCounts.set(areaId, (activeCardCounts.get(areaId) ?? 0) + 1);
  }

  return { areas, decks, cardsByArea, activeCardCounts };
}
