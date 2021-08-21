// import { StoreBasicValueT } from "@fermuch/telematree";

// type GenericCollection = Record<string, StoreBasicValueT>;

type BleCollection = {
  id: string;
  target: string;
}

type MetricsCollection = {
  id: string;
  bootTimes: number;
}

export default function install() {
  // check "Frota" collection
  const frotaCol = env.project?.collectionsManager.ensureExists("frota");
  if (!frotaCol.has(data.DEVICE_ID)) {
    frotaCol.set(`${data.DEVICE_ID}.id`, data.DEVICE_ID || '');
  }

  // check "BLE" collection
  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  if (!bleCol.has(data.DEVICE_ID)) {
    bleCol.set(`${data.DEVICE_ID}.id`, data.DEVICE_ID);
  }
  const foundBle = (bleCol.store[data.DEVICE_ID] as BleCollection | undefined)?.target || '';
  data.BLE_TARGET = foundBle;

  // check "metrics" collection
  const metricsCol = env.project?.collectionsManager.ensureExists<MetricsCollection>('metrics');
  if (!metricsCol.has(data.DEVICE_ID)) {
    metricsCol.set(`${data.DEVICE_ID}.id`, data.DEVICE_ID);
  }
  metricsCol.set(
    `${data.DEVICE_ID}.bootTimes`,
    Number((metricsCol.store[data.DEVICE_ID] as MetricsCollection | undefined)?.bootTimes || 0) + 1
  );
  // TODO: when new version of telematree is deployed, use:
  // metricsCol.bump(`${data.DEVICE_ID}.bootTimes`, 1);
}