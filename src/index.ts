import * as MonoUtils from "@fermuch/monoutils";

// based on settingsSchema @ package.json
type Config = Record<string, unknown> & {
  nome: string;
}

const conf = new MonoUtils.config.Config<Config>();

messages.on('onInit', function() {
  const name = conf.get('name', 'default name');
  platform.log(`Hello, ${name}!`);
});