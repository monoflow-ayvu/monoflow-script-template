function onInit() {
  platform.log('onInit');

// acelerometro
  data.accelerometer_requested = true;
  data.accelerometer_frequency = 20;

// restaurar bloqueo/desbloqueo
  global.setData('PIKIN_TARGET_REL1', global.isLoggedIn ? false : true);
  
// bluetooth
  data.BLE_TARGET = '40:f5:20:b6:8b:22';

// teclado
  data.LOGIN_KEYBOARD_TYPE = 'numeric';

// GPS
  data.GPS_REQUESTED = true;
  data.GPS_TIMEOUT = 1000 * 120;
  data.GPS_MAXIMUM_AGE = 1000 * 120;
  data.GPS_HIGH_ACCURACY = true;
  data.GPS_DISTANCE_FILTER = 0;
  data.GPS_USE_SIGNIFICANT_CHANGES = false;

  const widgetsTimer = setInterval(updateWidgets, 300);
  // let i = 0;
  // const logTimer = setInterval(() => platform.log(++i), 5000);

  return () => {
    // clearInterval(logTimer);
    clearInterval(widgetsTimer);
  }
}

function onLogin(l: string) {
  data.PIKIN_TARGET_REL1 = false;
}

function onLogout() {
  data.PIKIN_TARGET_REL1 = true;
}

function onSubmit(subm: string, task: string, form: string): void {}
function onPageChange(newPage: string): void {}

function onEvent(evt: BaseEvent) {
  if (evt.kind === 'sensor-gps') {
    onGPS(evt as GPSSensorEvent);
  } else if (evt.kind === 'sensor-accelerometer') {
    detectCollision(evt as AccelerometerSensorEvent);
  } else if (evt.kind === 'generic' && (evt as GenericEvent<any>).type === 'pikin-event') {
    onPikinEvent(evt as GenericEvent<any>);
  } else {
    platform.log('unknown event: ', evt.kind, evt.getData());
  }
}

/**
 * COLISIONES
 */
interface CollisionItem {
  magnitude: number;
  timestamp: number;
}
const MAX_COLLISION_SAMPLES = 50;
const COLLISION_VISIBLE_TIME_RANGE_MS = 500; // ms
// const COLLISION_MAGNITUDE_THRESHOLD = 25;
const COLLISION_MAGNITUDE_THRESHOLD = 1.5;
const COLLISION_PERCENT_OVER_THRESHOLD_FOR_SHAKE = 66;
const collisionBuffer: CollisionItem[] = Array.from(Array(MAX_COLLISION_SAMPLES)).map(() => ({magnitude: 0, timestamp: 0}));
let collisionCurrentIndex = 0;

function detectCollision(evt: AccelerometerSensorEvent) {
  const {x, y, z} = evt.getData();
  const now = Number(new Date());
  collisionBuffer[collisionCurrentIndex].timestamp = now;
  collisionBuffer[collisionCurrentIndex].magnitude = Math.sqrt(Math.pow(x,2) + Math.pow(y,2) + Math.pow(z, 2));
  // platform.log({buf: collisionBuffer[collisionCurrentIndex], index: collisionCurrentIndex});

  // process all events
  let numOverThreshold = 0;
  let total = 0;
  for (let i = 0; i < MAX_COLLISION_SAMPLES; i++) {
    const index = (collisionCurrentIndex - i + MAX_COLLISION_SAMPLES) % MAX_COLLISION_SAMPLES;
    if (now - collisionBuffer[index].timestamp < COLLISION_VISIBLE_TIME_RANGE_MS) {
      total++;
      if (collisionBuffer[index].magnitude >= COLLISION_MAGNITUDE_THRESHOLD) {
        numOverThreshold++;
      }
    }
  }

  if ((numOverThreshold) / total > (COLLISION_PERCENT_OVER_THRESHOLD_FOR_SHAKE / 100.0)) {
    platform.log('shake!', collisionBuffer[collisionCurrentIndex].magnitude);
    if (platform.notify && typeof platform.notify === 'function') {
        platform.notify({
            animated: true,
            autoHide: false,
            hideOnPress: true,
            floating: true,
            hideStatusBar: false,
            message: 'Sesión Cerrada',
            description: 'La sesión se cerró por haberse ocasionado una colisión',
            type: 'none',
            position: 'top',
        });
    }
    globals.project?.logout();
  }

  // next read needs to use next position
  collisionCurrentIndex = (collisionCurrentIndex + 1) % MAX_COLLISION_SAMPLES;
}


const currentGPS = {
  ts: 0,
  realTS: 0,
  lat: 0,
  lng: 0,
  speed: 0,
  speeds: [] as number[],
}
function onGPS(evt: GPSSensorEvent) {
  const event: typeof events.GenericEvent = new events.GenericEvent('custom-gps', evt.getData(), {
      deviceId: data.DEVICE_ID,
      login: globals.currentLogin || false,
      speeds: currentGPS.speeds || [],
  });

  const lastGps = currentGPS;
  const now = Number(new Date());

  currentGPS.realTS = now;
  currentGPS.ts = now;
  currentGPS.lat = evt.latitude;
  currentGPS.lng = evt.longitude;
  currentGPS.speed = evt.speed !== -1 ? (evt.speed * 3.6) : lastGps.speed;
  currentGPS.speeds.push(currentGPS.speed)

  if ((now - lastGps.ts) > (1000 * 60)) {
    globals.project?.saveEvent(event);
    currentGPS.speeds = [];
    platform.log('guardado evento de gps');
  } else {
    platform.log('omitido evento de gps por ser muy cercano en tiempo al anterior');
  }
}

/**
 * GPS
 */
function updateWidgets() {
  const widgetIds = {
    gpsSpeed: 'OvsTaR5jiLafjR7OM7jh',
    gpsLastUpdate: 'XVDcXkTbC3or9w6Q6wpb'
  }

  globals.project?.widgetsManager.widgets.forEach((w) => {
    if (w.$modelId === widgetIds.gpsSpeed) {
      w._setRaw({
        value: String(currentGPS.speed.toFixed(2)),
        fill: (currentGPS.speed / 60)
      })
    }

    if (w.$modelId === widgetIds.gpsLastUpdate) {
      const now = Number(new Date());
      const diff = Math.round((now - currentGPS.realTS) / 1000);
      let fill = diff / 10;
      // platform.log('diff: ', fill);

      w._setRaw({
        value: String(diff),
        fill: fill,
      });
    }
  });
}

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
      const newEvent = new events.GenericEvent<IOActivity>("io-activity", IOActivityRegistry[io], {
        deviceId: data.DEVICE_ID,
        login: global.currentLogin || false,
      });

      globals.project?.saveEvent(newEvent);
      
      const col = globals.project?.collectionsManager.collections.find((c) => c.$modelId === HourmeterCol);
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