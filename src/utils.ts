export function myID(): string {
  return String(platform.id || '') || data.DEVICE_ID || '';
}