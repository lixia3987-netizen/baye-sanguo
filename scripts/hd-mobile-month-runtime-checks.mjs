import assert from 'node:assert/strict';

export async function settleMobileMonth({evaluate,until,delay,ready,touchButton,readKeys,worldSame,mapReadySource},beforeMonth){
 const keys=async before=>(await readKeys(before.state.keyCount)).map(row=>row.code);
 await touchButton('#hd-mobile-system-open');
 await until('Native strategy system menu',`(() => {
   const s=BayeHdSystemUi.debugSnapshot(),m=baye.hd.menuItems();
   return s.open&&s.showHd&&!s.pending&&s.screen==='insystem'&&m.active===1&&m.context===2&&m.kind===1&&m.names[0]==='策略结束';
 })()`);
 const system=await ready();assert.deepEqual(await keys(beforeMonth),[40]);worldSame(beforeMonth,system,'Opening system preserves queued orders');
 await touchButton('#hd-system-ui-list [data-hd-sys="0"]');
 const expected=[...Array(system.state.menu.index).fill(34),39];
 await until('Explicit strategy confirmation',`__mobileMapKeys.length>=${system.state.keyCount+expected.length}`);
 assert.deepEqual(await keys(system),expected,'Exactly one native strategy confirmation');
 const seen=new Set(),monthlyReports=[],deadline=Date.now()+120000;
 const year=beforeMonth.world.year+Number(beforeMonth.world.month===12),month=beforeMonth.world.month%12+1;
 while(Date.now()<deadline){
   const state=await evaluate(`(() => {
     const d=baye.data,r=baye.hd.report(),ui=BayeHdDialog.debugSnapshot(),m=baye.hd.menuItems();
     const owner=ui.reportOwner;
     return {year:Number(d.g_YearDate),month:Number(d.g_MonthDate),report:r,
       confirm:ui.open&&ui.kind==='report'&&!ui.pass&&owner&&owner.seq===r.seq&&owner.inputSeq===r.inputSeq,
       competing:baye.hd.fight().active||m.active&&m.context===5};
   })()`);
   assert.ok(!state.competing,'Monthly order route must return without a competing battle or campaign picker');
   if(state.year===year&&state.month===month&&await evaluate(mapReadySource))break;
   const r=state.report,token=r.seq+':'+r.inputSeq;
   if(r.active===1&&state.confirm&&!seen.has(token)){
     seen.add(token);const before=await ready();await touchButton('#hd-dialog [data-hd-dlg-ok]');
     assert.deepEqual(await keys(before),[39],'One ACK for the current native monthly report');monthlyReports.push(r);
   }
   await delay(160);
 }
 await until('First completed month returns to the HD map',`Number(baye.data.g_YearDate)===${year}&&Number(baye.data.g_MonthDate)===${month}&&(${mapReadySource})`,3000);
 return {settled:await ready(),year,month,reports:monthlyReports};
}
