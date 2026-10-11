/** Brand-supplied names, in supplied order; duplicate Hibiscus removed at the owner's request. */
export const ingredientNames = [
  'Sesamum indicum',
  'Nigella sativa',
  'Ricinus communis',
  'Tocopherol',
  'Alkanna tinctoria',
  'Senna auriculata',
  'Jasminum officinale',
  'Rosa damascena',
  'Mentha piperita',
  'Coriandrum sativum',
  'Laurus nobilis',
  'Piper betle',
  'Lawsonia inermis',
  'Eclipta prostrata',
  'Sphagneticola trilobata',
  'Phyllanthus emblica',
  'Mimusops elengi',
  'Cinnamomum verum',
  'Matricaria chamomilla',
  'Santalum album',
  'Artemisia pallens',
  'Nelumbo nucifera',
  'Salvia rosmarinus',
  'Aloe barbadensis Miller',
  'Murraya koenigii',
  'Hibiscus rosa-sinensis',
  'Acalypha indica',
  'Ocimum tenuiflorum',
  'Prunus dulcis',
  'Cucurbita pepo',
  'Ocimum basilicum',
  'Capsicum annuum',
  'Coffea arabica',
  'Camellia sinensis',
  'Chrysopogon zizanioides',
  'Cassytha filiformis',
  'Psoralea corylifolia',
  'Rubia cordifolia',
  'Azadirachta indica',
  'Glycyrrhiza glabra',
  'Cyperus rotundus',
  'Beta vulgaris',
  'Daucus carota',
  'Helianthus annuus',
  'Clitoria ternatea',
  'Piper nigrum',
  'Linum usitatissimum',
  'Syzygium aromaticum',
  'Macrotyloma uniflorum',
  'Cinnamomum camphora',
  'Citrus sinensis',
  'Cocos nucifera',
] as const;

export const ingredients = ingredientNames.map((name, index) => ({
  id: index + 1,
  name,
  genus: name.split(' ')[0],
  detail: name.includes(' ') ? name.slice(name.indexOf(' ') + 1) : '',
  initial: name.charAt(0),
}));
export const ingredientCount = ingredients.length;
export const ingredientRanges = ['All ingredients', 'A–G', 'H–P', 'Q–Z'] as const;
export type IngredientRange = typeof ingredientRanges[number];
export function filterIngredients(query: string, range: IngredientRange = 'All ingredients', sort: 'original' | 'alphabetical' = 'original') {
  const needle = query.trim().toLocaleLowerCase();
  const items = ingredients.filter(item => {
    const matchesSearch = item.name.toLocaleLowerCase().includes(needle);
    const matchesRange = range === 'All ingredients' || (range === 'A–G' && item.initial <= 'G') ||
      (range === 'H–P' && item.initial >= 'H' && item.initial <= 'P') || (range === 'Q–Z' && item.initial >= 'Q');
    return matchesSearch && matchesRange;
  });
  return sort === 'alphabetical' ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : items;
}
