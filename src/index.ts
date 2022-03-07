messages.on('onInit', function() {
  platform.log('script started! (I am the script)');
  platform.log('settings:');
  platform.log(typeof settings?.());
  platform.log(settings?.());

  const {name} = getSettings?.() as {name?: string} || {name: ''};
  platform.log(`Hello, ${name}!`);
});