'use strict';
/** ScriptUI event double: exercises real builder and callbacks, not native window rendering. */
function windowMock(state){
 return function Window(kind,title){
  const dialog={kind,title,children:[],closed:false};
  function node(type,text,items,properties){
   const n={type,text:typeof text==='string'?text:'',children:[],enabled:true,properties:properties||{}};
   n.add=(type,_bounds,text,properties)=>{const child=node(type,text,Array.isArray(text)?text:undefined,properties);n.children.push(child);return child;};
   if(type==='dropdownlist'){
    n.items=Array.from(items||[]).map((text,index)=>({text,index}));let selection=null;Object.defineProperty(n,'selection',{get:()=>selection,set:v=>{selection=typeof v==='number'?n.items[v]:v;}});
   }return n;
  }
  Object.assign(dialog,node('dialog',title));dialog.close=code=>{dialog.closed=true;dialog.code=code;};dialog.center=()=>{};
  dialog.flatten=()=>{const all=[];const visit=n=>{all.push(n);n.children.forEach(visit);};visit(dialog);return all;};
  dialog.show=()=>{state.dialogs=(state.dialogs||[]).concat(dialog);if(state.onDialog)state.onDialog(dialog);else if(!state.cancelDialog){const ok=dialog.flatten().find(n=>n.type==='button'&&n.properties.name==='ok');if(ok)ok.onClick();}return dialog.code||0;};
  return dialog;
 };
}
module.exports={windowMock};
