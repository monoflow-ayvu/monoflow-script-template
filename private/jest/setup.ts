import { EventArgs } from "@fermuch/telematree";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter";

// setup global environment
beforeAll(() => {
  jest.useFakeTimers();

  const _mockStorage = new Map<string, string | number | boolean>();

  // const global: ScriptGlobal;

  (global as any).platform = {
    log(...args: any[]) {
      console.log(...args);
    },
    // phone-only
    set(key: string, val: string | number | boolean) {
      _mockStorage.set(key, val);
    },
    delete(key: string) {
      _mockStorage.delete(key);
    },
    getString(key: string) {
      return _mockStorage.get(key) as string;
    },
    getBoolean(key: string) {
      return _mockStorage.get(key) as boolean;
    },
    getNumber(key: string) {
      return _mockStorage.get(key) as number;
    }
  };

  // const telematree: telematree;

  (global as any).data = {
    DEVICE_ID: 'TEST',
  };

  // const env: DynamicData['env'];
  (global as any).env = {
    setData(key: string, val: string | number | boolean) {
      (global as any).data[key] = val;
    },
    data: (global as any).data,

    // TODO: add the other functions
  };

  // messages mock
  const eventEmitter = new EventEmitter() as TypedEmitter<EventArgs>
  (eventEmitter as any).on = eventEmitter.on;
  (global as any).emitEventGlobally = (event: any) => {
    eventEmitter.emit('onEvent', event);
  }
  (global as any).messages = eventEmitter;

  // const uuid: v4;
  // const when: FNArgs;

  (global as any).script = undefined;

  const testSettings = {
    isTest: true,
    isDebug: true,
    foo: {
      bar: {
        zaz: 'zaz'
      }
    }
  };
  (global as any).settings = () => testSettings;
  (global as any).getSettings = () => testSettings;
})