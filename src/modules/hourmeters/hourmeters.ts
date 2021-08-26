import { BaseEvent, GenericEvent } from '@fermuch/telematree/src/events'
import { myID } from '../../utils';

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

interface HourmetersCollection {
  [deviceOrSessionId: string]: {
    session: number;
  }
}


const IOActivityRegistry: {[io: string]: IOActivity} = {};

export default function install() {
  messages.on('onLogin', onSessionStart);
  messages.on('onLogout', onSessionEnd);
  messages.on('onEvent', onEvent);
}

let sessionStarted = 0;
function onSessionStart() {
  sessionStarted = Date.now();
}
function onSessionEnd(sessionKeyRaw: string) {
  // NOTE: we modify sessionKey because it might be a numeric string, and
  // firebase interprets that as an array key.
  const sessionKey = `_${sessionKeyRaw}`
  const totalSeconds = (Date.now() - sessionStarted) / 1000;
  const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');
  col.bump(`${sessionKey}.session`, totalSeconds);
  platform.log('stored session for ', sessionKey, ' total seconds: ', totalSeconds);
  sessionStarted = 0;
}

function onEvent(evt: BaseEvent) {
  if (evt.kind === 'generic' && (evt as GenericEvent<any>).type === 'pikin-event') {
    onPikinEvent(evt as GenericEvent<any>);
  }
}

const SESSION_KEY = '__LAST_SESSION_ID';
type DeleteFN = (key: string) => void;

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

    if (io === 'in1' && !state) {
      platform.log('in1 off, logging out');
      if ('delete' in platform) {
        const del = platform.delete as DeleteFN;
        del(SESSION_KEY);
      }
      env.project?.logout();
    }

    if (state !== IOActivityRegistry[io].state) {
      IOActivityRegistry[io].totalSeconds = (now - IOActivityRegistry[io].since) / 1000;
      // state change! send to server
      const newEvent = new GenericEvent<IOActivity>("io-activity", IOActivityRegistry[io], {
        deviceId: myID(),
        login: env.currentLogin?.key || false,
      });
      env.project?.saveEvent(newEvent);

      const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');
      col.bump(`${myID()}.${io}`, IOActivityRegistry[io].totalSeconds);
      if (env.currentLogin?.key) {
        col.bump(`login_${env.currentLogin?.key}.${io}`, IOActivityRegistry[io].totalSeconds);
      }

      delete IOActivityRegistry[io];
      platform.log('done updating IO!');
    }
  }
}