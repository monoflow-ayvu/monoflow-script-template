import _ from 'lodash';
import { BaseEvent } from '@fermuch/telematree/src/events'

import collisionInstaller from './modules/collision/collision';
import gpsInstaller from './modules/gps/gps';
import hourmeterInstaller from './modules/hourmeters/hourmeters';

when.onInit = () => {  
  // bluetooth
  data.BLE_TARGET = '40:f5:20:b6:8b:22';

  // teclado
  data.LOGIN_KEYBOARD_TYPE = 'numeric';

  // restaurar bloqueo/desbloqueo
  data.PIKIN_TARGET_REL1 = env.isLoggedIn ? false : true;

  collisionInstaller();
  gpsInstaller();
  hourmeterInstaller();

  platform.log('ended init');
}

class SessionEvent extends BaseEvent {
  kind: 'session';
  type: 'start' | 'end';
  userId: string;

  constructor(type: 'start' | 'end', userId: string) {
    super();

    this.type = type;
    this.userId = userId;
  }

  getData() {
    return {
      deviceId: data.DEVICE_ID || '',
      type: this.type,
      userId: this.userId,
    }
  }
}

when.onLogin = (l: string) => {
  data.PIKIN_TARGET_REL1 = false;
  env.project?.saveEvent(new SessionEvent('start', l));
}

when.onLogout = (l: string) => {
  data.PIKIN_TARGET_REL1 = true;
  env.project?.saveEvent(new SessionEvent('end', l));
}


class FormSubmittedEvent extends BaseEvent {
  kind: 'form-submit';
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
      deviceId: data.DEVICE_ID || '',
      userId: env.currentLogin?.key || '',
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
}