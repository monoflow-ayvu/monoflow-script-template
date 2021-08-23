import { BaseEvent, BatterySensorEvent, BlurEvent } from "@fermuch/telematree/src/events";
const SCRIPT_VER = '0.11';

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
  }
  frotaCol.set(`${deviceId}.scriptVer`, SCRIPT_VER);
  frotaCol.set(`${deviceId}.appVer`, data.APP_VERSION || 'unknown');

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

  // subscribe to events
  messages.on('onEvent', onEventHandler);
}

function onEventHandler(evt: BaseEvent): void {
  // platform.log('recibido evento: ', evt);
  // env.project?.saveEvent(evt);

  const deviceId = data.DEVICE_ID || '';
  const frotaCol = env.project?.collectionsManager.ensureExists<FrotaCollection>("frota");
  // frotaCol.set(`${deviceId}.lastEventAt`, Date.now());
  // frotaCol.set(`${deviceId}.lastEventKind`, evt.kind);

  if (evt.kind === 'blur') {
    frotaCol.set(`${deviceId}.focused`, false);
  } else if (evt.kind === 'focus') {
    frotaCol.set(`${deviceId}.focused`, true);
  } else if (evt.kind === 'sensor-battery') {
    const ev = evt as BatterySensorEvent;
    frotaCol.set(`${deviceId}.batteryLevel`, ev.level);
    frotaCol.set(`${deviceId}.batteryIsLow`, ev.isLowPower);
    env.project?.saveEvent(ev);
  }
}