import { BaseEvent } from "@fermuch/telematree/src/events";

import collisionInstaller from './modules/collision/collision';
import gpsInstaller from './modules/gps/gps';
import hourmeterInstaller, { HourmetersCollection } from './modules/hourmeters/hourmeters';
import checklistWatcherInstall from './modules/checklist_watcher';

import vamosScriptInstaller, { BleCollection, FrotaCollection } from './vamos_logic';
import { StoreBasicValueT } from '@fermuch/telematree';
import { currentLogin, getString, myID, set } from "./utils";

interface IOConfig {
  enable: boolean;
  low: number;
  high: number;
  target: string;
  save: boolean;
  trigger: boolean;
  reverse: boolean;
  action: number;
}

let submitTimer;
const ioConfigs: {
  [n: number]: IOConfig;
} = {
  // needs to be index 1 instead of 0 for a bug where the rule number is added
  // to the counter instead of a second.
  1 : {
    enable: true,
    low: 0,
    high: 40,
    target: 'in1',
    save: true,
    trigger: false,
    reverse: false,
    action: 0,
  }
};

when.onInit = () => {  
  // teclado
  data.LOGIN_KEYBOARD_TYPE = 'numeric';

  // restaurar bloqueo/desbloqueo
  data.PIKIN_TARGET_REL1 = !!currentLogin() ? false : true;
  data.MONOFLOW_RELAY_1 = !!currentLogin() ? false : true;

  // outputs no usados, resetearlos
  env.setData('MONOFLOW_RELAY_2', false);
  env.setData('MONOFLOW_BUZ_1', false);

  // forzar modo dark
  data.SET_DARK_MODE = true;
  data.ACCELEROMETER_REQUESTED = false;
  data.accelerometer_requested = false;
  // data.GPS_REQUESTED = true;

  // EPD10676 uses in3 instead of in1
  if (myID() === 'b49477e769a2d89e') {
    ioConfigs[1].target = 'in3';
  }
  // if (myID() === '59c22492535219ba') {
  //   ioConfigs[2] = {
  //     enable: true,
  //     low: 0,
  //     high: 40,
  //     target: 'in1',
  //     save: false,
  //     trigger: true,
  //     reverse: false,
  //     action: 2,
  //   };
  // }
  data.MONOFLOW_RULES = ioConfigs;

  const appVer = Number(data.APP_BUILD_VERSION || '0');
  if (appVer < 119) {
    platform.log('omitiendo ejecutar script por tener versión de app incompatible. Versión actual: ', appVer);
    return
  }

  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol?.watch(myID());
  const bleCol = env.project?.collectionsManager.get<BleCollection>('ble');
  bleCol?.watch(myID());

  if (appVer >= 126) {
    data.ACCELEROMETER_REQUESTED = true;
    data.accelerometer_requested = true;
    collisionInstaller();
  }

  // collisionInstaller();
  // gpsInstaller();
  hourmeterInstaller();
  checklistWatcherInstall();

  // custom
  platform.log('installing vamos script');
  vamosScriptInstaller();

  platform.log('setting current login');
  frotaCol?.set(myID(), 'currentLogin', currentLogin());
  // frotaCol.set(myID(), 'loginDate', Date.now() / 1000);

  platform.log('añadiendo watcher para tareas de mecánico')

  // let testInt;
  // if (myID() === '59c22492535219ba') {
  //   let state = false;
  //   testInt = setInterval(() => {
  //     state = !state;
  //     platform.log('PRUEBA DE RELAY, NUEVO ESTADO: ', state);
  //     env.setData('MONOFLOW_RELAY_1', state);
  //     env.setData('MONOFLOW_RELAY_2', state);
  //     env.setData('MONOFLOW_BUZ_1', state);
  //   }, 3000);
  // }

  platform.log('ended onInit()');
  return () => {
    platform.log('limpiando datos de mecanico (si existen)')

    if (submitTimer) {
      clearTimeout(submitTimer);
    }

    // if (testInt) {
    //   clearInterval(testInt);
    // }
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
export const CHECKLIST_FORM_ID = '32f094b2-fe35-483f-a45a-c137afee5424';
when.onLogin = (l: string): any => {
  env.setData('LOGIN', l);
  env.project?.saveEvent(new SessionEvent('start', l));

  const frotaCol = env.project?.collectionsManager.get<FrotaCollection>('frota');
  frotaCol.set(myID(), 'currentLogin', l);

  const lastLogin = getString(LAST_LOGIN_KEY);
  platform.log('last login: ', lastLogin);
  if (lastLogin === l) {
    platform.log('omitiendo checklist por ser el mismo login');
    env.setData('PIKIN_TARGET_REL1', false);
    env.setData('MONOFLOW_RELAY_1', false);
    return
  }

  const login = env.project?.logins.find((ll) => ll.key === l);
  if (login && (login.tags || []).includes('mecanico')) {
    platform.log('omitiendo checklist por mecánico');
    env.setData('PIKIN_TARGET_REL1', false);
    env.setData('MONOFLOW_RELAY_1', false);
    return
  }

  return CHECKLIST_FORM_ID;
}

when.onLogout = (l: string) => {
  env.setData('LOGIN', '');
  data.PIKIN_TARGET_REL1 = true;
  data.MONOFLOW_RELAY_1 = true;
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
  platform.log('onShowSubmit', formId, taskId);

  if (formId === CHECKLIST_FORM_ID) {
    // desbloquear para que pueda completar checklist
    env.setData('PIKIN_TARGET_REL1', false);
    env.setData('MONOFLOW_RELAY_1', false);
    // si pasa este tiempo, bloquear la máquina
    // (esto es cancelado en onSubmit al completarse el submit)
    submitTimer = setTimeout(
      () => {
        env.setData('PIKIN_TARGET_REL1', true);
        env.setData('MONOFLOW_RELAY_1', true);
      },
      // 5 min
      1000 * 60 * 5,
    );
  }

  env.project?.saveEvent(new FormSubmittedEvent('start', '', formId, taskId));
}

when.onSubmit = (submit, taskId, formId) => {
  const formDuration = (Date.now() - formStartedAt) / 1000;
  formStartedAt = undefined;
  
  platform.log('onSubmit', formId, taskId);

  if (formId === CHECKLIST_FORM_ID) {
    // cancelar bloqueo de ignición
    if (submitTimer) {
      clearInterval(submitTimer);
    }
    // liberar máquina
    env.setData('PIKIN_TARGET_REL1', false);
    env.setData('MONOFLOW_RELAY_1', false);
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
          profileCol.set(myID(), key, val);

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
  const currentStoredStatus = frotaCol.get(myID()).data.bleConnected;
  if (currentStoredStatus !== data.BLE_CONNECTED && typeof data.BLE_CONNECTED !== 'undefined') {
    frotaCol.set(myID(), 'bleConnected', Boolean(data.BLE_CONNECTED));
    platform.log('(en el background) conectado a BLE?', Boolean(data.BLE_CONNECTED));
  }

  const bleCol = env.project?.collectionsManager.ensureExists<BleCollection>("ble");
  const foundBle = bleCol.get(myID()).data.target || '';
  if (foundBle && foundBle != data.BLE_TARGET) {
    env.setData('BLE_TARGET', foundBle);
    platform.log('cambiado target de BLE a: ', foundBle);
  }
}