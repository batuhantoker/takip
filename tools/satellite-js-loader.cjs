// satellite.js 7 re-exports its WASM bulk propagator from the root, and Turbopack's production compile hangs on it; TAKIP never uses it.
module.exports = function satelliteJsLoader(source) {
  return source.replace("export * from './wasm/index.js';", '');
};
