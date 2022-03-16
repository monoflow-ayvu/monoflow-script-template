const read = require('fs').readFileSync;
const join = require('path').join;

function loadScript() {
  // import global script
  const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
  eval(script);
}

describe("onInit", () => {
  // clean listeners
  afterEach(() => {
    messages.removeAllListeners();
  });

  it('runs without errors', () => {
    loadScript();
    messages.emit('onInit');
  });

  it('prints "Hello, default name!"', () => {
    const log = jest.fn();
    platform.log = log;

    loadScript();

    messages.emit('onInit');
    expect(log).toHaveBeenCalledWith('Hello, default name!');
  });

  it('prints "Hello, custom name!" if given config', () => {
    const log = jest.fn();
    platform.log = log;
    getSettings = () => ({ name: 'custom name' });

    loadScript();

    messages.emit('onInit');
    expect(log).toHaveBeenCalledWith('Hello, custom name!');
  });
});