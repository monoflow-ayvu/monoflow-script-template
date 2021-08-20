export default function install() {
  // check "Frota" collection
  const frotaCol = env.project?.collectionsManager.ensureExists("frota");

  // ensure our "Frota" collection has our object
  if (!frotaCol.has(data.DEVICE_ID)) {
    frotaCol.set(data.DEVICE_ID, {
      id: data.DEVICE_ID || '',
    });
  }
}