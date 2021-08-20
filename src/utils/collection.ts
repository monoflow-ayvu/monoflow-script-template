import { Collection, StoreValueT } from '@fermuch/telematree/src/tree/collections/collection'

export function ensureCollectionExists(id: string, name?: string): Collection {
  let col = env.project?.collectionsManager.collections.find((c) => c.$modelId === id);
  if (!col) {
    col = new Collection({
      $modelId: id,
      name: name || id,
      store: {},
    })
    env.project?.collectionsManager.save(col);
  }

  return col;
}

export function setCollectionValue(colId: string, key: string, value: StoreValueT) {
  const col = ensureCollectionExists(colId);
  col.set(key, value);
}

export function bumpCollectionValue(colId: string, key: string, value: number) {
  const col = ensureCollectionExists(colId);
  col.set(key, Number(col.store[key] || 0) + value);
}

export function collectionHasValue(colId: string, key: string): boolean {
  const col = ensureCollectionExists(colId);
  return col.store[key] !== undefined;
}