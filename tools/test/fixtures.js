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
function anchor(x,y) { return { a:[x,y], l:[x,y], r:[x,y] }; }
function polygonPart(points) { return { kind:'path', filled:true, stroked:false, strokeWidth:0, contours:[{closed:true,points:points.map(p=>anchor(...p))}] }; }
function rectangle(x,y,width,height) { return polygonPart([[x,y],[x+width,y],[x+width,y+height],[x,y+height]]); }
function circleContour(cx,cy,rx,ry=rx,segments=4) {
  const points=[]; const theta=2*Math.PI/segments;
  const factor=segments===4 ? KAPPA : (4/3)*Math.tan(theta/4);
  for(let i=0;i<segments;i+=1) {
    const angle=i*theta; const x=cx+rx*Math.cos(angle); const y=cy+ry*Math.sin(angle);
    const dx=-rx*Math.sin(angle)*factor; const dy=ry*Math.cos(angle)*factor;
    points.push({a:[x,y],l:[x-dx,y-dy],r:[x+dx,y+dy]});
  }
  return {closed:true,points};
}
function circlePart(cx,cy,r,inner,ry=r,segments=4) {
  const contours=[circleContour(cx,cy,r,ry,segments)];
  if(inner) contours.push(circleContour(cx,cy,inner,inner,segments));
  return {kind:inner?'compound':'path',filled:true,stroked:false,strokeWidth:0,contours};
}
function geometry(parts,artboard=[-150,200,600,-250]) {
  parts.forEach((part,i)=>{part.id='p'+i;part.sourceIndex=i;part.contours.forEach((contour,j)=>{contour.id=part.id+'c'+j;});});
  return {version:1,units:'pt',colorSpace:'RGB',artboard,parts,warnings:[]};
}
function F2() {return geometry([circlePart(0,0,100,60)]);}
function F3() {return geometry([rectangle(0,0,20,100),rectangle(40,0,20,100),rectangle(80.8,0,19.2,100)]);}
function F4() {
  const m=Math.tan(55*Math.PI/180); const q=10/Math.cos(55*Math.PI/180);
  const extent=(50+q)/m; const neck=q/m;
  return geometry([polygonPart([[-extent,-50],[-extent+2*neck,-50],[0,-q],[extent-2*neck,-50],[extent,-50],[neck,0],[extent,50],[extent-2*neck,50],[0,q],[-extent+2*neck,50],[-extent,50],[-neck,0]].map(([x,y])=>[x+50,y+50]))]);
}
function F5() {return geometry([circlePart(0,0,50,null,40)]);}
function F6() {
  const k50=50*KAPPA; const k30=30*KAPPA;
  const outer=[anchor(0,0),anchor(20,0),{a:[70,50],l:[70,50-k50],r:[70,50+k50]},anchor(20,100),anchor(0,100)];
  outer[1].r=[20+k50,0];outer[3].l=[20+k50,100];
  const inner=[anchor(20,20),{a:[50,50],l:[50,50-k30],r:[50,50+k30]},anchor(20,80)];
  inner[0].r=[20+k30,20];inner[2].l=[20+k30,80];
  return geometry([{kind:'compound',filled:true,stroked:false,strokeWidth:0,contours:[{closed:true,points:outer},{closed:true,points:inner}]}]);
}
function F7() {const g=F1();g.parts[0].contours[0].points.forEach((p,i)=>{const delta=i%2?-0.8:0.8;const x=p.a[0]/100*delta;const y=p.a[1]/100*delta;for(const key of ['a','l','r'])p[key]=[p[key][0]+x,p[key][1]+y];});return g;}
function F8() {return geometry([...Array.from({length:5},(_,i)=>rectangle(i*40,0,20,100)),...Array.from({length:4},(_,i)=>rectangle(i*40,-150,20,100))]);}
function F9() {return geometry([rectangle(0,0,20,100),circlePart(80,50,52,32)]);}
function F9b() {return geometry([rectangle(0,0,20,100),circlePart(80,50,50,30)]);}
function F10() {return geometry(Array.from({length:50},(_,i)=>circlePart((i%10)*50,-Math.floor(i/10)*50,20,null,20,40)),[-30,30,500,-250]);}
const fixtures={F1,F2,F3,F4,F5,F6,F7,F8,F9,F9b,F10};
function getFixture(name) {if(!Object.hasOwn(fixtures,name))throw new Error('Unknown fixture: '+name);return fixtures[name]();}
module.exports = { ...fixtures, getFixture, KAPPA, geometry, rectangle, circleContour, circlePart };
