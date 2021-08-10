import TypedEmitter from "typed-emitter"
import { KnowPlatformTools, DataProperty, DynamicData, FN_PROPS, FNArgs, EventArgs } from '@fermuch/telematree/src/tree/dynamic_data';
import events from '@fermuch/telematree/src/events';
import telematree from '@fermuch/telematree/src/library';


// ** UUID **
type V4Options = RandomOptions | RngOptions;
type v4String = (options?: V4Options) => string;
type v4Buffer = <T extends OutputBuffer>(options: V4Options | null | undefined, buffer: T, offset?: number) => T;
type v4 = v4Buffer & v4String;

interface ScriptGlobal {
  platform: KnowPlatformTools;
  telematree: telematree;
  data: DataProperty;
  env: DynamicData['env'];
  messages: TypedEmitter<EventArgs>;
  uuid: v4;
  when: FNArgs;
}

// ** Globals **
declare global {
  const global: ScriptGlobal;

  const platform: KnowPlatformTools;
  const telematree: telematree;
  const data: DataProperty;
  const env: DynamicData['env'];
  const messages: TypedEmitter<EventArgs>;
  const uuid: v4;
  const when: FNArgs;
}

interface globalThis extends ScriptGlobal { }