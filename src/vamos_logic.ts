import { collectionHasValue, ensureCollectionExists, setCollectionValue } from "./utils/collection";

export default function install() {
  // check "Frota" collection
  ensureCollectionExists('frota', 'Frota');

  // ensure our "Frota" collection has our object
  if (!collectionHasValue('frota', data.DEVICE_ID)) {
    setCollectionValue('frota', data.DEVICE_ID, {
      id: data.DEVICE_ID || '',
    });
  }
}