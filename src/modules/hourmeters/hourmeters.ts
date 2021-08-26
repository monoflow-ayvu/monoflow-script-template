import { BaseEvent, GenericEvent } from '@fermuch/telematree/src/events'
import { del, getString, myID, set } from '../../utils';

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

export interface HourmetersCollection {
  [deviceOrSessionId: string]: {
    [session: string]: number;
  }
}

function activityId(io: string) {
  return `__hourmeter.${myID()}.${io}`;
}

function getOrSetActivity(io: string, state: boolean, since: number): IOActivity {
  const key = activityId(io);
  const storedAct = getString(key) || '';
  if (storedAct) {
    try {
      if (!storedAct) {
        throw new Error('no data stored');
      }
      const storedActJs = JSON.parse(storedAct);

      if (
        !storedActJs
        || typeof storedActJs !== 'object'
        || !storedActJs.io
        || !storedActJs.since
      ) {
        throw new Error('Invalid stored activity');
      }

      return storedActJs as IOActivity;
    } catch (e) {
      // ignore
    }
  }

  const newAct: IOActivity = {
    io: io,
    state: state,
    since: since,
  };

  set(key, JSON.stringify(newAct));
  return newAct;
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

function onPikinEvent(evt: GenericEvent<any>) {
  if (evt.payload?.method === 'Event.IO.Change') {
    const e = evt as GenericEvent<IOChange>;
    const io = e.payload.params.io;
    const state = e.payload.params.finalState;
    const now = Number(new Date());

    if (io === 'in1' && !state) {
      platform.log('in1 off, logging out');
      del(SESSION_KEY);
      env.project?.logout();
      platform.log('logged out!');
    }

    const lastActivity = getOrSetActivity(io, state, now);
    if (state !== lastActivity.state) {
      lastActivity.totalSeconds = (now - lastActivity.since) / 1000;
      // state change! send to server
      const newEvent = new GenericEvent<IOActivity>("io-activity", lastActivity, {
        deviceId: myID(),
        login: env.currentLogin?.key || false,
      });
      env.project?.saveEvent(newEvent);

      const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');
      col.bump(`${myID()}.${io}`, lastActivity.totalSeconds);
      if (env.currentLogin?.key) {
        col.bump(`login_${env.currentLogin?.key}.${io}`, lastActivity.totalSeconds || 0);
      }

      del(activityId(io));
      platform.log(`done updating IO "${io}" added: ${lastActivity.totalSeconds} seconds!`);
    }
  }
}