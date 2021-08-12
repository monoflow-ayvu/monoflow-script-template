import { AccelerometerSensorEvent, BaseEvent } from '@fermuch/telematree/src/events'

interface CollisionItem {
  magnitude: number;
  timestamp: number;
}

class CollisionEvent extends BaseEvent {
  kind: 'collision';
  userId: string;
  collisionLog: CollisionItem[] = [];

  constructor(collisionLog: CollisionItem[]) {
    super();

    this.collisionLog = collisionLog;
  }

  getData() {
    return {
      deviceId: data.DEVICE_ID || '',
    }
  }
}

function log(...args: unknown[]) {
  platform.log('[COLLISION]', ...args);
}

export default function install() {
  log('initializing');
  data.accelerometer_requested = true;
  data.accelerometer_frequency = 20;

  messages.on('onEvent', (evt) => {
    if (evt.kind === 'sensor-accelerometer') {
      detectCollision(evt as AccelerometerSensorEvent);
    }
  });
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
    log('shake!', collisionBuffer[collisionCurrentIndex].magnitude);
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
    const evt = new CollisionEvent(collisionBuffer);
    env.project?.saveEvent(evt);
    env.project?.logout();
  }

  // next read needs to use next position
  collisionCurrentIndex = (collisionCurrentIndex + 1) % MAX_COLLISION_SAMPLES;
}