// import { StoreBasicValueT } from "@fermuch/telematree";

// type GenericCollection = Record<string, StoreBasicValueT>;

interface FrotaCollection {
  [deviceId: string]: {
    id: string;
    foo: number;
  };
}

interface BleCollection {
  [deviceId: string]: {
    id: string;
    target: string;
  }
}

interface MetricsCollection {
  [deviceId: string]: {
    id: string;
    bootTimes: number;
  }
}

export default function install() {
  const deviceId = data.DEVICE_ID || '';

  // check "Frota" collection
  const frotaCol = env.project?.collectionsManager.ensureExists<FrotaCollection>("frota");
  if (!frotaCol.has(deviceId)) {
    frotaCol.set(`${deviceId}.id`, deviceId);
    // frotaCol.set(`${deviceId}.foo`, deviceId);
  }

  // check "BLE" collection
  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  if (!bleCol.has(deviceId)) {
    bleCol.set(`${deviceId}.id`, deviceId);
  }
  const foundBle = bleCol.typedStore[deviceId].target || '';
  data.BLE_TARGET = foundBle;

  // check "metrics" collection
  const metricsCol = env.project?.collectionsManager.ensureExists<MetricsCollection>('metrics');
  if (!metricsCol.has(deviceId)) {
    metricsCol.set(`${deviceId}.id`, deviceId);
  }
  metricsCol.bump(`${deviceId}.bootTimes`, 1);
}