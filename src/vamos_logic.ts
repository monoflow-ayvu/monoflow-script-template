import { Collection, StoreObjectI } from "@fermuch/telematree";
import { BaseEvent, BatterySensorEvent } from "@fermuch/telematree/src/events";
const SCRIPT_VER = '0.17';

export interface FrotaCollection {
  [deviceId: string]: {
    id: string;
    scriptVer: string;
    focused: boolean;
    batteryLevel: number;
    batteryIsLow: boolean;
    appVer: string;
    currentLogin: string;
    lastLogin: string;
    lastEventAt: number;
    bleConnected: boolean;
    bleTarget: string;
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

declare type PathValue<T, K extends string> = K extends `${infer Root}.${infer Rest}` ? Root extends keyof T ? PathValue<T[Root], Rest> : never : (K extends keyof T ? T[K] : undefined);
declare type ValidatedPath<T, K extends string> = PathValue<T, K> extends never ? never : K;
export function setIfNotEqual<T extends StoreObjectI, P extends string>(
  col: Collection<T>,
  key: ValidatedPath<T, P>,
  val?: PathValue<T, P>
): void {
  const currentlyStoredValue = col.store[key];
  if (currentlyStoredValue !== val) {
    col.set(key, val);
  }
}

export default function install() {
  const deviceId = data.DEVICE_ID || '';
  const appVer = Number(data.APP_BUILD_VERSION || '0');
  if (appVer < 112) {
    platform.log('omitiendo ejecutar script por tener versión de app incompatible. Versión actual: ', appVer);
    return
  }

  // check "Frota" collection
  const frotaCol = env.project?.collectionsManager.ensureExists<FrotaCollection>("frota");
  setIfNotEqual(frotaCol, `${deviceId}.id`, deviceId);
  setIfNotEqual(frotaCol, `${deviceId}.scriptVer`, SCRIPT_VER);
  setIfNotEqual(frotaCol, `${deviceId}.appVer`, data.APP_VERSION || 'unknown');

  // check "BLE" collection
  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  setIfNotEqual(bleCol, `${deviceId}.id`, deviceId);
  const foundBle = bleCol.typedStore[deviceId].target || '';
  platform.log('ble data: ', bleCol.typedStore[deviceId]);
  env.setData('BLE_TARGET', foundBle);

  const currentStoredBleTarget = frotaCol.store['BLE_TARGET'];
  if (currentStoredBleTarget !== data.BLE_TARGET && data.BLE_TARGET) {
    setIfNotEqual(frotaCol, `${deviceId}.bleTarget`, data.BLE_TARGET);
  }

  // // check "metrics" collection
  // const metricsCol = env.project?.collectionsManager.ensureExists<MetricsCollection>('metrics');
  // metricsCol.set(`${deviceId}.id`, deviceId);
  // metricsCol.bump(`${deviceId}.bootTimes`, 1);

  // subscribe to events
  messages.on('onEvent', onEventHandler);
}

class CustomEventExtended extends BaseEvent {
  kind = "extended";
  base: BaseEvent;

  constructor(base: BaseEvent) {
    super();
    this.base = base;
  }

  getData() {
    return {
      deviceId: data.DEVICE_ID || '',
      currentLogin: env.currentLogin?.key || '',
      event: this.base.toJSON(),
    }
  }
  
}

let lastEventAt = 0;
function onEventHandler(evt: BaseEvent): void {
  // platform.log('recibido evento: ', evt);
  // env.project?.saveEvent(evt);

  const deviceId = data.DEVICE_ID || '';
  const frotaCol = env.project?.collectionsManager.collections.find((c) => c.$modelId === 'frota') as Collection<FrotaCollection> | undefined;
  if (!frotaCol) {
    platform.log('error: no hay colección frota!');
    return
  }
  // setIfNotEqual(frotaCol, `${deviceId}.lastEventAt`, Date.now());
  // setIfNotEqual(frotaCol, `${deviceId}.lastEventKind`, evt.kind);

  if (evt.kind === 'blur') {
    setIfNotEqual(frotaCol, `${deviceId}.focused`, false);
  } else if (evt.kind === 'focus') {
    setIfNotEqual(frotaCol, `${deviceId}.focused`, true);
  } else if (evt.kind === 'sensor-battery') {
    const ev = evt as BatterySensorEvent;
    setIfNotEqual(frotaCol, `${deviceId}.batteryLevel`, ev.level);
    setIfNotEqual(frotaCol, `${deviceId}.batteryIsLow`, ev.isLowPower);
    env.project?.saveEvent(new CustomEventExtended(ev));
  }

  if (Date.now() - lastEventAt >= (1000 * 60)) {
    lastEventAt = Date.now();
    setIfNotEqual(frotaCol, `${deviceId}.lastEventAt`, lastEventAt / 1000);
  }
}