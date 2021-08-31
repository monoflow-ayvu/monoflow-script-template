import { Collection, StoreObjectI, Submission } from "@fermuch/telematree";
import { BaseEvent, BatterySensorEvent } from "@fermuch/telematree/src/events";
import { HourmetersCollection } from "./modules/hourmeters";
import { currentLogin, getNumber, myID, set } from "./utils";
const SCRIPT_VER = '0.41';

export interface FrotaCollection {
  [deviceId: string]: {
    scriptVer: string;
    batteryLevel: number;
    appVer: string;
    lastEventAt: number;
    bleConnected: boolean;
    currentLogin: string;
    loginDate: number;
    mttr: number;
    mtbf: number;
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

  platform.log('registering watcher for submits (MTTR/MTBF)')
  messages.on('onSubmit', onSubmit);
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


const CHAMADO_FORM_ID = '3eef6324-5791-478a-8311-372704147ba4'
const CONSERTO_FORM_ID = '9b71c55d-80d1-49aa-856b-d69782595d99'
function onSubmit(subm: Submission, taskId: string, formId: string) {
  if (formId === CHAMADO_FORM_ID) {
    onChamadoSubmit(subm, taskId, formId);
  } else if (formId === CONSERTO_FORM_ID) {
    onConsertoSubmit(subm, taskId, formId);
  }
}

function onChamadoSubmit(subm: Submission, taskId: string, formId: string) {
  // crear nueva tarea para el mecánico
  const deviceName = env.project?.usersManager.users.find((u) => u.$modelId === myID())?.prettyName || myID();
  const loginId = env.project?.currentLogin?.maybeCurrent?.prettyName || env.project?.currentLogin?.maybeCurrent?.prettyName || 'sem-nome';
  env.project?.tasksManager.create({
    name: `Manutenção: "${deviceName}" | "${loginId}"`,
    description: `Manutenção para: "${deviceName}", solicitada por: "${loginId}"`,
    done: false,
    formId: CONSERTO_FORM_ID,
    // sólo se va a mostrar a mecánicos, basado en el tag
    show: false,
    tags: ['manutencao', 'mecanico'],
  })

  // calcular MTBF
  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  if (!frotaCol) {
    platform.log('error: no hay colección frota!');
    return
  }

  const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');

  const lastHourmeter = getNumber('mtbf') || 0;
  const currentHourmeter = col.typedStore[myID()]?.io || 0;
  set('mtbf', currentHourmeter);
  if (lastHourmeter === 0) {
    platform.log('omitiendo mtbf por no tener dato previo')
    return
  }

  const lastStoredMTBF = frotaCol.typedStore[myID()]?.mtbf || 0;
  const newMTBF = (currentHourmeter - lastHourmeter);
  platform.log('new mtbf calculated value:', newMTBF);
  
  if (lastStoredMTBF === 0) {
    platform.log('guardando mtbf (primerizo):', newMTBF);
    frotaCol.set(`${myID()}.mtbf`, newMTBF);
  } else {
    const mtbf = (newMTBF + lastStoredMTBF) / 2;
    platform.log('guardando mtbf:', mtbf);
    frotaCol.set(`${myID()}.mtbf`, mtbf);
  }
}

function onConsertoSubmit(subm: Submission, taskId: string, formId: string) {
  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  if (!frotaCol) {
    platform.log('error: no hay colección frota!');
    return
  }
  const now = Date.now();
  const doneAt = env.project.currentTask?.maybeCurrent?.createdAt;
  if (!doneAt) {
    platform.log('error: no se encontró fecha de finalización de tarea');
    return
  }

  const totalHours = (now - doneAt) / 1000 / 60 / 60;
  const lastMTTR = frotaCol.typedStore[myID()]?.mttr || 0;
  const newMTTR = lastMTTR > 0 ? (totalHours + lastMTTR) / 2 : totalHours;
  platform.log('new MTTR: ', newMTTR);
  frotaCol.set(`${myID()}.mttr`, newMTTR);
}