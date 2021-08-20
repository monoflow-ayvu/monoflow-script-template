import type { StoreValueT } from '@fermuch/telematree/src/tree/collections/collection'

type BleCollection = StoreValueT & {
  id: string;
  target: string;
}

type MetricsCollection = StoreValueT & {
  id: string;
  bootTimes: number;
}

export default function install() {
  // check "Frota" collection
  const frotaCol = env.project?.collectionsManager.ensureExists("frota");

  // ensure our "Frota" collection has our object
  if (!frotaCol.has(data.DEVICE_ID)) {
    frotaCol.set(data.DEVICE_ID, {
      id: data.DEVICE_ID || '',
    });
  }

  // check "BLE" collection
  const bleCol = env.project?.collectionsManager.ensureExists('ble');
  if (!frotaCol.has(data.DEVICE_ID)) {
    frotaCol.set(data.DEVICE_ID, {
      id: data.DEVICE_ID || '',
      target: '',
    } as BleCollection);
  }
  // ensure we set the connection to our target
  data.BLE_TARGET = (bleCol.store[data.DEVICE_ID] as BleCollection | undefined)?.target || '';


  
  // check "metrics" collection
  const metricsCol = env.project?.collectionsManager.ensureExists('metrics');
  if (!metricsCol.has(data.DEVICE_ID)) {
    metricsCol.set(data.DEVICE_ID, {
      id: data.DEVICE_ID || '',
      bootTimes: 0,
    } as MetricsCollection);
  }
  metricsCol.bump(`${data.DEVICE_ID}.bootTimes`, 1);
}