messages.on('onInit', function() {
  platform.log('script started! (I am the script)');
  platform.log('settings:');
  platform.log(typeof settings?.());
  platform.log(settings?.());

  const {nome} = getSettings?.() as {nome?: string} || {nome: ''};
  platform.log(`Hello, ${nome}!`);
});