import { StoreBasicValueT, Submission } from "@fermuch/telematree";
import { BaseEvent, BatterySensorEvent } from "@fermuch/telematree/src/events";
import { HourmetersCollection } from "./modules/hourmeters";
import { currentLogin, getNumber, myID, set } from "./utils";
const SCRIPT_VER = '1.11';

export interface FrotaCollection {
  scriptVer: string;
  batteryLevel: number;
  appVer: string;
  lastEventAt: number;
  bleConnected: boolean;
  currentLogin: string;
  loginDate: number;
  mttr: number;
  mtbf: number;

  [key: string]: StoreBasicValueT;
}

export interface BleCollection {
  id: string;
  target: string;

  [key: string]: StoreBasicValueT;
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
  frotaCol.set(myID(), 'scriptVer', SCRIPT_VER);
  frotaCol.set(myID(), 'appVer', data.APP_VERSION || 'unknown');

  // check "BLE" collection
  platform.log('setting ble collection data');
  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  bleCol.set(myID(), 'id', myID());
  const foundBle = bleCol.get(myID()).data.target || '';
  platform.log('ble data: ', bleCol.get(myID()).data);
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
      frotaCol.set(myID(), 'batteryLevel', ev.level);
      env.project?.saveEvent(new CustomEventExtended(ev));
      lastBatteryAt = Date.now();
    }
  }

  if (Date.now() - lastEventAt >= (1000 * 60 * 5)) {
    lastEventAt = Date.now();
    frotaCol.set(myID(), 'lastEventAt', lastEventAt / 1000);
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
  const statusAnswer = subm.data?.status || '';
  const problemAnswer = subm.data?.problema || '';
  const descAnswer = subm.data?.descricao || '';
  env.project?.tasksManager.create({
    name: `Manutenção: "${deviceName}" | "${loginId}"`,
    description: `Manutenção para: "${deviceName}", solicitada por: "${loginId}"\n\n\nEstado: ${statusAnswer}\n\nProblema: ${problemAnswer}\n\nDescrição: ${descAnswer}`,
    done: false,
    formId: CONSERTO_FORM_ID,
    show: true,
    // sólo se va a mostrar a mecánicos, basado en el tag
    tags: ['mecanico', 'manutencao'],
    metadata: {
      deviceId: myID() || '',
      deviceName: deviceName || '',
      loginId: env.project?.currentLogin?.maybeCurrent?.key || '',
      loginName: loginId || '',
      status: statusAnswer || '',
      problem: problemAnswer || '',
      desc: descAnswer || '',
    }
  })

  // calcular MTBF
  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  if (!frotaCol) {
    platform.log('error: no hay colección frota!');
    return
  }

  const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');

  const lastHourmeter = getNumber('mtbf') || 0;
  const currentHourmeter = col.get(myID()).data.io || 0;
  set('mtbf', currentHourmeter);
  if (lastHourmeter === 0) {
    platform.log('omitiendo mtbf por no tener dato previo')
    return
  }

  const lastStoredMTBF = frotaCol.get(myID()).data.mtbf || 0;
  const newMTBF = (currentHourmeter - lastHourmeter);
  platform.log('new mtbf calculated value:', newMTBF);
  
  if (lastStoredMTBF === 0) {
    platform.log('guardando mtbf (primerizo):', newMTBF);
    frotaCol.set(myID(), 'mtbf', newMTBF);
  } else {
    const mtbf = (newMTBF + lastStoredMTBF) / 2;
    platform.log('guardando mtbf:', mtbf);
    frotaCol.set(myID(), 'mtbf', mtbf);
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
  const lastMTTR = frotaCol.get(myID()).data.mttr || 0;
  const newMTTR = lastMTTR > 0 ? (totalHours + lastMTTR) / 2 : totalHours;
  platform.log('new MTTR: ', newMTTR);
  frotaCol.set(myID(), 'mttr', newMTTR);
}