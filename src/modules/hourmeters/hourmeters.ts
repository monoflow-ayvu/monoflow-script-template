import { BaseEvent, GenericEvent } from '@fermuch/telematree/src/events'
import { del, getNumber, getString, myID, set } from '../../utils';

interface IOChange {
  method: "Event.IO.Change";
  params: {
    counter: number,
    durationMs: number,
    finalState: boolean,
    io: string
  }
}

export interface HourmetersCollection {
  [deviceOrSessionId: string]: {
    [session: string]: number;
  }
}

interface IOActivity {
  io: string;
  state: boolean;
  since: number;
  totalSeconds?: number;
}

function activityId(io: string) {
  return `__hourmeter.${myID()}.${io}`;
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
    const durMs = e.payload.params.durationMs || 0;
    const durSecs = durMs / 1000;

    if (io === 'in1' && !state) {
      platform.log('in1 off, logging out');
      env.project?.logout();
      del(SESSION_KEY);
      platform.log('logged out!');
    }

    platform.log(`${io}: ${state} (dur: ${durSecs})`)

    if (state) {
      if (!getNumber(activityId(io))) {
        set(activityId(io), Date.now());
      }
    } else {
      const startedAtMs = getNumber(activityId(io));
      if (!startedAtMs) return;

      // store the activity on the db and reset it
      const totalTimeSeconds = (Date.now() - startedAtMs) / 1000;
      platform.log('totalTimeSeconds', totalTimeSeconds);

      platform.log('storing hourmeter');
      const col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');
      col.bump(`${myID()}.${io}`, totalTimeSeconds);
      if (env.currentLogin?.key) {
        col.bump(`login_${env.currentLogin?.key}.${io}`, totalTimeSeconds);
      }
      platform.log('deleting old counter');
      del(activityId(io));

      // const newEvent = new GenericEvent<IOActivity>("io-activity", lastActivity, {
      //   deviceId: myID(),
      //   login: env.currentLogin?.key || false,
      // });
      // env.project?.saveEvent(newEvent);
    }
  }
}