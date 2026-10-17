'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('src/panel/index.html');
function element(id){const match=html.match(new RegExp('<([a-z]+)\\b([^>]*\\bid="'+id+'"[^>]*)>','i'));assert.ok(match,'Missing '+id);return {tag:match[1],attrs:match[2],body:html.slice(match.index+match[0].length).split('</'+match[1]+'>')[0]};}
function attr(id,name,value){assert.match(element(id).attrs,new RegExp('\\b'+name+'="'+value+'"'));}

test('panel keeps unique static IDs referenced by app and the three clear actions',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 const app=read('src/panel/js/app.js');
 for(const match of app.matchAll(/\$\('([^']+)'\)/g)){if(!match[1].endsWith('-'))assert.equal(ids.filter(id=>id===match[1]).length,1,match[1]);}
 assert.deepEqual([...html.matchAll(/\bdata-clear="([^"]+)"/g)].map(m=>m[1]).sort(),['all','auto','data']);
 assert.equal(element('aiSettings').tag,'details');
 assert.match(html,/◇ 标识从原图测得的值/);
});
test('panel numeric defaults and select contracts remain unchanged',()=>{
 const options={labelDecimals:['0','1','2','3','4'],circleDisplay:['full','extended','arc'],dashMode:['preset','solid','dashed'],aiGoal:['presentation','check'],view:['category','severity'],aiProvider:['openai','anthropic']};
 for(const [id,values] of Object.entries(options)){assert.deepEqual([...element(id).body.matchAll(/<option\b[^>]*value="([^"]+)"/g)].map(m=>m[1]),values,id);}
 const selected=[...element('labelDecimals').body.matchAll(/<option\b([^>]*)>/g)].filter(m=>/\bselected\b/.test(m[1]));assert.equal(selected.length,1);assert.match(selected[0][1],/value="2"/);
 for(const [id,attributes] of Object.entries({circleExtend:{min:'0',max:'180',step:'1',value:'30'},circleFit:{min:'0.005',max:'0.06',step:'0.0001'},labelFontSize:{min:'0',step:'0.5',value:'0'},strokeWidth:{min:'0',max:'100',step:'0.05',value:'0'},dashLength:{value:'3'},dashGap:{value:'2'},baseValue:{min:'0.000001',step:'any'}})){for(const [name,value] of Object.entries(attributes))attr(id,name,value);}
});
test('panel build and release fixed file lists agree without new runtime files',()=>{
 const build=read('tools/build.js').match(/const files = \[([^\]]+)\]/)[1];
 const release=read('tools/release.js').match(/const PANEL_FILES = Object.freeze\(\[([^\]]+)\]/)[1];
 const strings=source=>[...source.matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual([...strings(build),'js/core.js','host/host.jsx'].sort(),strings(release).sort());
});
