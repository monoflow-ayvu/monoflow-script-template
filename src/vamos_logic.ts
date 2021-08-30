import { Collection, StoreObjectI } from "@fermuch/telematree";
import { BaseEvent, BatterySensorEvent } from "@fermuch/telematree/src/events";
import { currentLogin, myID } from "./utils";
const SCRIPT_VER = '0.30';

export interface FrotaCollection {
  [deviceId: string]: {
    scriptVer: string;
    batteryLevel: number;
    appVer: string;
    lastEventAt: number;
    bleConnected: boolean;
    currentLogin: string;
  };
}

export interface BleCollection {
  [deviceId: string]: {
    id: string;
    target: string;
  }
}

declare type PathValue<T, K extends string> = K extends `${infer Root}.${infer Rest}` ? Root extends keyof T ? PathValue<T[Root], Rest> : never : (K extends keyof T ? T[K] : undefined);
declare type ValidatedPath<T, K extends string> = PathValue<T, K> extends never ? never : K;
export function setIfNotEqual<T extends StoreObjectI, P extends string>(
  col: Collection<T>,
  key: ValidatedPath<T, P>,
  val?: PathValue<T, P>
): void {
  // DEPRECATED: col.set now does this automatically
  col.set(key, val);
}

export default function install() {
  const appVer = Number(data.APP_BUILD_VERSION || '0');
  if (appVer < 112) {
    platform.log('omitiendo ejecutar script por tener versión de app incompatible. Versión actual: ', appVer);
    return
  }

  // check "Frota" collection
  platform.log('setting frota collection data');
  const frotaCol = env.project?.collectionsManager.ensureExists<FrotaCollection>("frota");
  setIfNotEqual(frotaCol, `${myID()}.scriptVer`, SCRIPT_VER);
  setIfNotEqual(frotaCol, `${myID()}.appVer`, data.APP_VERSION || 'unknown');

  // check "BLE" collection
  platform.log('setting ble collection data');
  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  setIfNotEqual(bleCol, `${myID()}.id`, myID());
  const foundBle = bleCol.typedStore[myID()]?.target || '';
  platform.log('ble data: ', bleCol.typedStore[myID()]);
  env.setData('BLE_TARGET', foundBle);

  // subscribe to events
  platform.log('registering for onEvent');
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
      deviceId: myID(),
      currentLogin: currentLogin(),
      event: this.base.toJSON(),
    }
  }
  
}

let lastEventAt = 0;
let lastBatteryAt = 0;
function onEventHandler(evt: BaseEvent): void {
  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  if (!frotaCol) {
    platform.log('error: no hay colección frota!');
    return
  }

  if (evt.kind === 'sensor-battery') {
    // once every 10 minutes
    if ((Date.now() - lastBatteryAt) >= 1000 * 60 * 10) {
      const ev = evt as BatterySensorEvent;
      setIfNotEqual(frotaCol, `${myID()}.batteryLevel`, ev.level);
      env.project?.saveEvent(new CustomEventExtended(ev));
      lastBatteryAt = Date.now();
    }
  }

  if (Date.now() - lastEventAt >= (1000 * 60 * 5)) {
    lastEventAt = Date.now();
    setIfNotEqual(frotaCol, `${myID()}.lastEventAt`, lastEventAt / 1000);
  }
}