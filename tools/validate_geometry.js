'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadGeometry } = require('./svg_import');
const { loadCore } = require('./test/load_core');

/** Validate a real Illustrator dump in the ES3 vm, then exercise all M1 stages. */
function validateFile(filename) {
  const { LG, plain } = loadCore();
  const geometry = loadGeometry(filename);
  const model = LG.sample.run(LG.geometry.normalize(geometry));
  const inkAt = LG.ink.create(model);
  let contours = 0;
  for (const part of model.parts) contours += part.contours.length;
  const center = [(model.bbox[0] + model.bbox[2])/2, (model.bbox[1] + model.bbox[3])/2];
  return {
    file: path.resolve(filename), milestone:'M1', parts:model.parts.length,
    anchors:model.anchorCount, contours,
    rows:plain(model.rows), bbox:plain(model.bbox), S:model.S, D:model.D,
    sampleCount:model.samples.length, sampleSpacing:model.sampleSpacing,
    centerIsInk:inkAt(center[0],center[1]), warnings:plain(model.warnings)
  };
}
if(require.main===module){
  try {
    const filename=process.argv[2];
    if(!filename)throw new Error('Usage: npm run validate:geometry -- geometry_dump.json [report.json]');
    const report=JSON.stringify(validateFile(filename),null,2)+'\n';
    if(process.argv[3]){fs.mkdirSync(path.dirname(process.argv[3]),{recursive:true});fs.writeFileSync(process.argv[3],report,'utf8');}
    process.stdout.write(report);
  }catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
module.exports={validateFile};
