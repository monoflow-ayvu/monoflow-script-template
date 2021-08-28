export function myID(): string {
  return 'id' in platform ?
      String(platform.id)
    : String(data.DEVICE_ID) || '';
}

export function currentLogin(): string {
  return env.project.currentLogin?.maybeCurrent?.key || '';
}

export function set(key: string, val: string | number | boolean): void {
  if ('set' in platform) {
    return (platform.set as (key: string, val: string | number | boolean) => void)(key, val);
  }
}

export function del(key: string): void {
  if ('delete' in platform) {
    return (platform.delete as (key: string) => void)(key);
  }
}

export function getString(key: string): string {
  if ('getString' in platform) {
    return String((platform.getString as (key: string) => string)(key));
  }
}

export function getBoolean(key: string): boolean {
  if ('getBoolean' in platform) {
    return Boolean((platform.getBoolean as (key: string) => boolean)(key));
  }
}

export function getNumber(key: string): number {
  if ('getNumber' in platform) {
    return Number((platform.getNumber as (key: string) => number)(key) || 0);
  }
}
