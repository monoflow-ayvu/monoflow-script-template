import { BaseEvent } from "@fermuch/telematree";

// import collisionInstaller from './modules/collision/collision';
import gpsInstaller from './modules/gps/gps';
import hourmeterInstaller, { HourmetersCollection } from './modules/hourmeters/hourmeters';

import vamosScriptInstaller, { BleCollection, FrotaCollection } from './vamos_logic';
import { StoreBasicValueT } from '@fermuch/telematree';
import { currentLogin, getString, myID, set } from "./utils";
// import { onInitMecanico } from "./mecanico";

let submitTimer;

when.onInit = () => {
  // teclado
  data.LOGIN_KEYBOARD_TYPE = 'numeric';

  // restaurar bloqueo/desbloqueo
  // data.PIKIN_TARGET_REL1 = env.isLoggedIn ? false : true;

  // forzar modo dark
  data.SET_DARK_MODE = true;
  data.ACCELEROMETER_REQUESTED = false;
  data.GPS_REQUESTED = false;

  const appVer = Number(data.APP_BUILD_VERSION || '0');
  if (appVer < 119) {
    platform.log('omitiendo ejecutar script por tener versión de app incompatible. Versión actual: ', appVer);
    return
  }

  platform.log('setting current login');
  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol.watch(myID());
  frotaCol.set(myID(), 'currentLogin', currentLogin());
  frotaCol.set(myID(), 'loginDate', Date.now() / 1000);

  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  bleCol.watch(myID());

  // collisionInstaller();
  gpsInstaller();
  hourmeterInstaller();

  // custom
  platform.log('installing vamos script');
  vamosScriptInstaller();

  // platform.log('añadiendo watcher para tareas de mecánico')
  // const mecanicoDestroyer = onInitMecanico();

  platform.log('ended onInit()');
  return () => {
    platform.log('limpiando datos de mecanico (si existen)')
    // mecanicoDestroyer();

    if (submitTimer) {
      clearTimeout(submitTimer);
    }
  }
}

class SessionEvent extends BaseEvent {
  kind = 'session';
  type: 'start' | 'end';
  userId: string;

  constructor(type: 'start' | 'end', userId: string) {
    super();

    this.type = type;
    this.userId = userId;
  }

  getData() {
    return {
      deviceId: myID(),
      type: this.type,
      userId: this.userId,
    }
  }
}

const LAST_LOGIN_KEY = 'LAST_LOGIN';
const CHECKLIST_FORM_ID = '32f094b2-fe35-483f-a45a-c137afee5424';
when.onLogin = (l: string): any => {
  env.setData('LOGIN', l);
  env.project?.saveEvent(new SessionEvent('start', l));

  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol.set('myID()', 'currentLogin', l);

  const lastLogin = getString(LAST_LOGIN_KEY);
  platform.log('last login: ', lastLogin);
  if (lastLogin === l) {
    platform.log('omitiendo checklist por ser el mismo login');
    env.setData('PIKIN_TARGET_REL1', false);
    return
  }

  return CHECKLIST_FORM_ID;
}

when.onLogout = (l: string) => {
  env.setData('LOGIN', '');
  data.PIKIN_TARGET_REL1 = true;
  env.project?.saveEvent(new SessionEvent('end', l));

  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol.set(myID(), 'currentLogin', '');
  frotaCol.set(myID(), 'loginDate', Date.now() / 1000);
}

class FormSubmittedEvent extends BaseEvent {
  kind = 'form-submit';
  type: 'start' | 'end';
  formId?: string;
  taskId?: string;
  submitId?: string;

  constructor(type: 'start' | 'end', submitId?: string, formId?: string, taskId?: string) {
    super();

    this.type = type;
    this.formId = formId;
    this.taskId = taskId;
    this.submitId = submitId;
  }

  getData() {
    return {
      deviceId: myID(),
      userId: currentLogin(),
      submitId: this.submitId,
      taskId: this.taskId,
      formId: this.formId,
    }
  }
}

let formStartedAt: number | undefined;

when.onShowSubmit = (taskId, formId) => {
  formStartedAt = Date.now()
  env.project?.saveEvent(new FormSubmittedEvent('start', '', formId, taskId));
  if (formId === CHECKLIST_FORM_ID) {
    // desbloquear para que pueda completar checklist
    env.setData('PIKIN_TARGET_REL1', false);
    // si pasa este tiempo, bloquear la máquina
    // (esto es cancelado en onSubmit al completarse el submit)
    submitTimer = setTimeout(
      () => env.setData('PIKIN_TARGET_REL1', true),
      // 5 min
      1000 * 60 * 5,
    );
  }
}

when.onSubmit = (submit, taskId, formId) => {
  const formDuration = (Date.now() - formStartedAt) / 1000;
  formStartedAt = undefined;

  if (formId === CHECKLIST_FORM_ID) {
    // cancelar bloqueo de ignición
    if (submitTimer) {
      clearInterval(submitTimer);
    }
    // liberar máquina
    env.setData('PIKIN_TARGET_REL1', false);
    set(LAST_LOGIN_KEY, currentLogin());
  }

  submit._setRaw({
    metadata: {
      ...(submit.metadata || {}),
      deviceId: myID(),
      loginId: currentLogin(),
      duration: formDuration,
      isChecklist: formId === CHECKLIST_FORM_ID,
    }
  })
  env.project.submissionsManager.save(submit);

  // send event
  env.project?.saveEvent(new FormSubmittedEvent('end', submit.$modelId, formId, taskId));
  
  // update col
  const action = submit.data?.action;
  if (typeof action !== 'undefined') {
    const profileCol = env.project?.collectionsManager.ensureExists<Record<string, StoreBasicValueT>>("profile");

    switch (action) {
      case 'set-profile':
        Object.keys(submit.data as Record<string, StoreBasicValueT>).forEach((key) => {
          if (key === 'action' || key === 'submit') return;
          const val = (submit.data as Record<string, StoreBasicValueT>)[key];
          if (!val) return;
          platform.log('set-profile: ', `${myID()}.${key}`, `(${typeof val}) ${val}`);
          profileCol.set(myID(), 'key', val);

          if (key === 'hourmeter') {
            const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');
            col.set(myID(), 'in1', Number(val) * 3600);
          }
        });
        platform.log('set-profile: sent!');
        break;
      default: break;
    }
  }
}

// test
when.onPeriodic = () => {
  const frotaCol = env.project?.collectionsManager.ensureExists<FrotaCollection>("frota");
  const myDoc = frotaCol.get(myID());

  const currentStoredStatus = myDoc.data?.bleConnected || false;
  if (currentStoredStatus !== data.BLE_CONNECTED && typeof data.BLE_CONNECTED !== 'undefined') {
    frotaCol.set(myID(), 'bleConnected', Boolean(data.BLE_CONNECTED));
    platform.log('(en el background) conectado a BLE?', Boolean(data.BLE_CONNECTED));
  }

  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  const foundBle = bleCol.get(myID())?.data?.target || '';
  if (foundBle && foundBle != data.BLE_TARGET) {
    env.setData('BLE_TARGET', foundBle);
    platform.log('cambiado target de BLE a: ', foundBle);
  }
}