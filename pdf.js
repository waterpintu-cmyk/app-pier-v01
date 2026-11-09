"use strict";
// สร้างหน้ารายงานจากข้อมูลจริงในฐานข้อมูล แล้วสั่งพิมพ์ → "บันทึกเป็น PDF" (เบราว์เซอร์ฝังฟอนต์ให้)
// ทุกตัวเลขคำนวณจากรายการรายวัน; ไม่แก้ตัวเลขเงียบ ๆ; ถ้ายังไม่ได้บันทึก จะแสดงว่า "ยังไม่ได้บันทึก" ไม่ใช่ "ไม่มี"
// รูปแบบหน้าตาตามดีไซน์ฉบับปรับปรุง (ปก/สรุปผู้บริหาร/กราฟ/ไทม์ไลน์/การ์ดตรวจอุปกรณ์); แผง "ผลตรวจสอบ" และข้อสังเกตผู้ตรวจไม่รวมในรายงานจริง
const SYS={lighting_outlets:"ไฟฟ้าแสงสว่างและเต้ารับ",civil:"งานโยธา",fire_detection:"ตรวจจับเพลิงไหม้",fire_protection:"ป้องกันเพลิงไหม้",communication:"สื่อสาร",water:"ประปา",pontoon_fender:"ป้องกันการกระแทกโป๊ะ"};
const PTS={pontoon1:"โป๊ะเทียบเรือที่ 1",pontoon2:"โป๊ะเทียบเรือที่ 2",pontoon3_express:"โป๊ะเทียบเรือที่ 3 เรือด่วน",pontoon4_ev:"โป๊ะเทียบเรือที่ 4 EV",walkway_bridge:"ทางเดินและสะพานปรับระดับ",terminal:"อาคารผู้โดยสาร"};
const AREAS={coordination:"ประสานงาน",boarding_assist:"อำนวยความสะดวกขึ้นลงเรือ",travel_info:"แนะนำการเดินทาง",safety:"ดูแลความปลอดภัย",maintenance:"ดูแลการซ่อมบำรุง",cleaning:"รักษาความสะอาด"};
const KIND={accident:"อุบัติเหตุ",unsafe:"เหตุการณ์ไม่ปลอดภัย",other:"อื่น ๆ"};
const money=v=>v==null?"–":Number(v).toLocaleString("th",{minimumFractionDigits:2,maximumFractionDigits:2});
const nf=n=>Number(n).toLocaleString("en-US");
const hm=ts=>ts?new Date(ts).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Bangkok"}):"–";
const bkd=ts=>new Date(ts).toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"});   // วันที่ตามเวลาไทย (ไม่ใช้ slice ของ UTC ซึ่งคลาดเคลื่อนไป 1 วัน)
const timeKnown=ts=>hm(ts)!=="00:00";                                                  // 00:00 = ต้นฉบับมีแต่วันที่ ไม่ทราบเวลา
const ceilAvg=(a,n)=>n?Math.ceil(a/n):null;
const T=(h,rows,o={})=>`<table><thead><tr>${h.map((x,i)=>`<th class="${o.n&&o.n.includes(i)?"r":""}">${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr class="${r.cls||""}">${(r.c||r).map((x,i)=>`<td class="${o.n&&o.n.includes(i)?"r":""}">${x==null||x===""?"–":(r.raw?x:esc(x))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const monthDays=(y,m)=>new Date(y,m,0).getDate();
const C={navy:"#1b2a6b",red:"#6d2b91",bronze:"#9b6fc0",tint:"#f3f3f8",line:"#d9d9e3",muted:"#62627a",ink:"#1f1f33"};

async function loadAll(y,m){
  const sid=S.station.id, p2=n=>String(n).padStart(2,"0"), st=`${y}-${p2(m)}-01`, ny=m===12?y+1:y, nm=m===12?1:m+1, nx=`${ny}-${p2(nm)}-01`;
  const ts0=`${st}T00:00:00+07:00`, ts1=`${nx}T00:00:00+07:00`, q=(t,f)=>f(sb.from(t).select("*").eq("station_id",sid));
  const R=await Promise.all([
   sb.from("stations").select("*").eq("id",sid).single(),
   q("monthly_reports",x=>x.eq("period_year",y).eq("period_month",m).maybeSingle()),
   q("passenger_logs",x=>x.gte("log_date",st).lt("log_date",nx).order("log_date")),
   q("incidents",x=>x.gte("occurred_at",ts0).lt("occurred_at",ts1).order("occurred_at")),
   q("maintenance_jobs",x=>x.lt("reported_on",nx).or(`status.neq.done,completed_on.gte.${st}`).order("reported_on")),
   q("pier_fees",x=>x.gte("fee_date",st).lt("fee_date",nx).order("fee_date")),
   q("revenue_remittances",x=>x.gte("remitted_on",st).lt("remitted_on",nx).order("remitted_on")),
   q("complaints",x=>x.gte("received_on",st).lt("received_on",nx).order("received_on")),
   q("lost_property",x=>x.gte("event_date",st).lt("event_date",nx).order("event_date")),
   sb.from("readiness_checks").select("*,readiness_check_items(*)").eq("station_id",sid).gte("check_date",st).lt("check_date",nx).order("check_date"),
   q("service_activities",x=>x.gte("activity_date",st).lt("activity_date",nx).order("activity_date")),
   q("boat_schedules",x=>x.lt("effective_from",nx).or(`effective_to.is.null,effective_to.gte.${st}`).order("operator").order("departure_time")),
   q("employees",x=>x.order("position").order("full_name")),
   q("shift_assignments",x=>x.gte("shift_date",st).lt("shift_date",nx)),
   q("attendance_logs",x=>x.gte("shift_date",st).lt("shift_date",nx).order("shift_date")),
   q("equipment_items",x=>x.order("seq")),
   q("equipment_checks",x=>x.gte("check_date",st).lt("check_date",nx).order("check_date")),
   q("acceptance_records",x=>x),
   q("employee_change_notices",x=>x.gte("effective_date",st).lt("effective_date",nx)),
   q("daily_declarations",x=>x.gte("log_date",st).lt("log_date",nx)),
   q("attachments",x=>x.neq("bucket","hr-restricted")),
   q("remittance_fee_links",x=>x),
   sb.from("profiles").select("id,full_name")]);
  const bad=R.find(r=>r.error); if(bad) throw bad.error;
  const k=["stn","rep","pax","inc","mnt","fee","rem","cmp","lost","rdy","svc","sch","emp","shf","att","eqi","eqc","acc","chg","dec","atc","lnk","prof"], D={};
  k.forEach((n,i)=>D[n]=R[i].data); D.acc=(D.acc||[]).filter(a=>D.rep&&a.report_id===D.rep.id); return D;
}

function declStatus(D,topic,count,y,m){ // ไม่มีรายการ ≠ ยังไม่บันทึก
  if(count>0) return null; const days=monthDays(y,m), none=D.dec.filter(d=>d.topic===topic&&d.status==="none").length;
  return none>=days?`<p>ในเดือนนี้ไม่มีรายการ (บันทึกว่า "ไม่มีรายการ" ครบ ${days} วัน)</p>`:`<p class="warn">ยังไม่มีรายการ และบันทึกว่า "ไม่มีรายการ" แล้ว ${none} จาก ${days} วัน — ยังบอกไม่ได้ว่าไม่มีเหตุ</p>`;
}

// ---------- กราฟ SVG (สร้างจากข้อมูลจริง) ----------
const tx=(x,y,t,o={})=>`<text x="${x}" y="${y}" text-anchor="${o.a||"start"}" font-size="${o.s||11}"${o.b?' font-weight="700"':""}${o.f?` style="fill:${o.f}"`:""}>${esc(t)}</text>`;
function chDaily(byDay,days,avgW){
  const W=700,H=280,L=40,R=10,T0=26,B=34,pw=W-L-R,ph=H-T0-B,bw=pw/days;
  const mx=Math.max(200,Math.ceil(Math.max(0,...Object.values(byDay).map(r=>r.total))/200)*200);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟผู้โดยสารรายวัน">`;
  for(let d=1;d<=days;d++) if(byDay[d]&&byDay[d].hol) s+=`<rect x="${L+(d-1)*bw}" y="${T0}" width="${bw}" height="${ph}" fill="${C.tint}"/>`;
  for(let v=0;v<=mx;v+=mx/4){const y=T0+ph-v/mx*ph; s+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-width="${v?0.7:1.2}"/>`+tx(L-6,y+4,nf(v),{a:"end"})}
  let pk=null;
  for(let d=1;d<=days;d++){const r=byDay[d], x=L+(d-1)*bw+bw*0.17, w=bw*0.66;
    if(r){const he=r.el/mx*ph, hx=r.ex/mx*ph;
      s+=`<rect x="${x}" y="${T0+ph-he}" width="${w}" height="${he}" fill="${C.navy}"/>`;
      if(hx) s+=`<rect x="${x}" y="${T0+ph-he-hx}" width="${w}" height="${hx}" fill="${C.red}"/>`;
      if(r.reh) s+=`<rect x="${x}" y="${T0+ph+3}" width="${w}" height="4" fill="${C.bronze}"/>`;
      if(!pk||r.total>pk.total) pk={d,total:r.total,x:x+w/2,y:T0+ph-r.total/mx*ph};}
    if(d%2===1||d===days) s+=tx(x+w/2,H-12,d,{a:"middle",s:10.5});}
  if(avgW){const ya=T0+ph-avgW/mx*ph; s+=`<line x1="${L}" x2="${W-R}" y1="${ya}" y2="${ya}" stroke="${C.bronze}" stroke-width="1.4" stroke-dasharray="5 4"/>`+tx(W-R,ya-6,"เฉลี่ยวันทำงาน "+nf(avgW),{a:"end",f:C.bronze})}
  if(pk) s+=tx(pk.x,pk.y-6,nf(pk.total),{a:"middle",b:1,f:C.ink});
  return s+tx(L,12,"คน")+tx(W-R,H-1,"วันที่ในเดือน",{a:"end",s:10.5})+`</svg>`;
}
function chSplit(el,ex){
  const tot=el+ex, W=320,H=200,cx=100,cy=100,r=72,sw=30, v=[el,ex], cols=[C.navy,C.red], lab=["เรือไฟฟ้า","เรือด่วนเจ้าพระยา"];
  if(!tot) return "";
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="สัดส่วนผู้โดยสารตามประเภทเรือ">`, a0=-Math.PI/2;
  v.forEach((x,i)=>{ if(!x) return;
    if(x===tot) s+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cols[i]}" stroke-width="${sw}"/>`;
    else {const a1=a0+x/tot*2*Math.PI, lg=(a1-a0)>Math.PI?1:0;
      s+=`<path d="M${cx+r*Math.cos(a0)} ${cy+r*Math.sin(a0)} A${r} ${r} 0 ${lg} 1 ${cx+r*Math.cos(a1)} ${cy+r*Math.sin(a1)}" fill="none" stroke="${cols[i]}" stroke-width="${sw}"/>`; a0=a1;}});
  s+=tx(cx,cy-2,nf(tot),{a:"middle",s:20,b:1,f:C.ink})+tx(cx,cy+16,"คน",{a:"middle"});
  v.forEach((x,i)=>{const y=70+i*52; s+=`<rect x="200" y="${y-10}" width="11" height="11" rx="2" fill="${cols[i]}"/>`+tx(218,y,lab[i],{s:12,f:C.ink})+tx(218,y+18,`${nf(x)} · ${(x/tot*100).toFixed(1)}%`,{s:12})});
  return s+`</svg>`;
}
function chPeak(g){ // g: [[ชื่อกลุ่ม, เช้า, เย็น], ...]
  const W=320,H=200,L=10,T0=24,B=40,ph=H-T0-B, mx=Math.max(50,Math.ceil(Math.max(...g.flatMap(r=>[r[1],r[2]]))/50)*50);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="ค่าเฉลี่ยผู้โดยสารช่วงเร่งด่วน"><line x1="${L}" x2="${W-L}" y1="${T0+ph}" y2="${T0+ph}" stroke="${C.line}" stroke-width="1.2"/>`;
  g.forEach((r,i)=>{const gx=30+i*150;
    [[r[1],C.navy,"เช้า"],[r[2],C.bronze,"เย็น"]].forEach((b,j)=>{const h=b[0]/mx*ph, x=gx+j*58, y=T0+ph-h;
      s+=`<rect x="${x}" y="${y}" width="48" height="${h}" fill="${b[1]}" rx="2"/>`+tx(x+24,y-6,nf(b[0]),{a:"middle",s:12,b:1,f:C.ink})+tx(x+24,T0+ph+14,b[2],{a:"middle"})});
    s+=tx(gx+53,H-6,r[0],{a:"middle",s:12,f:C.ink})});
  return s+`</svg>`;
}
function chHG(byDay,days,weekend){
  const W=700,H=170,L=34,R=10,T0=20,B=30,pw=W-L-R,ph=H-T0-B,bw=pw/days, mx=Math.max(10,Math.ceil(Math.max(0,...Object.values(byDay).map(r=>r[1]))/10)*10);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟเรือ HEAVEN GATE">`;
  for(let d=1;d<=days;d++) if(weekend.has(d)) s+=`<rect x="${L+(d-1)*bw}" y="${T0}" width="${bw}" height="${ph}" fill="${C.tint}"/>`;
  [0,mx/2,mx].forEach(v=>{const y=T0+ph-v/mx*ph; s+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="${C.line}" stroke-width="${v?0.7:1.2}"/>`+tx(L-6,y+4,nf(v),{a:"end"})});
  for(let d=1;d<=days;d++){const x=L+(d-1)*bw+bw*0.2, w=bw*0.6, r=byDay[d];
    if(r){const h=r[1]/mx*ph; s+=`<rect x="${x}" y="${T0+ph-h}" width="${w}" height="${Math.max(h,1.5)}" fill="${C.bronze}"/>`+tx(x+w/2,T0+ph-h-4,r[0]+"ร",{a:"middle",s:9.5})}
    if(d%2===1||d===days) s+=tx(x+w/2,H-10,d,{a:"middle",s:10.5});}
  return s+tx(L,11,"คน (ตัวเลขบนแท่ง = จำนวนรอบ)")+`</svg>`;
}

function render(D,y,m,urls,draft){
  const s=D.stn, mn=`${MONTHS[m-1]} ${y+543}`, days=monthDays(y,m), emp=Object.fromEntries(D.emp.map(e=>[e.id,e.full_name])), prof=Object.fromEntries((D.prof||[]).map(p=>[p.id,p.full_name]));
  const wd=D.pax.filter(r=>r.day_type==="workday"), hd=D.pax.filter(r=>r.day_type==="holiday"), sm=(a,f)=>a.reduce((t,r)=>t+f(r),0);
  const tot=r=>r.electric_pax+r.express_pax, E=a=>sm(a,r=>r.electric_pax), X=a=>sm(a,r=>r.express_pax), MO=a=>sm(a,r=>r.morning_peak), EV=a=>sm(a,r=>r.evening_peak);
  const all=D.pax, max=all.reduce((b,r)=>tot(r)>(b?tot(b):-1)?r:b,null), allTot=sm(all,tot), wdTot=sm(wd,tot), hdTot=sm(hd,tot);
  const dayOf=r=>+r.log_date.slice(8,10), isReh=r=>/ซ้อม/.test(r.note||"");
  const paxRows=all.map(r=>({cls:r.morning_peak+r.evening_peak!==tot(r)?"bad":r.day_type==="holiday"?"we":"",c:[fdate(r.log_date),nf(tot(r)),nf(r.electric_pax),nf(r.express_pax),nf(r.morning_peak),nf(r.evening_peak),(r.day_type==="holiday"?"วันหยุด ":"")+(r.note||"")]}));
  const line=(t,a,cls)=>({cls:cls||"tot",c:[t,nf(sm(a,tot)),nf(E(a)),nf(X(a)),nf(MO(a)),nf(EV(a)),""]});
  const avg=(t,a)=>({cls:"sum",c:[t,nf(ceilAvg(sm(a,tot),a.length)??0),nf(ceilAvg(E(a),a.length)??0),nf(ceilAvg(X(a),a.length)??0),nf(ceilAvg(MO(a),a.length)??0),nf(ceilAvg(EV(a),a.length)??0),`ปัดขึ้น ÷ ${a.length} วัน`]});
  const missing=days-all.length, totalsRaw=all.filter(r=>r.morning_peak+r.evening_peak!==tot(r)).length;
  const hg=all.filter(r=>r.heaven_gate_rounds>0||r.heaven_gate_pax>0), hgR=sm(hg,r=>r.heaven_gate_rounds), hgP=sm(hg,r=>r.heaven_gate_pax);
  const openJobs=D.mnt.filter(j=>j.status!=="done"), incs=D.inc, feeTot=sm(D.fee,f=>+f.amount);
  // ภาพประกอบ: ใช้ภาพจริงที่แนบ; ถ้าไม่มีและเป็นฉบับร่าง แสดงช่องว่างให้รู้ว่าขาด
  let fig=4;
  const imgsOf=(col,id)=>D.atc.filter(x=>x[col]===id&&/^image\//.test(x.mime_type||"")&&urls[x.storage_path]);
  const photoGrid=ents=>{ const out=[];
    ents.forEach(e=>{const im=imgsOf(e.col,e.id);
      if(im.length) im.forEach(x=>out.push(`<figure><img src="${urls[x.storage_path]}" alt=""><figcaption><b>ภาพที่ ${++fig}</b> ${esc(e.label)} ${esc([x.captured_at?fdate(bkd(x.captured_at)):e.date||"",x.place,x.caption].filter(Boolean).join(" · "))}</figcaption></figure>`));
      else if(draft) out.push(`<figure><div class="ph"><b>ภาพที่ ${++fig} ${esc(e.label)}</b><small>${esc(e.date||"")} · ยังไม่มีภาพแนบ</small></div></figure>`);});
    return out.length?`<h3 class="sub">ภาพถ่ายประกอบ</h3><div class="photos">${out.join("")}</div>`:""; };
  // สถานะความครบถ้วน
  const decl=(topic,count)=>{ if(count>0) return ["ok",`${count} รายการ`]; const none=D.dec.filter(d=>d.topic===topic&&d.status==="none").length; return none>=days?["ok","ไม่มี (ยืนยันครบ)"]:["no",`ยืนยัน ${none}/${days} วัน`]; };
  const items=D.rdy.flatMap(c=>c.readiness_check_items.map(i=>({...i,date:c.check_date,phase:c.phase})));
  const accU=incs.filter(i=>i.category!=="other").length, otherN=incs.filter(i=>i.category==="other").length;
  const mr=l=>D.lnk.filter(x=>x.fee_id===l.id).map(x=>D.rem.find(r=>r.id===x.remittance_id)).filter(Boolean);
  const cStat=c=>{const j=D.mnt.find(x=>x.id===c.maintenance_job_id); return j&&j.status==="done"?["ok","ปิดเรื่องแล้ว"]:["part","ติดตาม"]};
  const feeOk=D.fee.length&&D.fee.every(f=>mr(f).length>0);
  const latest=i=>D.eqc.filter(x=>x.item_id===i.id).pop();
  const eqPhoto=i=>{const c=latest(i); return c?imgsOf("equipment_check_id",c.id)[0]:null};
  const eqDone=D.eqi.filter(i=>latest(i)&&eqPhoto(i)).length;
  const ac=D.acc[0], files=D.atc.filter(a=>a.report_id===(D.rep&&D.rep.id)||a.acceptance_id===(ac&&ac.id));
  const present={s21:items.length>0,s22:D.sch.length>0,s23:D.svc.length>0,aA:D.shf.length>0,aB:D.att.length>0,aD:!!ac||D.chg.length>0,aE:files.length>0};
  const annexN=[present.aA,present.aB,present.aD,present.aE].filter(Boolean).length;
  const st=(c,t)=>`<span class="st ${c}">${esc(t)}</span>`;
  const compl=[
    ["สถิติผู้โดยสาร",st(missing?"part":"ok",`${all.length}/${days} วัน`)],
    ["เหตุการณ์อื่น ๆ",st("ok",otherN?`${otherN} รายการ`:"ไม่มีรายการ")],
    ["อุบัติเหตุ / เหตุไม่ปลอดภัย",st(...decl("incident",accU))],
    ["ทรัพย์สินพบ/หาย",st(...decl("lost_property",D.lost.length))],
    ["ค่าธรรมเนียม",D.fee.length?st(feeOk?"ok":"part",feeOk?"นำส่งครบ":"ขาดข้อมูลนำส่ง"):st(...decl("fee",0))],
    ["ข้อร้องเรียน",D.cmp.length?(D.cmp.every(c=>cStat(c)[0]==="ok")?st("ok","ปิดเรื่องครบ"):st("part","ยังไม่ปิดเรื่อง")):st(...decl("complaint",0))],
    ["2.1 ความพร้อมท่าเรือ",st(present.s21?"ok":"no",present.s21?"บันทึกแล้ว":"ยังไม่บันทึก")],
    ["2.2 ตารางเดินเรือ",st(present.s22?"ok":"no",present.s22?"บันทึกแล้ว":"ยังไม่บันทึก")],
    ["2.3 คุณภาพบริการ",st(present.s23?"ok":"no",present.s23?"บันทึกแล้ว":"ยังไม่บันทึก")],
    ["ภาคผนวก ก–จ",st(annexN===4?"ok":annexN?"part":"no",annexN===4?"ครบ":annexN?`บันทึก ${annexN}/4`:"ยังไม่บันทึก")],
    ["ผลตรวจอุปกรณ์ + ภาพถ่าย",st(D.eqi.length&&eqDone===D.eqi.length?"ok":eqDone?"part":"no",`${eqDone}/${D.eqi.length} รายการ`)],
    ["การเปลี่ยนแปลงพนักงาน",st("ok",D.chg.length?`${D.chg.length} รายการ`:"ไม่มี")]];
  const inj=sm(incs,i=>i.injured), dead=sm(incs,i=>i.deaths);
  const bullets=[
    allTot?`ผู้โดยสาร ${Math.round(wdTot/allTot*100)}% ใช้บริการในวันทำงาน เรือไฟฟ้าคิดเป็น ${Math.round(E(all)/allTot*100)}% ของยอดรวม`:null,
    allTot?`ช่วงเร่งด่วนเช้ามีผู้โดยสาร ${nf(MO(all))} คน ${MO(all)>=EV(all)?"มากกว่า":"น้อยกว่า"}ช่วงเย็น ${nf(EV(all))} คน`:null,
    `เหตุการณ์ที่บันทึก ${incs.length} รายการ (อุบัติเหตุ/ไม่ปลอดภัย ${accU}) ข้อร้องเรียน ${D.cmp.length} เรื่อง${D.cmp.length?` (อยู่ระหว่างติดตาม ${D.cmp.filter(c=>cStat(c)[0]!=="ok").length})`:""}`,
    D.mnt.length?`งานซ่อมในเดือนนี้ ${D.mnt.length} รายการ ค้างอยู่ ${openJobs.length} รายการ`:`ยังไม่มีงานซ่อมที่บันทึกในระบบ`,
    incs.length?`ผู้บาดเจ็บ ${inj} ราย เสียชีวิต ${dead} ราย จากเหตุการณ์ที่บันทึก`:null].filter(Boolean);
  const docNo=`ST-PNK-${y+543}-${String(m).padStart(2,"0")} · Rev.${((D.rep&&D.rep.revision)||1)-1}`;
  const prepared=fdate(D.rep&&D.rep.approved_at?bkd(D.rep.approved_at):ymd(bkk()));
  const foot=(t)=>"";   // เลขหน้าพิมพ์ที่ท้ายกระดาษโดยเบราว์เซอร์ (@page)
  const secH=(n,t)=>`<div class="sec-h"><span class="n">${esc(n)}</span><h2>${esc(t)}</h2></div>`;
  const sheet=(inner,cls="")=>`<section class="sheet ${cls}">${inner}</section>`;

  // ---------- ปก ----------
  const cover=`<section class="cover">
   <div class="cv-top"><img src="logo-smart.png" alt="บริษัท สมาร์ท เทอร์มินอล คอร์ปอเรชั่น จำกัด"><i class="cv-div"></i><img class="mrta" src="logo-mrta.png" alt="การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย"></div>
   <div class="cv-hero"><img class="cv-photo" src="cover.jpg" alt="">
    <svg class="cv-sw l" viewBox="0 0 400 200" preserveAspectRatio="none"><path d="M0 128 C110 160 250 180 400 190 L400 200 L0 200 Z" fill="#fff"/><path d="M0 114 C110 146 250 166 400 178 L400 190 C250 180 110 160 0 128 Z" fill="#6d2b91"/><path d="M0 100 C110 132 250 152 400 166 L400 178 C250 166 110 146 0 114 Z" fill="#1b2a6b"/></svg>
    <svg class="cv-sw r" viewBox="0 0 400 200" preserveAspectRatio="none"><path d="M400 72 C290 40 150 20 0 10 L0 0 L400 0 Z" fill="#fff"/><path d="M400 86 C290 54 150 34 0 24 L0 10 C150 20 290 40 400 72 Z" fill="#6d2b91"/><path d="M400 100 C290 68 150 48 0 38 L0 24 C150 34 290 54 400 86 Z" fill="#1b2a6b"/></svg>
   </div>
   <div class="cv-main">
    <div class="cv-title"><i class="cv-slash"></i><div><div class="t-sub">รายงานสรุปผลการดำเนินการ</div><h1>${esc(s.name_th)}</h1></div></div>
    <i class="cv-rule"></i>
    ${s.project_name?`<p class="cv-proj">${esc(s.project_name)}</p>`:""}
    <div class="cv-month"><span>ประจำเดือน ${esc(mn)}</span></div>
    <div class="cv-line"><i></i>วันที่ 1 – ${days} ${esc(MONTHS[m-1])} ${y+543}</div>
    <div class="cv-who"><div><span>เสนอ</span><b>การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย (รฟม.)</b></div><div class="red"><span>จัดทำโดย</span><b>บริษัท สมาร์ท เทอร์มินอล คอร์ปอเรชั่น จำกัด</b></div></div>
   </div>
   <div class="cv-info"><div><span>สัญญาเลขที่</span><b>${esc(s.contract_no||"–")}${D.rep&&D.rep.installment_no?` · งวดที่ ${D.rep.installment_no}`:""}</b></div><div><span>เลขที่เอกสาร</span><b>${esc(docNo)}</b></div><div><span>วันที่จัดทำ</span><b>${esc(prepared)}</b></div></div>
   <div class="cover-bar"></div></section>`;

  // ---------- สรุปภาพรวม ----------
  const kpi=(k,v,u,hl)=>`<div class="kpi${hl?" hl":""}"><div class="k">${esc(k)}</div><div class="v">${v}<small>${esc(u)}</small></div></div>`;
  const summary=sheet(secH("00",`สรุปภาพรวม ${mn}`)+
   (D.rep&&D.rep.status!=="approved"?`<p class="warn">รายงานนี้ยังอยู่ในสถานะ "${esc(STATUS[D.rep.status])}" ไม่ใช่ฉบับอนุมัติ</p>`:"")+
   `<div class="kpis">${kpi("ผู้โดยสารรวม (เรือไฟฟ้า + เรือด่วน)",nf(allTot),"คน",1)}${kpi(`เฉลี่ยวันทำงาน (${wd.length} วัน)`,nf(ceilAvg(wdTot,wd.length)??0),"คน/วัน")}${kpi(`เฉลี่ยวันหยุด (${hd.length} วัน)`,nf(ceilAvg(hdTot,hd.length)??0),"คน/วัน")}${kpi(max?`วันสูงสุด · ${fdate(max.log_date)}`:"วันสูงสุด",max?nf(tot(max)):"–","คน")}${kpi("เหตุการณ์ / ข้อร้องเรียน",`${incs.length} / ${D.cmp.length}`,"รายการ")}${kpi(`ค่าธรรมเนียมเรือทั่วไป (${sm(D.fee,f=>f.boat_count)} ลำ)`,money(feeTot),"บาท")}</div>`+
   (missing>0?`<p class="warn">บันทึกสถิติแล้ว ${all.length} จาก ${days} วัน (ขาด ${missing} วัน) ยอดรวมจึงยังไม่ครบเดือน</p>`:"")+
   `<h3 class="sub">ประเด็นสำคัญของเดือน</h3><ul class="bul">${bullets.map(b=>`<li>${esc(b)}</li>`).join("")}</ul>`+
   `<h3 class="sub">ความครบถ้วนของข้อมูล</h3><ul class="complete">${compl.map(c=>`<li>${esc(c[0])} ${c[1]}</li>`).join("")}</ul>`);

  // ---------- 1.1 ผู้โดยสาร ----------
  const byDay={}; all.forEach(r=>byDay[dayOf(r)]={total:tot(r),el:r.electric_pax,ex:r.express_pax,hol:r.day_type==="holiday",reh:isReh(r)});
  const wkn=new Set(hd.map(dayOf)), hgDay={}; hg.forEach(r=>hgDay[dayOf(r)]=[r.heaven_gate_rounds,r.heaven_gate_pax]);
  const pk=g=>g.length?[ceilAvg(MO(g),g.length),ceilAvg(EV(g),g.length)]:null;
  const peakG=[["วันทำงาน",...(pk(wd)||[])],["วันหยุด",...(pk(hd)||[])]].filter(r=>r.length===3);
  const s11=sheet(secH("1.1","สถิติผู้โดยสาร")+
   (totalsRaw?`<p class="warn">มี ${totalsRaw} วันที่ยอดเช้า+เย็นไม่เท่ากับยอดตามประเภทเรือ (แถวสีแดง) ต้องตรวจสอบ</p>`:"")+
   `<p>ผู้โดยสารรวม <b>${nf(allTot)}</b> คน แบ่งเป็นวันทำงาน ${nf(wdTot)} คน (${wd.length} วัน) และวันหยุด ${nf(hdTot)} คน (${hd.length} วัน) วันสูงสุดคือ ${max?fdate(max.log_date)+" จำนวน "+nf(tot(max))+" คน":"–"}</p>`+
   `<div class="legend"><span><i style="background:${C.navy}"></i>เรือไฟฟ้า</span><span><i style="background:${C.red}"></i>เรือด่วนเจ้าพระยา</span><span><i style="background:${C.tint};border:1px solid ${C.line}"></i>วันหยุด</span><span><i style="background:${C.bronze}"></i>วันซ้อมเรือพระราชพิธี</span></div>`+
   `<div class="chart">${chDaily(byDay,days,ceilAvg(wdTot,wd.length))}</div><p class="fig"><b>ภาพที่ 1</b> ผู้โดยสารรายวัน แยกตามประเภทเรือ ${esc(mn)}</p>`+
   `<div class="twin"><div><div class="chart">${chSplit(E(all),X(all))}</div><p class="fig"><b>ภาพที่ 2</b> สัดส่วนผู้โดยสารตามประเภทเรือ</p></div><div><div class="chart">${peakG.length?chPeak(peakG):""}</div><p class="fig"><b>ภาพที่ 3</b> ค่าเฉลี่ยผู้โดยสารช่วงเร่งด่วน (คน/วัน)</p></div></div>`+
   `<h3 class="sub">ตารางผู้โดยสารรายวัน</h3>`+
   T(["วันที่","รวม","เรือไฟฟ้า","เรือด่วน","เร่งด่วนเช้า","เร่งด่วนเย็น","หมายเหตุ"],[...paxRows,line("รวมทั้งเดือน",all),line("รวมวันทำงาน ("+wd.length+" วัน)",wd,"sum"),line("รวมวันหยุด ("+hd.length+" วัน)",hd,"sum"),avg("เฉลี่ยวันทำงาน (คน/วัน)",wd),avg("เฉลี่ยวันหยุด (คน/วัน)",hd)],{n:[1,2,3,4,5]})+
   `<p class="fig">ค่าเฉลี่ยทุกค่าปัดเศษขึ้นตามที่กำหนด จึงอาจต่างจากรายงานเดือนก่อนที่ปัดลง · เรือด่วนเจ้าพระยาไม่มียอดในวันหยุด</p>`+
   `<h3 class="sub">เรือ HEAVEN GATE (นับแยก ไม่รวมในยอดเรือหลัก)</h3>`+
   (hg.length?`<div class="chart">${chHG(hgDay,days,wkn)}</div><p class="fig"><b>ภาพที่ 4</b> HEAVEN GATE รายวัน: รวม ${nf(hgR)} รอบ ${nf(hgP)} คน${hgR?` · ผู้โดยสารเฉลี่ย ${(hgP/hgR).toFixed(1)} คน/รอบ`:""}</p>`+
     T(["วันที่","จำนวนรอบ","จำนวนผู้โดยสาร"],[...hg.map(r=>[fdate(r.log_date),r.heaven_gate_rounds,r.heaven_gate_pax]),{cls:"tot",c:["รวม",hgR,hgP]}],{n:[1,2]}):"<p>ไม่มีข้อมูลที่บันทึก</p>")+
   `<h3 class="sub">เรือทั่วไปที่เก็บค่าธรรมเนียม</h3><p>${D.fee.length?`จำนวน ${sm(D.fee,f=>f.boat_count)} ลำ ค่าธรรมเนียมรวม ${money(feeTot)} บาท (รายละเอียดข้อ 1.4)`:"ไม่มีรายการที่บันทึก"}</p>`);

  // ---------- 1.2 เหตุการณ์ ----------
  const cnt=c=>incs.filter(i=>i.category===c).length;
  const tl=incs.map(i=>{const d=bkd(i.occurred_at), tm=timeKnown(i.occurred_at)?hm(i.occurred_at)+" น.":null,
      extra=[i.level&&`ระดับ: ${i.level}`,i.cause&&`สาเหตุ: ${i.cause}`,i.resolution&&`การแก้ไข: ${i.resolution}`,(i.injured||i.deaths)&&`บาดเจ็บ ${i.injured} เสียชีวิต ${i.deaths}`].filter(Boolean).join(" · ");
    return `<li class="${i.category!=="other"?"alert":""}"><div class="when">${esc(fdate(d))} · ${esc(i.location)} <span class="tag">${tm?esc(tm):"เวลา: ไม่ระบุ"}</span> <span class="tag">${esc(KIND[i.category])}</span></div><div class="what">${esc(i.detail)}</div>${extra?`<div class="x">${esc(extra)}</div>`:""}</li>`}).join("");
  const s12=sheet(secH("1.2","เหตุการณ์ที่เกิดขึ้นระหว่างการให้บริการ")+
   `<div class="kpis">${kpi("อุบัติเหตุ",cnt("accident"),"ราย")}${kpi("เหตุการณ์ไม่ปลอดภัย",cnt("unsafe"),"ราย")}${kpi("เหตุการณ์อื่น ๆ",cnt("other"),"รายการ")}</div>`+
   (accU?"":(declStatus(D,"incident",0,y,m)||""))+
   (incs.length?`<h3 class="sub">ไทม์ไลน์เหตุการณ์</h3><ul class="tl">${tl}</ul>`:"")+
   photoGrid(incs.map(i=>({col:"incident_id",id:i.id,label:i.detail.length>38?i.detail.slice(0,38)+"…":i.detail,date:fdate(bkd(i.occurred_at))}))));

  // ---------- 1.3 – 1.5 ----------
  const p2=n=>String(n).padStart(2,"0"), first=`${y}-${p2(m)}-01`;
  const sysRows=Object.entries(SYS).map(([k,v])=>{const a=D.mnt.filter(j=>j.system===k),b=a.filter(j=>j.reported_on<first);return {cls:a.some(j=>j.status!=="done")?"flag":"",c:[v,`${b.length} / ${a.length-b.length}`,a.filter(j=>j.status==="done").length,a.filter(j=>j.status!=="done").length]}});
  const s13=sheet(secH("1.3","เหตุขัดข้องและการซ่อมบำรุง")+
   T(["ระบบ","ค้างยกมา / แจ้งเดือนนี้","เสร็จเดือนนี้","ระหว่างดำเนินการ"],sysRows,{n:[1,2,3]})+
   (D.mnt.length?T(["วันแจ้ง","ระบบ","อุปกรณ์","อาการ","ผู้รับผิดชอบ","สถานะ","ผลแก้ไข","วันเสร็จ"],D.mnt.map(j=>[fdate(j.reported_on),SYS[j.system],j.equipment,j.symptom,j.assignee,{open:"เปิด",in_progress:"กำลังดำเนินการ",done:"เสร็จ"}[j.status],j.result,j.completed_on?fdate(j.completed_on):""])):(declStatus(D,"maintenance",0,y,m)||""))+
   photoGrid(D.mnt.map(j=>({col:"maintenance_job_id",id:j.id,label:(SYS[j.system]||"")+" "+(j.equipment||""),date:fdate(j.reported_on)})))+
   `<div class="sec-h gap"><span class="n">1.4</span><h2>รายได้จากค่าธรรมเนียมและการนำส่ง รฟม.</h2></div>`+
   (D.fee.length?T(["วันที่","ผู้ขอใช้","ขนาดเรือ","ลำ","ค่าธรรมเนียม (บาท)","หลักฐานนำส่ง"],[...D.fee.map(f=>[fdate(f.fee_date),f.requester,f.boat_size,f.boat_count,money(f.amount),mr(f).map(r=>r.reference_no).filter(Boolean).join(", ")]),{cls:"tot",c:["รวม","","",sm(D.fee,f=>f.boat_count),money(feeTot),""]}],{n:[3,4]}):(declStatus(D,"fee",0,y,m)||""))+
   (D.rem.length?`<h3 class="sub">การนำส่งรายได้</h3>`+T(["วันที่นำส่ง","ยอด (บาท)","เลขอ้างอิง","ค่าธรรมเนียมที่ครอบคลุม"],D.rem.map(r=>[r.remitted_on?fdate(r.remitted_on):"",money(r.amount),r.reference_no,D.lnk.filter(l=>l.remittance_id===r.id).map(l=>{const f=D.fee.find(x=>x.id===l.fee_id);return f?fdate(f.fee_date)+" "+money(l.allocated):""}).join(", ")]),{n:[1]}):(D.fee.length?`<p class="fig">การนำส่ง รฟม.: วันที่นำส่ง ................ เลขที่หลักฐาน ................ <span class="muted">(ยังไม่มีบันทึกการนำส่งในระบบ)</span></p>`:""))+
   photoGrid(D.rem.map(r=>({col:"remittance_id",id:r.id,label:"หลักฐานการนำส่ง",date:r.remitted_on?fdate(r.remitted_on):""})))+
   `<div class="sec-h gap"><span class="n">1.5</span><h2>ปัญหาที่พบ ข้อร้องเรียน และทรัพย์สิน</h2></div>`+
   (D.cmp.length?T(["วันรับเรื่อง","สถานที่","รายละเอียด","สาเหตุ","ผลดำเนินการ","สถานะ"],D.cmp.map(c=>{const z=cStat(c);return {raw:1,c:[esc(fdate(c.received_on)),esc(c.location||"–"),esc(c.detail),esc(c.cause||"–"),esc([c.responsible,c.action_result].filter(Boolean).join(": ")||"–"),st(z[0],z[1])]}})):(declStatus(D,"complaint",0,y,m)||""))+
   `<h3 class="sub">ทรัพย์สินพบ/หาย</h3>`+(D.lost.length?T(["วันที่","ประเภท","รายการ","ส่งมอบแก่","วันส่งคืน"],D.lost.map(l=>[fdate(l.event_date),l.kind==="found"?"พบ":"หาย",l.item,l.handed_to,l.returned_on?fdate(l.returned_on):""])):(declStatus(D,"lost_property",0,y,m)||"")));

  // ---------- ส่วนที่ 2 และภาคผนวก (ส่วนที่ไม่มีข้อมูลรวมไว้หน้าเดียว) ----------
  const extra=[], pend=[];
  const add=(has,no,t,body,pendNote,land)=>{ if(has) extra.push(sheet(secH(no,t)+body,land?"land":"")); else pend.push([no+" "+t,pendNote]); };
  add(present.s21,"2.1","ความพร้อมในการให้บริการของท่าเรือ",present.s21?T(["วันที่","รอบ","จุดตรวจ","พร้อมใช้","รายละเอียด","หมายเหตุ"],items.map(i=>({cls:i.ready?"":"bad",c:[fdate(i.date),i.phase==="before_open"?"ก่อนเปิดให้บริการ":"ปิดให้บริการ",PTS[i.point],i.ready?"พร้อมใช้":"ไม่พร้อมใช้",i.detail,i.note]})))+photoGrid(items.map(i=>({col:"readiness_item_id",id:i.id,label:PTS[i.point]||"",date:fdate(i.date)}))):"","ยังไม่มีผลตรวจความพร้อมที่บันทึก");
  add(present.s22,"2.2","ตารางเวลาและเส้นทางเดินเรือของผู้ให้บริการ",present.s22?T(["ผู้ให้บริการ","เส้นทาง","ประเภทวัน","ทิศทาง","เวลา","มีผลตั้งแต่"],D.sch.map(b=>[b.operator,b.route,b.day_type==="weekday"?"จันทร์–ศุกร์":"เสาร์–อาทิตย์/นักขัตฤกษ์",b.direction,b.departure_time.slice(0,5),fdate(b.effective_from)])):"","ยังไม่ได้บันทึกตารางเรือ");
  add(present.s23,"2.3","คุณภาพการให้บริการของเจ้าหน้าที่ท่าเรือ",present.s23?Object.entries(AREAS).map(([k,v])=>{const a=D.svc.filter(x=>x.area===k);return `<h3 class="sub">${v}</h3>`+(a.length?T(["วันที่","รายละเอียด","สถานที่"],a.map(x=>[fdate(x.activity_date),x.detail,x.location]))+photoGrid(a.map(x=>({col:"service_activity_id",id:x.id,label:v,date:fdate(x.activity_date)}))):"<p class='muted'>ยังไม่มีกิจกรรมที่บันทึก</p>")}).join(""):"","ประสานงาน อำนวยความสะดวก แนะนำการเดินทาง ความปลอดภัย ซ่อมบำรุง ความสะอาด: ยังไม่มีกิจกรรมที่บันทึก");
  const dn=[...Array(days)].map((_,i)=>i+1);
  add(present.aA,"ภาคผนวก ก","ตารางเวรตามแผน",present.aA?T(["ชื่อ","ตำแหน่ง",...dn],D.emp.filter(e=>D.shf.some(s=>s.employee_id===e.id)).map(e=>[e.full_name,e.position,...dn.map(d=>{const dd=`${y}-${p2(m)}-${p2(d)}`;return D.shf.filter(s=>s.employee_id===e.id&&s.shift_date===dd).map(s=>s.shift_code).join("+")||""})])):"","ยังไม่ได้บันทึกตารางเวร",true);
  add(present.aB,"ภาคผนวก ข","เวลาเข้า–ออกงานจริง",present.aB?D.emp.filter(e=>D.att.some(a=>a.employee_id===e.id)).map(e=>{const a=D.att.filter(x=>x.employee_id===e.id);return `<h3 class="sub">${esc(e.full_name)} (${esc(e.position)})</h3>`+T(["วันที่เริ่มกะ","เข้า","ออก","ควบกะ","สาย (นาที)","ขาด","ออกก่อน","OT (ชม.)"],a.map(x=>[fdate(x.shift_date),hm(x.clock_in),hm(x.clock_out),x.double_shift?"ใช่":"",x.late_minutes,x.absent?"ขาด":"",x.left_early?"ใช่":"",x.ot_hours]),{n:[4,7]})}).join(""):"","ยังไม่ได้บันทึกเวลาเข้าออก");
  const accH=ac?T(["งวดที่","วันที่ส่ง","ใบแจ้งหนี้","ก่อนภาษี","VAT","รวม","ผลตรวจรับ","ค่าปรับ"],[[ac.installment_no,ac.delivered_on?fdate(ac.delivered_on):"",ac.invoice_no,money(ac.amount_ex_vat),money(ac.vat),money(ac.amount_total),ac.result==="accepted"?"รับงาน":ac.result==="rejected"?"ไม่รับ":"รอตรวจ",money(ac.penalty)]],{n:[3,4,5,7]}):`<p class="warn">ยังไม่มีข้อมูลส่งมอบ/ตรวจรับ</p>`;
  const chgH=D.chg.length?T(["ตำแหน่ง","เปลี่ยนจาก","เป็น","เลขหนังสือ/วันที่","เริ่มงาน","กรรมการตรวจคุณสมบัติ"],D.chg.map(c=>[c.position,emp[c.old_employee_id],emp[c.new_employee_id],`${c.letter_no||""} ${c.letter_date?fdate(c.letter_date):""}`,fdate(c.effective_date),c.committee_verified?"ตรวจแล้ว"+(c.verified_on?" "+fdate(c.verified_on):""):"ยังไม่ตรวจ"])):"<p>ไม่มีการเปลี่ยนแปลงพนักงานในเดือนนี้</p>";
  add(present.aD,"ภาคผนวก ง","ส่งมอบงานและใบแจ้งหนี้",accH+`<h3 class="sub">การเปลี่ยนแปลงพนักงาน</h3>${chgH}<p class="muted">เอกสารส่วนบุคคลของพนักงานเก็บแยกในระบบ ไม่แนบในรายงานนี้</p>`,"ยังไม่มีข้อมูลส่งมอบงาน/ใบแจ้งหนี้ · ไม่มีการเปลี่ยนแปลงพนักงาน");
  add(present.aE,"ภาคผนวก จ","เอกสารต้นฉบับที่ลงนามแล้ว (ไฟล์แนบ)",`<ul>${files.map(f=>`<li>${esc(f.file_name||f.storage_path)} ${esc(f.caption||"")}</li>`).join("")}</ul><p class="muted">เก็บไฟล์ต้นฉบับในระบบ ไม่ได้สร้างลายเซ็นขึ้นใหม่ ใบตรวจรับและบันทึกข้อความต้องแนบไฟล์ที่ลงนามจริงเมื่อส่ง รฟม.</p>`,"ยังไม่มีไฟล์แนบ");

  // ภาคผนวก ค ผลตรวจอุปกรณ์ (การ์ดพร้อมภาพถ่าย)
  const cam='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>';
  const card=i=>{const c=latest(i), im=eqPhoto(i), ok=c&&im&&c.complete&&c.usable&&(i.min_qty==null||c.found_qty>=i.min_qty);
    const stt=!c?["no","ยังไม่ตรวจ"]:!im?["part","ไม่มีภาพ"]:ok?["ok","ปกติ"]:["no","ผิดปกติ"];
    return `<article class="eq"><div class="eq-ph">${im?`<img src="${urls[im.storage_path]}" alt="">`:`${cam}<b>ภาพที่ ค-${i.seq}</b><small>${esc(i.spec||"")}</small>`}</div><div class="eq-b"><div class="eq-h"><span class="eq-n">${i.seq}</span><b>${esc(i.name)}</b></div>
     <div class="eq-f"><span>พบ ${c?`<b>${c.found_qty}</b>`:`<span class="blank"></span>`} / ขั้นต่ำ ${i.min_qty==null?"–":i.min_qty}</span>${st(stt[0],stt[1])}</div>
     <div class="eq-f"><span><span class="box${c&&c.usable?" on":""}"></span>ใช้งานได้ &nbsp;<span class="box${c&&!c.usable?" on":""}"></span>ชำรุด</span>${c&&!c.complete?`<span class="warnt">ไม่ครบ</span>`:""}</div>
     <div class="eq-f"><span>ถ่ายเมื่อ ${c?esc(fdate(c.check_date)):`<span class="blank w"></span>`}</span><span>ผู้ตรวจ ${c&&prof[c.inspector_id]?esc(prof[c.inspector_id]):`<span class="blank w"></span>`}</span></div>${c&&c.fix_note?`<div class="eq-f"><span>ข้อแก้ไข: ${esc(c.fix_note)}</span></div>`:""}</div></article>`};
  const eqH=D.eqi.length?`<div class="eq-rule">${cam}<div><b>ทุกรายการต้องมีภาพถ่ายขณะตรวจอย่างน้อย 1 ภาพ</b> ถ่ายให้นับจำนวนได้และเห็นสภาพอุปกรณ์ชัดเจน ภาพต้องมีวันเวลากำกับ รายการที่ไม่มีภาพถือว่ายังไม่ได้ตรวจ</div></div><div class="eqgrid">${D.eqi.map(card).join("")}</div>`:`<p class="warn">ยังไม่ได้ตั้งทะเบียนอุปกรณ์</p>`;
  const sign=`<div class="sign"><div><div class="line"></div>ผู้จัดทำ<br>วันที่ ............</div><div><div class="line"></div>ผู้ตรวจ (ผู้จัดการท่าเรือ)<br>วันที่ ............</div><div><div class="line"></div>ผู้อนุมัติ (ผู้ดูแลระบบ)<br>วันที่ ............</div></div><p class="fig" style="margin-top:14px">พื้นที่ลงนามเว้นว่างให้ลงนามจริง ระบบไม่สร้างลายเซ็น และการอนุมัติในระบบไม่ถือเป็นลายเซ็นกรรมการตรวจรับ</p>`;
  const last=sheet((pend.length?secH("2","คุณภาพและความพร้อมการให้บริการ")+`<p>ส่วนต่อไปนี้ยังไม่มีข้อมูลในระบบ รวมไว้ในหน้าเดียวแทนการพิมพ์หน้าว่างแยกทีละส่วน</p><div class="pending">${pend.map(p=>`<div class="pend"><b>${esc(p[0])}</b><span>${esc(p[1])}</span></div>`).join("")}</div>`:"")+
    `<h3 class="sub">ภาคผนวก ค ผลตรวจอุปกรณ์</h3>`+eqH+sign);
  return cover+summary+s11+s12+s13+extra.join("")+last;
}

async function buildReport({y,m},draft){
  toast("กำลังรวบรวมข้อมูล…");
  const D=await loadAll(y,m), paths=D.atc.filter(a=>/^image\//.test(a.mime_type||"")).map(a=>a.storage_path);
  const urls={}; if(paths.length){const {data}=await sb.storage.from("attachments").createSignedUrls(paths,3600); (data||[]).forEach(d=>{if(d.signedUrl)urls[d.path]=d.signedUrl})}
  let box=$("#print"); if(!box){box=document.createElement("div");box.id="print";document.body.appendChild(box)}
  const ua=navigator.userAgent, named=/Chrome\//.test(ua)&&!/CriOS|EdgiOS|FxiOS/.test(ua);
  box.classList.toggle("nonamed",!named);
  box.innerHTML=render(D,y,m,urls,draft);
  await Promise.all([...box.querySelectorAll("img")].map(i=>(i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r})).then(()=>i.decode?i.decode().catch(()=>{}):0)));
  await document.fonts.ready; return D;
}
async function printReport(draft){try{await buildReport(S.period,draft);window.print()}catch(e){toast("สร้างรายงานไม่สำเร็จ: "+(e.message||e))}}
async function uploadFinalPdf(rep){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="application/pdf";
  inp.onchange=async()=>{const f=inp.files[0]; if(!f) return;
    if(f.type!=="application/pdf") return toast("ต้องเป็นไฟล์ PDF");
    const buf=await f.arrayBuffer(), h=[...new Uint8Array(await crypto.subtle.digest("SHA-256",buf))].map(b=>b.toString(16).padStart(2,"0")).join("");
    const path=`${S.station.id}/${rep.id}/rev${rep.revision}.pdf`;
    const up=await sb.storage.from("exports").upload(path,f,{contentType:"application/pdf",upsert:false});
    if(up.error) return toast(/exists|Duplicate/i.test(up.error.message)?"รุ่นนี้อัปโหลดแล้ว (ไม่เขียนทับ)":"อัปโหลดไม่สำเร็จ: "+up.error.message);
    const {error}=await sb.from("report_exports").insert({report_id:rep.id,station_id:S.station.id,revision:rep.revision,storage_path:path,sha256:h});
    toast(error?dbMsg(error):"บันทึกรุ่น PDF ที่ส่งจริงแล้ว");};
  inp.click();
}
