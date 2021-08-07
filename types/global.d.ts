import { KnowPlatformTools, DataProperty, DynamicData, FN_PROPS, FNArgs } from '@fermuch/telematree/src/tree/dynamic_data';
import * as events from '@fermuch/telematree/src/events';
import telematree from '@fermuch/telematree/src/library';


// ** UUID **
type V4Options = RandomOptions | RngOptions;
type v4String = (options?: V4Options) => string;
type v4Buffer = <T extends OutputBuffer>(options: V4Options | null | undefined, buffer: T, offset?: number) => T;
type v4 = v4Buffer & v4String;

// ** Globals **
declare global { 
  const platform: KnowPlatformTools;
  const events: events;
  const telematree: telematree;
  const data: DataProperty;
  const globals: DynamicData['globals'];
  const uuid: v4;

  let when: FNArgs;
}