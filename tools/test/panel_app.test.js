'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {bundleFiles,sourceFiles}=require('../build');
const root=path.resolve(__dirname,'../..');
// Minimal event/DOM boundary: execute the actual app and controller, no host or files.
async function app(config={provider:'openai',baseUrl:'https://example.test/v1',model:'test',apiKey:'test-only'}){
 const ids=new Map(),all=[];
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.attrs={};this.children=[];this.events={};this.value='';this.disabled=false;this.classList={toggle(){},add(){},remove(){}};all.push(this);}
  set id(value){this.attrs.id=value;ids.set(value,this);}get id(){return this.attrs.id;}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
  append(...children){this.children.push(...children);}appendChild(child){this.append(child);}
  addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
  focus(){document.activeElement=this;}
  click(){if(!this.disabled){for(const fn of this.events.click||[])fn();if(this.onclick)this.onclick();}}
  change(){if(this.onchange)this.onchange();}
 }
 const html=fs.readFileSync(path.join(root,'src/panel/index.html'),'utf8');
 for(const m of html.matchAll(/<([a-z]+)\b([^>]*\bid="[^"]+"[^>]*)>/g)){const el=new Element(m[1]);for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g))el.setAttribute(a[1],a[2]);el.id=el.attrs.id;el.value=el.attrs.value||'';}
 const document={getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),body:new Element('body'),querySelectorAll(selector){if(selector==='[role="tab"]')return all.filter(e=>e.attrs.role==='tab');if(selector==='[data-clear]')return [];return all.filter(e=>['BUTTON','INPUT','SELECT'].includes(e.tagName)&&!(selector.includes(':not')&&e.attrs.role==='tab'));}};
 const context=vm.createContext({document,performance,setTimeout,clearTimeout,console,URL,require,Promise});
 context.window=context;context.__adobe_cep__={};context.CSInterface=function(){this.getSystemPath=()=>'/mock-user-data';};context.SystemPath={USER_DATA:'user'};
 for(const file of sourceFiles(path.join(root,'src/core')))vm.runInContext(fs.readFileSync(file,'utf8'),context);
 for(const file of ['model','controller','ai'])vm.runInContext(fs.readFileSync(path.join(root,'src/panel/js/'+file+'.js'),'utf8'),context);
 const saved=[];context.LGPanelAI.storage=()=>({load:()=>config,save:value=>saved.push({...value})});
 let release;let blocked=false;
 context.LGPanel.bridge=()=>async()=>{if(blocked)await new Promise(resolve=>{release=resolve;});return {settings:context.LG.config.defaults(),docData:null,documentToken:'mock',documentName:'mock'};};
 vm.runInContext(fs.readFileSync(path.join(root,'src/panel/js/app.js'),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 return {context,ids,saved,block(){blocked=true;},release(){blocked=false;release();}};
}
test('provider switch restores custom endpoint and subsequent save/request use that endpoint',async()=>{
 const {context:c,ids,saved}=await app();const provider=ids.get('aiProvider'),url=ids.get('aiBaseUrl');
 provider.value='anthropic';provider.change();assert.equal(url.value,'https://api.anthropic.com/v1');assert.equal(url.readOnly,true);
 provider.value='openai';provider.change();assert.equal(url.value,'https://example.test/v1');assert.equal(url.readOnly,false);
 ids.get('aiSave').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(saved[0].baseUrl,url.value);
 let requested;await c.LGPanelAI.suggest(saved[0],{features:[]},{post:async endpoint=>{requested=endpoint;return {choices:[{message:{content:JSON.stringify({show:[],hide:[],targets:[],groups:[],notes:''})}}]};}});
 assert.equal(requested,'https://example.test/v1/chat/completions');
 url.value='https://another.test/v1';provider.value='anthropic';provider.change();provider.value='openai';provider.change();assert.equal(url.value,'https://another.test/v1');
});
test('Anthropic startup cannot supply its fixed address as a missing OpenAI endpoint',async()=>{
 const {context:c,ids}=await app({provider:'anthropic',baseUrl:'https://api.anthropic.com/v1',model:'test',apiKey:'test-only'});
 assert.equal(ids.get('aiBaseUrl').readOnly,true);ids.get('aiProvider').value='openai';ids.get('aiProvider').change();assert.equal(ids.get('aiBaseUrl').value,'');
 assert.throws(()=>c.LGPanelAI.config({provider:'openai',baseUrl:'',model:'test'},false),/HTTPS/);
});
test('busy host work keeps tabs navigable with keyboard while disabling business controls',async()=>{
 const harness=await app();const {context:c,ids}=harness;harness.block();const running=c.logoGuidesPanel.init();
 assert.equal(ids.get('generate').disabled,true);assert.equal(ids.get('tab-ai').disabled,false);
 ids.get('tab-ai').click();assert.equal(ids.get('page-ai').hidden,false);assert.equal(ids.get('page-parameters').hidden,true);
 ids.get('tab-ai').events.keydown[0]({key:'Home',preventDefault(){}});assert.equal(ids.get('tab-parameters').attrs['aria-selected'],'true');
 harness.release();await running;assert.equal(ids.get('generate').disabled,false);assert.equal(ids.get('aiRequest').disabled,true);assert.equal(ids.get('aiApply').disabled,true);
});
