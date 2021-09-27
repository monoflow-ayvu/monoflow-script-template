import {activityId, HourmetersCollection} from './hourmeters'
import { Collection, Submission } from '@fermuch/telematree';
import { CHECKLIST_FORM_ID } from '..';
import { myID } from '../utils';

function log(...args: unknown[]) {
  platform.log('[CHECKLIST_WATCHER]', ...args);
}

let col: Collection<HourmetersCollection> | undefined = undefined;

export default function install() {
  log('installing...');
  col = env.project?.collectionsManager.ensureExists<HourmetersCollection>('hourmeters', 'Horímetros');
  messages.on('onSubmit', onSubmit);
}

function onSubmit(submit: Submission, taskId?: string, formId?: string) {
  if (formId !== CHECKLIST_FORM_ID) {
    return;
  }
  const date = new Date().toJSON().split('T')[0];

  const hourmeterString = submit.data?.hourmeter || submit.data?.horimetro;
  if (!hourmeterString) {
    log('no hourmeter in submission');
    return;
  }

  // convert from hour to seconds
  const hourmeter = Number(hourmeterString) * 3600;
  if (hourmeter <= 0) {
    log('invalid hourmeter:', hourmeter);
    return;
  }
  col?.bump(myID(), 'checklist', hourmeter);
  col?.bump(myID(), `${date}_checklist`, hourmeter);
}