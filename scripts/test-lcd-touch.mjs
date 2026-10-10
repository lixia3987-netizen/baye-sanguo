import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/lcd.js',import.meta.url),'utf8');
const touchSource=source.slice(source.indexOf('function touchScreenInit('),source.indexOf('// --------- Engine callbacks'));
class Target {
    listeners=new Map();
    addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
    removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
    fire(name,event={}){for(const fn of this.listeners.get(name)||[])fn(event);}
}
function harness(rotation=0){
    const lcd=new Target(),doc=new Target(),win=new Target(),sent=[];
    let rect={left:10,top:20,width:320,height:192},scrollCalls=0;
    lcd.getBoundingClientRect=()=>({...rect});doc.getElementById=id=>{assert.equal(id,'lcd');return lcd;};doc.hidden=false;
    const context=vm.createContext({window:win,document:doc,lcdRotateMode:rotation,lcdWidth:160,lcdHeight:96,
        disablePageScroll(){scrollCalls++;},_bayeSendTouchEvent:(...args)=>sent.push(args)});
    vm.runInContext(touchSource,context,{filename:'js/lcd.js:touchScreenInit'});
    const controller=context.touchScreenInit('lcd');
    const finger=(id=1,x=170,y=116)=>({identifier:id,clientX:x,clientY:y});
    const fire=(kind,changed,touches=changed)=>lcd.fire(kind,{changedTouches:changed,touches,targetTouches:touches,cancelable:true,preventDefault(){}});
    return {context,lcd,doc,win,sent,controller,finger,fire,setRect:r=>{rect={...rect,...r};},get scrollCalls(){return scrollCalls;}};
}

test('one native gesture maps the visible LCD rectangle to bounded game coordinates',()=>{
    const h=harness();h.fire('touchstart',[h.finger()]);h.fire('touchmove',[h.finger(1,329,211)]);h.fire('touchend',[h.finger(1,329,211)],[]);
    assert.deepEqual(h.sent,[[1,80,48],[3,159,95],[2,159,95]]);
});
for(const [rotation,expected]of [[1,[120,72]],[2,[40,24]]])test('rotated native LCD touch mapping '+rotation,()=>{
    const h=harness(rotation);h.setRect({width:192,height:320});const p=h.finger(1,58,260);
    h.fire('touchstart',[p]);h.fire('touchend',[p],[]);assert.deepEqual(h.sent,[[1,...expected],[2,...expected]]);
});
test('cancel uses the last accepted coordinates, sends no UP, and is idempotent',()=>{
    const h=harness();h.controller.cancel();assert.deepEqual(h.sent,[]);
    h.fire('touchstart',[h.finger()]);h.fire('touchmove',[h.finger(1,90,68)]);
    h.setRect({left:200,width:640});h.context.lcdRotateMode=2;h.controller.cancel();h.controller.cancel();
    h.fire('touchend',[h.finger()],[]);assert.deepEqual(h.sent,[[1,80,48],[3,40,24],[4,40,24]]);
});
for(const event of ['blur','resize','orientationchange'])test(event+' retires only an existing touch once',()=>{
    const h=harness();h.win.fire(event);assert.deepEqual(h.sent,[]);h.fire('touchstart',[h.finger()]);
    h.win.fire(event);h.win.fire(event);h.fire('touchend',[h.finger()],[]);assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
});
test('hidden document cancels an active gesture and cannot start another one',()=>{
    const h=harness();h.fire('touchstart',[h.finger()]);h.doc.hidden=true;h.doc.fire('visibilitychange');
    h.doc.fire('visibilitychange');h.fire('touchstart',[h.finger()]);assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
    h.doc.hidden=false;h.doc.fire('visibilitychange');h.fire('touchstart',[h.finger()]);h.fire('touchend',[h.finger()],[]);
    assert.deepEqual(h.sent.slice(2),[[1,80,48],[2,80,48]]);
});
for(const transition of ['left','top','width','height','rotation'])test('changed '+transition+' cancels rather than reprojects the release',()=>{
    const h=harness();h.fire('touchstart',[h.finger()]);
    if(transition==='rotation')h.context.lcdRotateMode=1;else h.setRect({[transition]:transition==='left'?11:transition==='top'?21:transition==='width'?321:193});
    h.fire('touchend',[h.finger()],[]);assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
});
test('geometry drift is compared with the original gesture, not accumulated between moves',()=>{
    const h=harness();h.fire('touchstart',[h.finger()]);h.setRect({left:10.3});h.fire('touchmove',[h.finger()]);
    h.setRect({left:10.6});h.fire('touchmove',[h.finger()]);assert.equal(h.sent.at(-1)[0],4);assert.equal(h.sent.length,3);
});
test('a second finger cancels the gesture and blocks reuse until every finger is lifted',()=>{
    const h=harness(),a=h.finger(),b=h.finger(2,90,68);h.fire('touchstart',[a]);h.fire('touchstart',[b],[a,b]);
    h.fire('touchend',[a],[b]);h.fire('touchmove',[b],[b]);h.fire('touchstart',[b],[b]);assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
    h.fire('touchend',[b],[]);h.fire('touchstart',[a]);h.fire('touchend',[a],[]);assert.deepEqual(h.sent.slice(2),[[1,80,48],[2,80,48]]);
});
test('unrelated changed touch does not release the selected finger',()=>{
    const h=harness(),a=h.finger(),b=h.finger(2,90,68);h.fire('touchstart',[a]);h.fire('touchend',[b],[a]);
    assert.deepEqual(h.sent,[[1,80,48]]);h.fire('touchend',[a],[]);assert.deepEqual(h.sent.at(-1),[2,80,48]);
});

