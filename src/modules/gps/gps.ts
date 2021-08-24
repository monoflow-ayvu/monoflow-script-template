import { GPSSensorEvent, GenericEvent } from '@fermuch/telematree/src/events'
import { myID } from '../../utils';

function log(...args: unknown[]) {
  platform.log('[GPS]', ...args);
}

export default function install() {
  log('initializing');

  data.GPS_REQUESTED = true;
  data.GPS_TIMEOUT = 1000 * 120;
  data.GPS_MAXIMUM_AGE = 1000 * 120;
  data.GPS_HIGH_ACCURACY = true;
  data.GPS_DISTANCE_FILTER = 0;
  data.GPS_USE_SIGNIFICANT_CHANGES = false;

  messages.on('onEvent', (evt) => {
    if (evt.kind === 'sensor-gps') {
      onGPS(evt as GPSSensorEvent);
    }
  })
}

const currentGPS = {
  ts: 0,
  realTS: 0,
  lat: 0,
  lng: 0,
  speed: 0,
  speeds: [] as number[],
}

const onGPS = (evt: GPSSensorEvent) => {
  const event = new GenericEvent('custom-gps', {
    ...evt.getData(),
    speeds: currentGPS.speeds || [],
  }, {
      deviceId: myID(),
      login: env.currentLogin?.key || false,
  });

  const lastGps = currentGPS;
  const now = Number(new Date());

  currentGPS.realTS = now;
  currentGPS.lat = evt.latitude;
  currentGPS.lng = evt.longitude;
  currentGPS.speed = evt.speed !== -1 ? (evt.speed * 3.6) : lastGps.speed;
  currentGPS.speeds.push(currentGPS.speed)

  if ((now - lastGps.ts) > (1000 * 60)) {
    env.project?.saveEvent(event);
    currentGPS.ts = now;
    currentGPS.speeds = [];
    log('guardado evento de gps');
  } else {
    const diff = (now - lastGps.ts) / 1000;
    // log(`omitido por diferencia de tiempo: ${diff}`);
  }

  updateWidgets()
}

function updateWidgets() {
  const widgetIds = {
    gpsSpeed: 'OvsTaR5jiLafjR7OM7jh',
    gpsLastUpdate: 'XVDcXkTbC3or9w6Q6wpb'
  }

  env.project?.widgetsManager.widgets.forEach((w) => {
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
      w._setRaw({
        value: String(diff),
        fill: fill,
      });
    }
  });
}