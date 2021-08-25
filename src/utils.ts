export function myID(): string {
  return 'id' in platform ?
      String(platform.id)
    : String(data.DEVICE_ID) || '';
}