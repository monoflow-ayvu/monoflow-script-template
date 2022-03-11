import * as MonoUtils from "@fermuch/monoutils";

// based on settingsSchema @ package.json
type Config = Record<string, unknown> & {
  nome: string;
}

const conf = new MonoUtils.config.Config<Config>();

messages.on('onInit', function() {
  platform.log('script started! (I am the script)');
  platform.log('settings:');
  platform.log(conf.store);

  const name = conf.get('nome', 'default name');
  platform.log(`Hello, ${name}!`);
});