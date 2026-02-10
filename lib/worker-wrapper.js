/* global importScripts */

// Suppress known non-fatal traineddata compatibility warnings from Tesseract core.
const originalWarn = self.console && self.console.warn
  ? self.console.warn.bind(self.console)
  : null;

if (originalWarn) {
  self.console.warn = (...args) => {
    const message = args.map((v) => String(v)).join(' ');
    if (message.includes('Warning: Parameter not found:')) {
      return;
    }
    originalWarn(...args);
  };
}

importScripts('./worker.min.js');
