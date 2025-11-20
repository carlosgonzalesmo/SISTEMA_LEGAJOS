export function debug(...args: any[]) {
  if (process.env.DEBUG && /socket/i.test(process.env.DEBUG)) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}
export function warn(...args: any[]) {
  // Keep warnings unless DEBUG explicitly set to 'none'
  if (process.env.DEBUG !== 'none') {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}
export function error(...args: any[]) {
  // Always log errors
  // eslint-disable-next-line no-console
  console.error(...args);
}
