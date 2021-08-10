import _ from 'lodash';
import { BaseEvent, GenericEvent } from '@fermuch/telematree/src/events'

import collisionInstaller from './modules/collision/collision';
import gpsInstaller from './modules/gps/gps';

when.onInit = () => {  
  // bluetooth
  data.BLE_TARGET = '40:f5:20:b6:8b:22';

  // restaurar bloqueo/desbloqueo
  data.PIKIN_TARGET_REL1 = env.isLoggedIn ? false : true;
  // env.setData('PIKIN_TARGET_REL1', env.isLoggedIn ? false : true);

  // teclado
  data.LOGIN_KEYBOARD_TYPE = 'numeric';

  collisionInstaller();
  gpsInstaller();

  // const widgetsTimer = setInterval(updateWidgets, 300);
  // let i = 0;
  // const logTimer = setInterval(() => platform.log(++i), 5000);

  platform.log('ended init');
  return () => {
    // clearInterval(logTimer);
    // clearInterval(widgetsTimer);
  }
}

when.onLogin = (l: string) => {
  data.PIKIN_TARGET_REL1 = false;
}

when.onLogout = () => {
  data.PIKIN_TARGET_REL1 = true;
}

// function onSubmit(subm: string, task: string, form: string): void {}
// function onPageChange(newPage: string): void {}

when.onEvent = (evt: BaseEvent) => {
  if (evt.kind === 'generic' && (evt as GenericEvent<any>).type === 'pikin-event') {
    onPikinEvent(evt as GenericEvent<any>);
  } else {
    // platform.log('unknown event: ', evt.kind, evt.getData());
  }
}

// function updateWidgets() {
//   const widgetIds = {
//     gpsSpeed: 'OvsTaR5jiLafjR7OM7jh',
//     gpsLastUpdate: 'XVDcXkTbC3or9w6Q6wpb'
//   }

//   env.project?.widgetsManager.widgets.forEach((w) => {
//     if (w.$modelId === widgetIds.gpsSpeed) {
//       w._setRaw({
//         value: String(currentGPS.speed.toFixed(2)),
//         fill: (currentGPS.speed / 60)
//       })
//     }

//     if (w.$modelId === widgetIds.gpsLastUpdate) {
//       const now = Number(new Date());
//       const diff = Math.round((now - currentGPS.realTS) / 1000);
//       let fill = diff / 10;
//       // platform.log('diff: ', fill);

//       w._setRaw({
//         value: String(diff),
//         fill: fill,
//       });
//     }
//   });
// }

/**
 * Horimetros
 */
interface IOChange {
  method: "Event.IO.Change";
  params: {
    counter: number,
    durationMs: number,
    finalState: boolean,
    io: string
  }
}
interface IOActivity {
  io: string;
  state: boolean;
  since: number;
  totalSeconds?: number;
}

const IOActivityRegistry: {[io: string]: IOActivity} = {};
const HourmeterCol = 'jb7Ris9sN9PWkCLRDdZx';

function onPikinEvent(evt: GenericEvent<any>) {
  if (evt.payload?.method === 'Event.IO.Change') {
    const e = evt as GenericEvent<IOChange>;
    const io = e.payload.params.io;
    const state = e.payload.params.finalState;
    const now = Number(new Date());
    if (typeof IOActivityRegistry[io] === 'undefined') {
      IOActivityRegistry[io] = {
        io: io,
        state: state,
        since: now,
      }
    }

    if (state !== IOActivityRegistry[io].state) {
      IOActivityRegistry[io].totalSeconds = (now - IOActivityRegistry[io].since) / 1000;
      // state change! send to server
      const newEvent = new GenericEvent<IOActivity>("io-activity", IOActivityRegistry[io], {
        deviceId: data.DEVICE_ID,
        login: env.currentLogin?.key || false,
      });

      env.project?.saveEvent(newEvent);
      
      const col = env.project?.collectionsManager.collections.find((c) => c.$modelId === HourmeterCol);
      if (col) {
        const key = data.DEVICE_ID + '_' + io;
        const oldValue = Number(col.store[key] || 0);
        col.set(key, oldValue + IOActivityRegistry[io].totalSeconds);
      }

      platform.log("stored IO event");
      delete IOActivityRegistry[io];
    }
  }
}