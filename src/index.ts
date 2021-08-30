import { BaseEvent } from "@fermuch/telematree/src/events";

// import collisionInstaller from './modules/collision/collision';
import gpsInstaller from './modules/gps/gps';
import hourmeterInstaller, { HourmetersCollection } from './modules/hourmeters/hourmeters';

import vamosScriptInstaller, { BleCollection, FrotaCollection, setIfNotEqual } from './vamos_logic';
import { StoreBasicValueT } from '@fermuch/telematree';
import { currentLogin, getString, myID, set } from "./utils";

when.onInit = () => {  
  // teclado
  data.LOGIN_KEYBOARD_TYPE = 'numeric';

  // restaurar bloqueo/desbloqueo
  // data.PIKIN_TARGET_REL1 = env.isLoggedIn ? false : true;

  // forzar modo dark
  data.SET_DARK_MODE = true;
  data.ACCELEROMETER_REQUESTED = false;
  data.GPS_REQUESTED = false;

  // collisionInstaller();
  gpsInstaller();
  hourmeterInstaller();

  // custom
  platform.log('installing vamos script');
  vamosScriptInstaller();

  platform.log('setting current login');
  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol.set(`${myID()}.currentLogin`, currentLogin());

  platform.log('ended onInit()');
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
  data.PIKIN_TARGET_REL1 = false;
  env.project?.saveEvent(new SessionEvent('start', l));

  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol.set(`${myID()}.currentLogin`, l);

  const lastLogin = getString(LAST_LOGIN_KEY);
  platform.log('last login: ', lastLogin);
  if (lastLogin === l) {
    platform.log('omitiendo checklist por ser el mismo login');
    return
  }

  return CHECKLIST_FORM_ID;
}

when.onLogout = (l: string) => {
  data.PIKIN_TARGET_REL1 = true;
  env.project?.saveEvent(new SessionEvent('end', l));

  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol.set(`${myID()}.currentLogin`, '');
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

when.onShowSubmit = (taskId, formId) => {
  env.project?.saveEvent(new FormSubmittedEvent('start', '', formId, taskId));
}

when.onSubmit = (submit, taskId, formId) => {
  env.project?.saveEvent(new FormSubmittedEvent('end', submit.$modelId, formId, taskId));

  if (formId === CHECKLIST_FORM_ID) {
    set(LAST_LOGIN_KEY, currentLogin());
  }
  
  const action = submit.data?.action;
  if (typeof action !== 'undefined') {
    const profileCol = env.project?.collectionsManager.ensureExists<{[deviceId: string]: Record<string, StoreBasicValueT>}>("profile");

    switch (action) {
      case 'set-profile':
        Object.keys(submit.data as Record<string, StoreBasicValueT>).forEach((key) => {
          if (key === 'action' || key === 'submit') return;
          const val = (submit.data as Record<string, StoreBasicValueT>)[key];
          if (!val) return;
          platform.log('set-profile: ', `${myID()}.${key}`, `(${typeof val}) ${val}`);
          profileCol.set(`${myID()}.${key}`, val);

          if (key === 'hourmeter') {
            const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');
            col.set(`${myID()}.in1`, Number(val) * 3600);
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
  const currentStoredStatus = frotaCol.typedStore[myID()]?.bleConnected;
  if (currentStoredStatus !== data.BLE_CONNECTED && typeof data.BLE_CONNECTED !== 'undefined') {
    frotaCol.set(`${myID()}.bleConnected`, Boolean(data.BLE_CONNECTED));
    platform.log('(en el background) conectado a BLE?', Boolean(data.BLE_CONNECTED));
  }

  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  const foundBle = bleCol.typedStore[myID()]?.target || '';
  if (foundBle && foundBle != data.BLE_TARGET) {
    env.setData('BLE_TARGET', foundBle);
    platform.log('cambiado target de BLE a: ', foundBle);
  }
}