test('a second finger outside the LCD cancels without preventing other controls and global lift unblocks',()=>{
    const h=harness(),a=h.finger(),b=h.finger(2,500,10);h.fire('touchstart',[a]);
    h.doc.fire('touchstart',{touches:[a,b],preventDefault(){assert.fail('global listener must not prevent other controls');}});
    h.fire('touchend',[a],[b]);h.fire('touchstart',[a],[a,b]);
    assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
    h.doc.fire('touchend',{touches:[]});h.fire('touchstart',[a]);h.fire('touchend',[a],[]);
    assert.deepEqual(h.sent.slice(2),[[1,80,48],[2,80,48]]);
});

for(const name of ['lcdWidth','lcdHeight'])test('native '+name+' changing during the gesture cancels instead of reprojecting UP',()=>{
    const h=harness();h.fire('touchstart',[h.finger()]);h.context[name]*=2;h.fire('touchend',[h.finger()],[]);
    assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
});

test('invalid native dimensions and nonfinite rectangles never send DOWN',()=>{
    for(const size of [0,-1,NaN,Infinity,1.5,null]){
        const h=harness();h.context.lcdWidth=size;h.fire('touchstart',[h.finger()]);assert.deepEqual(h.sent,[]);
    }
    for(const field of ['left','top','width','height']){
        const h=harness();h.setRect({[field]:Infinity});h.fire('touchstart',[h.finger()]);assert.deepEqual(h.sent,[]);
    }
});
test('platform touchCancel with an empty changed list still retires the active gesture',()=>{
    const h=harness();h.fire('touchstart',[h.finger()]);h.fire('touchcancel',[],[]);h.fire('touchend',[h.finger()],[]);
    assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
});
test('outside or invalid coordinates cannot start; leaving the LCD cancels before release',()=>{
    const h=harness();for(const [x,y]of [[9,50],[330,50],[50,19],[50,212],[NaN,50],[null,50],[Infinity,50]])h.fire('touchstart',[h.finger(1,x,y)]);
    assert.deepEqual(h.sent,[]);h.fire('touchstart',[h.finger()]);h.fire('touchmove',[h.finger(1,500,116)]);h.fire('touchend',[h.finger()],[]);
    assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);
});
test('zero coordinates remain valid and collapsed geometry sends no native event',()=>{
    const h=harness();h.setRect({left:0,top:0});h.fire('touchstart',[h.finger(1,0,0)]);h.fire('touchend',[h.finger(1,0,0)],[]);
    assert.deepEqual(h.sent,[[1,0,0],[2,0,0]]);h.setRect({width:0});h.fire('touchstart',[h.finger(1,0,0)]);assert.equal(h.sent.length,2);
});
test('mounting twice adds no duplicate input and destroy removes listeners',()=>{
    const h=harness();assert.equal(h.context.touchScreenInit('lcd'),h.controller);assert.equal(h.scrollCalls,1);
    h.fire('touchstart',[h.finger()]);h.controller.destroy();h.fire('touchend',[h.finger()],[]);h.win.fire('resize');
    for(const kind of ['touchstart','touchend','touchcancel'])assert.equal(h.doc.listeners.get(kind)?.size,0);
    assert.deepEqual(h.sent,[[1,80,48],[4,80,48]]);const next=h.context.touchScreenInit('lcd');assert.notEqual(next,h.controller);
    h.fire('touchstart',[h.finger()]);h.fire('touchend',[h.finger()],[]);assert.deepEqual(h.sent.slice(2),[[1,80,48],[2,80,48]]);
});
