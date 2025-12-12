"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = debug;
exports.warn = warn;
exports.error = error;
function debug(...args) {
    if (process.env.DEBUG && /socket/i.test(process.env.DEBUG)) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}
function warn(...args) {
    // Keep warnings unless DEBUG explicitly set to 'none'
    if (process.env.DEBUG !== 'none') {
        // eslint-disable-next-line no-console
        console.warn(...args);
    }
}
function error(...args) {
    // Always log errors
    // eslint-disable-next-line no-console
    console.error(...args);
}
