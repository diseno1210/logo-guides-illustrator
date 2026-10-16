LG.circles=(function(){
    var U=LG.util;var V=LG.vec;
    /** Pivoted 3x3 linear solve; null for a singular system. */
    function solve(A,b){var a=U.mapArr(A,function(row,i){return row.concat([b[i]]);});var i;var j;var k;var best;var swap;var factor;for(i=0;i<3;i+=1){best=i;for(j=i+1;j<3;j+=1){if(Math.abs(a[j][i])>Math.abs(a[best][i])){best=j;}}if(Math.abs(a[best][i])<1e-15){return null;}swap=a[i];a[i]=a[best];a[best]=swap;factor=a[i][i];for(k=i;k<4;k+=1){a[i][k]/=factor;}for(j=0;j<3;j+=1){if(j!==i){factor=a[j][i];for(k=i;k<4;k+=1){a[j][k]-=factor*a[i][k];}}}}return [a[0][3],a[1][3],a[2][3]];}
    /** Centered Kasa initialization followed by at most20 geometric LM iterations. */
    function fit(samples){
        var n=samples.length;if(n<3){return null;}var mx=0;var my=0;var scale=0;var points=[];var uu=0;var vv=0;var uv=0;var bu=0;var bv=0;var i;var p;var det;var cx;var cy;var r;var lambda=0.001;
        U.each(samples,function(s){mx+=s.p[0]/n;my+=s.p[1]/n;});U.each(samples,function(s){scale=Math.max(scale,V.distance(s.p,[mx,my]));});if(!(scale>0)||!U.finite(scale)){return null;}
        U.each(samples,function(s){var u=(s.p[0]-mx)/scale;var v=(s.p[1]-my)/scale;var q=u*u+v*v;points.push([u,v]);uu+=u*u;vv+=v*v;uv+=u*v;bu+=0.5*u*q;bv+=0.5*v*q;});
        det=uu*vv-uv*uv;if(det<=1e-12*(uu+vv)*(uu+vv)){return null;}cx=(bu*vv-bv*uv)/det;cy=(bv*uu-bu*uv)/det;r=Math.sqrt(cx*cx+cy*cy+(uu+vv)/n);
        function loss(x,y,radius){var sum=0;U.each(points,function(q){var error=V.distance(q,[x,y])-radius;sum+=error*error;});return sum;}
        var cost=loss(cx,cy,r);var iteration;
        for(iteration=0;iteration<20;iteration+=1){
            var A=[[0,0,0],[0,0,0],[0,0,0]];var b=[0,0,0];var step;var nextCost;
            U.each(points,function(q){var dx=cx-q[0];var dy=cy-q[1];var dist=U.hypot(dx,dy);if(dist<=1e-15){return;}var J=[dx/dist,dy/dist,-1];var error=dist-r;var j;var k;for(j=0;j<3;j+=1){b[j]-=J[j]*error;for(k=0;k<3;k+=1){A[j][k]+=J[j]*J[k];}}});
            for(i=0;i<3;i+=1){A[i][i]*=1+lambda;}step=solve(A,b);if(!step){break;}if(U.hypot(step[0],step[1])+Math.abs(step[2])<1e-6*r){break;}if(r+step[2]<=0){lambda*=10;continue;}nextCost=loss(cx+step[0],cy+step[1],r+step[2]);
            if(nextCost<=cost){cx+=step[0];cy+=step[1];r+=step[2];cost=nextCost;lambda/=10;if(U.hypot(step[0],step[1])+Math.abs(step[2])<1e-6*r){break;}}else{lambda*=10;}
        }
        cx=mx+cx*scale;cy=my+cy*scale;r*=scale;var maxErr=-1;var rms=0;var maxPoint=null;var signed=0;
        U.each(samples,function(s){var error=V.distance(s.p,[cx,cy])-r;rms+=error*error/n;if(Math.abs(error)>maxErr){maxErr=Math.abs(error);maxPoint=s.p.slice(0);signed=error;}});
        if(!U.finite(cx)||!U.finite(cy)||!U.finite(r)||!U.finite(maxErr)||!U.finite(rms)||!(r>0)){return null;}
        return {cx:cx,cy:cy,r:r,maxErr:maxErr,rmsErr:Math.sqrt(rms),maxErrPoint:maxPoint,maxErrSigned:signed};
    }
    /** Signed tangent change, bounded to[-pi,pi]. */
    function turn(a,b){return Math.atan2(V.cross(a,b),V.dot(a,b));}
    /** Forward tangent at a cubic endpoint, including coincident-handle limits. */
    function endpointT(segment,end){var p=segment.p;var origin=end?p[3]:p[0];var order=end?[2,1,0]:[1,2,3];var tangent=[0,0];var i;for(i=0;i<order.length;i+=1){tangent=end?V.sub(origin,p[order[i]]):V.sub(p[order[i]],origin);if(V.length(tangent)>1e-9){return V.unit(tangent);}}return tangent;}
    /** Curve-only runs split by flat curvature, corners and curvature-sign changes. */
    function runs(model){var result=[];U.each(model.parts,function(part){U.each(part.contours,function(contour){var local=[];var current=[];var previous=null;var firstEligible=false;var lastEligible=false;function flush(){if(current.length){local.push(current);current=[];}previous=null;}
        U.each(contour.segments,function(segment,index){if(segment.type!=="cubic"){flush();return;}U.each(segment.samples,function(sample,j){var eligible=Math.abs(sample.kappa)>=model.derived.kappaMin;if(index===0&&j===0){firstEligible=eligible;}if(index===contour.segments.length-1&&j===segment.samples.length-1){lastEligible=eligible;}if(!eligible){flush();return;}if(previous&&(sample.kappa*previous.kappa<0||(j===0&&index>0&&Math.abs(turn(endpointT(contour.segments[index-1],true),endpointT(segment,false)))*180/Math.PI>model.config.cornerAngleDeg))){flush();}current.push(sample);previous=sample;});});flush();
        if(contour.closed&&firstEligible&&lastEligible&&local.length>1){var first=local[0];var last=local[local.length-1];if(first[0].kappa*last[last.length-1].kappa>0&&Math.abs(turn(endpointT(contour.segments[contour.segments.length-1],true),endpointT(contour.segments[0],false)))*180/Math.PI<=model.config.cornerAngleDeg){local[0]=last.concat(first);local.pop();}}
        U.each(local,function(run){result.push(run);});
    });});return result;}
    /** Accumulated tangent turning in degrees, after run segmentation. */
    function turning(samples){var sum=0;var i;for(i=1;i<samples.length;i+=1){sum+=turn(samples[i-1].T,samples[i].T);}return Math.abs(sum)*180/Math.PI;}
    /** Fit tolerance and maximum-radius checks shared by all merging stages. */
    function acceptable(circle,model){if(!circle){return false;}circle.tolAbs=Math.min(model.config.circleFitTol*circle.r,model.config.circleAbsCapRel*model.S);return circle.maxErr<=circle.tolAbs&&circle.r<=model.config.circleMaxRadiusFactor*model.D;}
    /** Recursive arc-length halves; every subdivision reduces the sample count. */
    function fitRegion(samples,model){var angle=turning(samples);var fitCircle;var mid;var lengths=[0];var total=0;var i;if(samples.length<model.config.circleMinSamples||angle<model.config.circleMinArcDeg){return [];}fitCircle=fit(samples);if(acceptable(fitCircle,model)){fitCircle.samples=samples;return [fitCircle];}if(angle<2*model.config.circleMinArcDeg){return [];}for(i=1;i<samples.length;i+=1){total+=V.distance(samples[i-1].p,samples[i].p);lengths.push(total);}mid=Math.floor(samples.length/2);for(i=1;i<samples.length-1;i+=1){if(lengths[i]>=total/2){mid=i;break;}}mid=Math.max(1,Math.min(samples.length-1,mid));return fitRegion(samples.slice(0,mid),model).concat(fitRegion(samples.slice(mid),model));}
    /** Largest-angle-gap coverage, with an unwrapped end angle. */
    function coverage(circle){var angles=U.mapArr(circle.samples,function(s){return (Math.atan2(s.p[1]-circle.cy,s.p[0]-circle.cx)*180/Math.PI+360)%360;}).sort(function(a,b){return a-b;});var gap=-1;var index=0;var i;var value;for(i=0;i<angles.length;i+=1){value=(i===angles.length-1?angles[0]+360:angles[i+1])-angles[i];if(value>gap){gap=value;index=i;}}circle.coverageDeg=360-gap;circle.arcStartDeg=angles[(index+1)%angles.length];circle.arcEndDeg=circle.arcStartDeg+circle.coverageDeg;}
    /** Shared angular intervals split at360, then intersected for ring evidence. */
    function intervals(circle){var start=circle.arcStartDeg;var end=circle.arcEndDeg;return end<=360?[[start,end]]:[[start,360],[0,end-360]];}
    function common(a,b){var out=[];U.each(intervals(a),function(x){U.each(intervals(b),function(y){var lo=Math.max(x[0],y[0]);var hi=Math.min(x[1],y[1]);if(hi>lo){out.push([lo,hi]);}});});return out;}
    /** Detect ink-filled annuli from concentric retained fits belonging to one part. */
    function rings(circles,model){var result=[];var inkAt=LG.ink.create(model);var i;var j;for(i=0;i<circles.length;i+=1){for(j=i+1;j<circles.length;j+=1){var a=circles[i];var b=circles[j];if(V.distance([a.cx,a.cy],[b.cx,b.cy])>model.config.circleMergeTol*Math.max(a.r,b.r)||Math.abs(a.r-b.r)<=model.config.EPS){continue;}var shared=U.filterArr(a.partIds,function(id){return U.indexOf(b.partIds,id)>=0;});var ranges=common(a,b);var length=0;U.each(ranges,function(r){length+=r[1]-r[0];});if(!length||!shared.length){continue;}
            function pointAt(angle){var rad=angle*Math.PI/180;return [a.cx+(a.r+b.r)/2*Math.cos(rad),a.cy+(a.r+b.r)/2*Math.sin(rad)];}
            function included(angle){var yes=false;U.each(ranges,function(r){if(angle>=r[0]&&angle<=r[1]){yes=true;}});return yes;}
            var validPart=null;U.each(shared,function(id){var valid=true;U.each([0.25,0.5,0.75],function(t){var offset=t*length;var angle=ranges[0][0];var k;for(k=0;k<ranges.length;k+=1){if(offset<=ranges[k][1]-ranges[k][0]){angle=ranges[k][0]+offset;break;}offset-=ranges[k][1]-ranges[k][0];}var p=pointAt(angle);if(!inkAt(p[0],p[1],id)){valid=false;}});if(valid&&!validPart){validPart=id;}});
            if(validPart){var chosen=null;U.each([45,135,315,225,90,0,270,180],function(angle){var p=pointAt(angle);if(chosen===null&&included(angle)&&inkAt(p[0],p[1],validPart)){chosen=angle;}});if(chosen!==null){result.push({id:"R"+(result.length+1),outerId:a.r>b.r?a.id:b.id,innerId:a.r>b.r?b.id:a.id,thickness:Math.abs(a.r-b.r),angleDeg:chosen,measure:{}});}}
        }}return result;}
    /** Fit runs, adjacent regions and union-find groups; classify and cap only after ring evidence. */
    function run(model){var cfg=model.config;var fits=[];U.each(runs(model),function(samples){var regions=fitRegion(samples,model);var changed=true;while(changed){changed=false;var next=[];var i=0;while(i<regions.length){if(i+1<regions.length){var joined=regions[i].samples.concat(regions[i+1].samples);var candidate=fit(joined);if(acceptable(candidate,model)){candidate.samples=joined;next.push(candidate);i+=2;changed=true;continue;}}next.push(regions[i]);i+=1;}regions=next;}fits=fits.concat(regions);});
        var parents=[];var i;var j;function root(n){while(parents[n]!==n){parents[n]=parents[parents[n]];n=parents[n];}return n;}for(i=0;i<fits.length;i+=1){parents.push(i);}for(i=0;i<fits.length;i+=1){for(j=i+1;j<fits.length;j+=1){var a=fits[i];var b=fits[j];var tol=cfg.circleMergeTol*Math.max(a.r,b.r);if(V.distance([a.cx,a.cy],[b.cx,b.cy])<=tol&&Math.abs(a.r-b.r)<=tol){parents[root(j)]=root(i);}}}
        var groups={};for(i=0;i<fits.length;i+=1){var key="$"+root(i);if(!U.has(groups,key)){groups[key]=[];}groups[key].push(fits[i]);}var merged=[];var keyName;for(keyName in groups){if(U.has(groups,keyName)){var group=groups[keyName];if(group.length===1){merged.push(group[0]);continue;}var all=[];U.each(group,function(c){all=all.concat(c.samples);});var combined=fit(all);if(acceptable(combined,model)){combined.samples=all;merged.push(combined);}else{merged=merged.concat(group);}}}
        U.each(merged,function(c,index){c.id="C"+(index+1);c.partIds=[];c.contourIds=[];U.each(c.samples,function(s){if(U.indexOf(c.partIds,s.partId)<0){c.partIds.push(s.partId);}if(U.indexOf(c.contourIds,s.contourId)<0){c.contourIds.push(s.contourId);}});coverage(c);c.category="fitted";U.each(model.referenceLines,function(l){if(l.orient==="h"&&l.category==="visual"&&(Math.abs(c.cy+c.r-l.pos)<=model.derived.tolPos||Math.abs(c.cy-c.r-l.pos)<=model.derived.tolPos)){c.category="visual";}});c.score=c.coverageDeg*(1-0.5*(c.tolAbs>cfg.EPS?c.maxErr/c.tolAbs:0))*(1+0.25*(c.contourIds.length-1));c.measureR={};});
        var ringList=rings(merged,model);var priority=[];U.each(ringList,function(r){priority.push(r.outerId);priority.push(r.innerId);});merged.sort(function(a,b){var ap=a.category==="visual"||U.indexOf(priority,a.id)>=0;var bp=b.category==="visual"||U.indexOf(priority,b.id)>=0;return (ap===bp?0:(ap?-1:1))||b.score-a.score;});merged=merged.slice(0,cfg.settings.maxCircles);ringList=U.filterArr(ringList,function(r){var a=false;var b=false;U.each(merged,function(c){if(c.id===r.outerId){a=true;}if(c.id===r.innerId){b=true;}});return a&&b;});
        U.each(merged,function(c){delete c.samples;});model.circles=merged;model.rings=ringList;return model;
    }
    return {fit:fit,runs:runs,run:run};
}());
