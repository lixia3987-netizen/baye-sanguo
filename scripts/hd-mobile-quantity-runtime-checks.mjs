// Read-only DOM evidence for the native-owned quantity displayed by either HD host.
import assert from 'node:assert/strict';

export async function checkMobileQuantityPresentation(evaluate, label) {
  const evidence=await evaluate(`(() => {
    const q=baye.hd.qty(),stage=document.getElementById('hd-mobile-stage').getBoundingClientRect();
    const shown=n=>{if(!n)return false;for(let p=n;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);if(p.hidden||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;}return true;};
    const city=document.getElementById('hd-city-qty-val'),dialog=document.getElementById('hd-dialog-body');
    const n=shown(city)?city:shown(dialog)&&window.BayeHdDialog&&BayeHdDialog.debugSnapshot().kind==='qty'?dialog:null;
    if(!n)return {qty:q,missing:true};
    const r=n.getBoundingClientRect(),clip={left:Math.max(0,stage.left),right:Math.min(innerWidth,stage.right),top:Math.max(0,stage.top),bottom:Math.min(innerHeight,stage.bottom)};
    const ancestors=[];for(let p=n.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),a=p.getBoundingClientRect();
      if(['hidden','clip','auto','scroll'].includes(s.overflowX)){clip.left=Math.max(clip.left,a.left);clip.right=Math.min(clip.right,a.right);}
      if(['hidden','clip','auto','scroll'].includes(s.overflowY)){clip.top=Math.max(clip.top,a.top);clip.bottom=Math.min(clip.bottom,a.bottom);}
      ancestors.push({id:p.id,classes:p.className,scrollTop:p.scrollTop,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,overflowY:s.overflowY});}
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),text=n.textContent;
    return {qty:q,selector:'#'+n.id,text,geometry:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},clip,ancestors,
      unobstructed:hit===n||!!hit&&n.contains(hit),hit:hit&&(hit.id||hit.tagName),
      matchesNative:n===city?text.trim()===String(q.value):text.includes('当前 '+q.value+'（'+q.min+'–'+q.max+'）。')};
  })()`);
  assert.ok(evidence&&!evidence.missing,label+' has a visible current quantity summary');
  assert.ok(evidence.qty.active===1&&evidence.qty.protocol&&evidence.qty.ready===1,label+' has current native quantity ACK');
  assert.equal(evidence.matchesNative,true,label+' displays the actual native value and range');
  const {geometry:r,clip}=evidence;
  assert.ok(r.width>0&&r.height>0&&r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5,label+' quantity summary is fully inside its actual clipping ancestors');
  assert.equal(evidence.unobstructed,true,label+' current quantity summary is unobstructed');
  return {label,...evidence};
}
