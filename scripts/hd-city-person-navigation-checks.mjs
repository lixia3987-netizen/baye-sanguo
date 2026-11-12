import assert from 'node:assert/strict';

export function verifyNativePersonSelection(menu, target, keys, screenHeight, confirm=true) {
  assert.equal(menu.context,1);
  assert.equal(menu.kind,3);
  assert.ok(Number.isInteger(target)&&target>=0&&target<menu.count);
  const rows=Math.min(menu.count,Math.floor((screenHeight-6)/12)-1);
  const stride=Number.isInteger(rows)&&rows>1?rows-1:0;
  const movement={0x20:-stride,0x21:stride,0x22:-1,0x23:1};
  const code=key=>typeof key==='number'?key:key?.code;
  if(confirm)assert.equal(code(keys.at(-1)),0x27,'Only the current person receives one final Enter');
  let index=menu.index;
  for(const [step,key] of keys.entries()){
    if(key.menuSeq!==undefined){
      assert.equal(key.menuSeq,menu.seq,'Every key belongs to the same original person list');
      assert.equal(key.menuIndex,index,'The next key waits for the exact native cursor acknowledgement');
    }
    if(confirm&&step===keys.length-1)break;
    const delta=movement[code(key)];
    assert.ok(delta,'Only original person navigation keys are sent before confirmation');
    const next=Math.max(0,Math.min(menu.count-1,index+delta));
    assert.ok(index<target?index<next&&next<=target:target<=next&&next<index,
      'Native navigation moves toward the intended row without passing it');
    index=next;
  }
  assert.equal(index,target,'Original navigation reaches the chosen person');
}
