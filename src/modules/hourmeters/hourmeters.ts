import { BaseEvent, GenericEvent } from '@fermuch/telematree'

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

function log(...args: unknown[]) {
  log('[HOURMETER]', ...args);
}

export default function install() {
  messages.on('onLogin', onSessionStart);
  messages.on('onLogout', onSessionEnd);
  messages.on('onEvent', onEvent);
}

let sessionStarted = 0;
function onSessionStart() {
  sessionStarted = Date.now();
}
function onSessionEnd(sessionKey: string) {
  const totalSeconds = (Date.now() - sessionStarted) / 1000;
  const key = sessionKey + '_session';
  const col = env.project?.collectionsManager.collections.find((c) => c.$modelId === HourmeterCol);
  const oldValue = Number(col.store[key] || 0);
  col.set(key, oldValue + totalSeconds);
  platform.log('stored session for ', sessionKey, ' total seconds: ', totalSeconds);
  sessionStarted = 0;
}

function onEvent(evt: BaseEvent) {
  if (evt.kind === 'generic' && (evt as GenericEvent<any>).type === 'pikin-event') {
    onPikinEvent(evt as GenericEvent<any>);
  }
}

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
      log("stored IO event");
      
      const col = env.project?.collectionsManager.collections.find((c) => c.$modelId === HourmeterCol);
      if (col) {
        const key = data.DEVICE_ID + '_' + io;
        const oldValue = Number(col.store[key] || 0);
        col.set(key, oldValue + IOActivityRegistry[io].totalSeconds);
      }

      log("updated IO collection");
      delete IOActivityRegistry[io];
    }
  }
}