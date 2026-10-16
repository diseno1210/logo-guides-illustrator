'use strict';

const KAPPA = 0.5522847498;

/** Geometry JSON v1: a circle, center (0,0), radius 100, four cubic segments. */
function F1() {
  const radius = 100;
  const handle = radius * KAPPA;
  return {
    version: 1, units: 'pt', colorSpace: 'RGB', artboard: [-140, 140, 140, -140],
    parts: [{
      id: 'p0', sourceIndex: 0, kind: 'path', filled: true, stroked: false, strokeWidth: 0,
      contours: [{ id: 'p0c0', closed: true, points: [
        { a: [radius, 0], l: [radius, -handle], r: [radius, handle] },
        { a: [0, radius], l: [handle, radius], r: [-handle, radius] },
        { a: [-radius, 0], l: [-radius, handle], r: [-radius, -handle] },
        { a: [0, -radius], l: [-handle, -radius], r: [handle, -radius] }
      ] }]
    }], warnings: []
  };
}
function getFixture(name) {
  if (name !== 'F1') throw new Error('M0 only implements fixture F1; requested ' + name);
  return F1();
}
module.exports = { F1, getFixture, KAPPA };
