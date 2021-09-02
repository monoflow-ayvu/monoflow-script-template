const CONSERTO_PAGE_ID = '8363cd14-b6be-427d-bb67-547ee6b4b17d';

const MECHANIC_LOGINS = [
  '5353456',
];

function isMechanic(): boolean {
  return data.IS_MECHANIC === true;
}

export function onInitMecanico(): () => void {
  messages.on('onLogin', checkMecanicoLogin);
  messages.on('onLogout', clearMecanicoData);

  const int = setInterval(onPeriodicCheck, 1000);
  return () => clearInterval(int);
}

function clearMecanicoData() {
  // mark all tasks for mechanics as invisible
  env.project?.tasksManager.tasks.forEach((t) => {
    if (t.show && t.tags.includes('mecanico')) {
      t._setRaw({show: false});
    }
  })
}

function checkMecanicoLogin(l: string) {
  if (MECHANIC_LOGINS.includes(l)) {
    env.setData('IS_MECHANIC', true);
    platform.log('usuario es mecánico')
    env.project?.pagesManager.pages.find((p) => p.$modelId === CONSERTO_PAGE_ID)?._setRaw({show: true});
  } else {
    env.setData('IS_MECHANIC', false);
    env.project?.pagesManager.pages.find((p) => p.$modelId === CONSERTO_PAGE_ID)?._setRaw({show: false});
  }
}

function onPeriodicCheck() {
  if (!isMechanic()) {
    return;
  }

  // mark all tasks for mechanics as visible
  platform.log('analizando tareas')
  env.project?.tasksManager.tasks.forEach((t) => {
    platform.log(`analizando tarea "${t.$modelId}": show? ${t.show} tags: ${JSON.stringify(t.tags)}`)
    if (!t.show && t.tags.includes('mecanico')) {
      platform.log(`marcando tarea "${t.$modelId}" como visible para mecanico`)
      t._setRaw({show: true});
    }
  })
}