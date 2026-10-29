"use strict";
// สร้างหน้ารายงานจากข้อมูลจริงในฐานข้อมูล แล้วสั่งพิมพ์ → "บันทึกเป็น PDF" (เบราว์เซอร์ฝังฟอนต์ให้)
// ทุกตัวเลขคำนวณจากรายการรายวัน; ไม่แก้ตัวเลขเงียบ ๆ; ถ้ายังไม่ได้บันทึก จะแสดงว่า "ยังไม่ได้บันทึก" ไม่ใช่ "ไม่มี"
const SYS={lighting_outlets:"ไฟฟ้าแสงสว่างและเต้ารับ",civil:"งานโยธา",fire_detection:"ตรวจจับเพลิงไหม้",fire_protection:"ป้องกันเพลิงไหม้",communication:"สื่อสาร",water:"ประปา",pontoon_fender:"ป้องกันการกระแทกโป๊ะ"};
const PTS={pontoon1:"โป๊ะเทียบเรือที่ 1",pontoon2:"โป๊ะเทียบเรือที่ 2",pontoon3_express:"โป๊ะเทียบเรือที่ 3 เรือด่วน",pontoon4_ev:"โป๊ะเทียบเรือที่ 4 EV",walkway_bridge:"ทางเดินและสะพานปรับระดับ",terminal:"อาคารผู้โดยสาร"};
const AREAS={coordination:"ประสานงาน",boarding_assist:"อำนวยความสะดวกขึ้นลงเรือ",travel_info:"แนะนำการเดินทาง",safety:"ดูแลความปลอดภัย",maintenance:"ดูแลการซ่อมบำรุง",cleaning:"รักษาความสะอาด"};
const KIND={accident:"อุบัติเหตุ",unsafe:"เหตุการณ์ไม่ปลอดภัย",other:"อื่น ๆ"};
const money=v=>v==null?"–":Number(v).toLocaleString("th",{minimumFractionDigits:2,maximumFractionDigits:2});
const hm=ts=>ts?new Date(ts).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Bangkok"}):"–";
const ceilAvg=(a,n)=>n?Math.ceil(a/n):null;
const T=(h,rows,o={})=>`<table><thead><tr>${h.map((x,i)=>`<th class="${o.n&&o.n.includes(i)?"n":""}">${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr class="${r.cls||""}">${(r.c||r).map((x,i)=>`<td class="${o.n&&o.n.includes(i)?"n":""}">${x==null||x===""?"–":(r.raw?x:esc(x))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const monthDays=(y,m)=>new Date(y,m,0).getDate();

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
   q("remittance_fee_links",x=>x)]);
  const bad=R.find(r=>r.error); if(bad) throw bad.error;
  const k=["stn","rep","pax","inc","mnt","fee","rem","cmp","lost","rdy","svc","sch","emp","shf","att","eqi","eqc","acc","chg","dec","atc","lnk"], D={};
  k.forEach((n,i)=>D[n]=R[i].data); D.acc=(D.acc||[]).filter(a=>D.rep&&a.report_id===D.rep.id); return D;
}

function declStatus(D,topic,count,y,m){ // ไม่มีรายการ ≠ ยังไม่บันทึก
  if(count>0) return null; const days=monthDays(y,m), none=D.dec.filter(d=>d.topic===topic&&d.status==="none").length;
  return none>=days?`<p>ในเดือนนี้ไม่มีรายการ (บันทึกว่า "ไม่มีรายการ" ครบ ${days} วัน)</p>`:`<p class="warn">ยังไม่มีรายการ และบันทึกว่า "ไม่มีรายการ" แล้ว ${none} จาก ${days} วัน — ยังบอกไม่ได้ว่าไม่มีเหตุ</p>`;
}
function photosFor(D,urls,col,ids){
  const set=new Set(ids), a=D.atc.filter(x=>set.has(x[col])&&/^image\//.test(x.mime_type||"")&&urls[x.storage_path]);
  return a.length?`<div class="photos">${a.map(x=>`<figure><img src="${urls[x.storage_path]}" alt=""><figcaption>${esc(x.captured_at?fdate(x.captured_at.slice(0,10)):"")} ${esc(x.place||"")} ${esc(x.caption||"")}</figcaption></figure>`).join("")}</div>`:"";
}

function render(D,y,m,urls,draft){
  const s=D.stn, mn=`${MONTHS[m-1]} ${y+543}`, days=monthDays(y,m), emp=Object.fromEntries(D.emp.map(e=>[e.id,e.full_name]));
  const wd=D.pax.filter(r=>r.day_type==="workday"), hd=D.pax.filter(r=>r.day_type==="holiday"), sm=(a,f)=>a.reduce((t,r)=>t+f(r),0);
  const tot=r=>r.electric_pax+r.express_pax, E=a=>sm(a,r=>r.electric_pax), X=a=>sm(a,r=>r.express_pax), MO=a=>sm(a,r=>r.morning_peak), EV=a=>sm(a,r=>r.evening_peak);
  const all=D.pax, max=all.reduce((b,r)=>tot(r)>(b?tot(b):-1)?r:b,null);
  const paxRows=all.map(r=>({cls:r.morning_peak+r.evening_peak!==tot(r)?"bad":"",c:[fdate(r.log_date),tot(r),r.electric_pax,r.express_pax,r.morning_peak,r.evening_peak,(r.day_type==="holiday"?"วันหยุด ":"")+(r.note||"")]}));
  const line=(t,a)=>({cls:"sum",c:[t,sm(a,tot),E(a),X(a),MO(a),EV(a),""]});
  const avg=(t,a)=>({cls:"sum",c:[t,ceilAvg(sm(a,tot),a.length),ceilAvg(E(a),a.length),ceilAvg(X(a),a.length),ceilAvg(MO(a),a.length),ceilAvg(EV(a),a.length),`ปัดขึ้น ÷ ${a.length} วัน`]});
  const missing=days-all.length;
  const totalsRaw=D.pax.filter(r=>r.morning_peak+r.evening_peak!==tot(r)).length;
  const hg=D.pax.filter(r=>r.heaven_gate_rounds>0||r.heaven_gate_pax>0);
  const openJobs=D.mnt.filter(j=>j.status!=="done");
  const secs=[];  // [no,title,html,landscape]
  secs.push(["1.1","สถิติผู้โดยสาร",`
   ${missing>0?`<p class="warn">บันทึกสถิติแล้ว ${all.length} จาก ${days} วัน (ขาด ${missing} วัน) ยอดรวมจึงยังไม่ครบเดือน</p>`:""}
   ${totalsRaw?`<p class="warn">มี ${totalsRaw} วันที่ยอดเช้า+เย็นไม่เท่ากับยอดตามประเภทเรือ (แถวสีแดง) ต้องตรวจสอบ</p>`:""}
   <p>ผู้โดยสารรวม ${num(sm(all,tot))} คน: วันทำงาน ${num(sm(wd,tot))} คน (${wd.length} วัน) วันหยุด ${num(sm(hd,tot))} คน (${hd.length} วัน) วันสูงสุด ${max?fdate(max.log_date)+" "+num(tot(max))+" คน":"–"}</p>
   ${T(["วันที่","รวม (คน)","เรือไฟฟ้า","เรือด่วนเจ้าพระยา","เร่งด่วนเช้า","เร่งด่วนเย็น","หมายเหตุ"],[...paxRows,line("รวมทั้งเดือน",all),line("รวมวันทำงาน",wd),line("รวมวันหยุด",hd),avg("เฉลี่ยวันทำงาน (คน/วัน)",wd),avg("เฉลี่ยวันหยุด (คน/วัน)",hd)],{n:[1,2,3,4,5]})}
   <p class="muted">ค่าเฉลี่ยทุกค่าปัดเลขขึ้นตามที่กำหนด จึงอาจต่างจากรายงานเดือนก่อนที่ปัดลง</p>
   <h3>เรือ HEAVEN GATE (นับแยก ไม่รวมในยอดเรือหลัก)</h3>${hg.length?T(["วันที่","จำนวนรอบ","จำนวนผู้โดยสาร"],[...hg.map(r=>[fdate(r.log_date),r.heaven_gate_rounds,r.heaven_gate_pax]),{cls:"sum",c:["รวม",sm(hg,r=>r.heaven_gate_rounds),sm(hg,r=>r.heaven_gate_pax)]}],{n:[1,2]}):"<p>ไม่มีข้อมูลที่บันทึก</p>"}
   <h3>เรือทั่วไปที่เก็บค่าธรรมเนียม</h3><p>${D.fee.length?`จำนวน ${sm(D.fee,f=>f.boat_count)} ลำ ค่าธรรมเนียมรวม ${money(sm(D.fee,f=>+f.amount))} บาท (รายละเอียดข้อ 1.4)`:"ไม่มีรายการที่บันทึก"}</p>`,true]);
  const incs=D.inc;
  secs.push(["1.2","เหตุการณ์ที่เกิดขึ้นระหว่างการให้บริการ",["accident","unsafe","other"].map(c=>{const a=incs.filter(i=>i.category===c);
   return `<h3>${KIND[c]}</h3>`+(a.length?T(["วันที่","สถานที่","รายละเอียด","ระดับ","สาเหตุ","การแก้ไข","บาดเจ็บ","เสียชีวิต"],a.map(i=>[fdate(i.occurred_at.slice(0,10))+" "+hm(i.occurred_at),i.location,i.detail,i.level,i.cause,i.resolution,i.injured,i.deaths]),{n:[6,7]}):"")+(a.length?"":(declStatus(D,"incident",0,y,m)||""))}).join("")+photosFor(D,urls,"incident_id",incs.map(i=>i.id)),false]);
  secs.push(["1.3","เหตุขัดข้องและการซ่อมบำรุง",
   T(["ระบบ","ค้างยกมา/แจ้งเดือนนี้ (ทั้งหมด)","เสร็จเดือนนี้","อยู่ระหว่างดำเนินการ"],Object.entries(SYS).map(([k,v])=>{const a=D.mnt.filter(j=>j.system===k),b=a.filter(j=>j.reported_on<`${y}-${String(m).padStart(2,"0")}-01`);return [v,`${b.length} / ${a.length-b.length}`,a.filter(j=>j.status==="done").length,a.filter(j=>j.status!=="done").length]}),{n:[2,3]})+
   (D.mnt.length?T(["วันแจ้ง","ระบบ","อุปกรณ์","อาการ","ผู้รับผิดชอบ","สถานะ","ผลแก้ไข","วันเสร็จ"],D.mnt.map(j=>[fdate(j.reported_on),SYS[j.system],j.equipment,j.symptom,j.assignee,{open:"เปิด",in_progress:"กำลังดำเนินการ",done:"เสร็จ"}[j.status],j.result,j.completed_on?fdate(j.completed_on):""])):(declStatus(D,"maintenance",0,y,m)||""))+photosFor(D,urls,"maintenance_job_id",D.mnt.map(j=>j.id)),false]);
  secs.push(["1.4","รายได้จากการเก็บค่าธรรมเนียมและการนำส่ง รฟม.",
   (D.fee.length?T(["วันที่","ผู้ขอใช้","ขนาดเรือ","จำนวน (ลำ)","ค่าธรรมเนียม (บาท)"],[...D.fee.map(f=>[fdate(f.fee_date),f.requester,f.boat_size,f.boat_count,money(f.amount)]),{cls:"sum",c:["รวม","","",sm(D.fee,f=>f.boat_count),money(sm(D.fee,f=>+f.amount))]}],{n:[3,4]}):(declStatus(D,"fee",0,y,m)||""))+
   (D.rem.length?`<h3>การนำส่งรายได้</h3>`+T(["วันที่นำส่ง","ยอด (บาท)","เลขอ้างอิง","ค่าธรรมเนียมที่ครอบคลุม"],D.rem.map(r=>[r.remitted_on?fdate(r.remitted_on):"",money(r.amount),r.reference_no,D.lnk.filter(l=>l.remittance_id===r.id).map(l=>{const f=D.fee.find(x=>x.id===l.fee_id);return f?fdate(f.fee_date)+" "+money(l.allocated):""}).join(", ")]),{n:[1]})+photosFor(D,urls,"remittance_id",D.rem.map(r=>r.id)):""),false]);
  secs.push(["1.5","ปัญหาที่พบ ข้อร้องเรียน และทรัพย์สิน",
   `<h3>ปัญหา/ข้อร้องเรียน</h3>`+(D.cmp.length?T(["วันรับเรื่อง","ช่องทาง","สถานที่","รายละเอียด","สาเหตุ","ผู้รับผิดชอบ","ผลดำเนินการ"],D.cmp.map(c=>[fdate(c.received_on),c.channel,c.location,c.detail,c.cause,c.responsible,c.action_result])):(declStatus(D,"complaint",0,y,m)||""))+
   `<h3>ทรัพย์สินพบ/หาย</h3>`+(D.lost.length?T(["วันที่","ประเภท","รายการ","ส่งมอบแก่","วันส่งคืน"],D.lost.map(l=>[fdate(l.event_date),l.kind==="found"?"พบ":"หาย",l.item,l.handed_to,l.returned_on?fdate(l.returned_on):""])):(declStatus(D,"lost_property",0,y,m)||"")),false]);
  const items=D.rdy.flatMap(c=>c.readiness_check_items.map(i=>({...i,date:c.check_date,phase:c.phase})));
  secs.push(["2.1","ความพร้อมในการให้บริการของท่าเรือ",
   (items.length?T(["วันที่","รอบ","จุดตรวจ","พร้อมใช้","รายละเอียด","หมายเหตุ"],items.map(i=>({cls:i.ready?"":"bad",c:[fdate(i.date),i.phase==="before_open"?"ก่อนเปิดให้บริการ":"ปิดให้บริการ",PTS[i.point],i.ready?"พร้อมใช้":"ไม่พร้อมใช้",i.detail,i.note]}))):`<p class="warn">ยังไม่มีผลตรวจความพร้อมที่บันทึก</p>`)+photosFor(D,urls,"readiness_item_id",items.map(i=>i.id)),false]);
  secs.push(["2.2","ตารางเวลาและเส้นทางเดินเรือของผู้ให้บริการ",D.sch.length?T(["ผู้ให้บริการ","เส้นทาง","ประเภทวัน","ทิศทาง","เวลา","มีผลตั้งแต่"],D.sch.map(b=>[b.operator,b.route,b.day_type==="weekday"?"จันทร์–ศุกร์":"เสาร์–อาทิตย์/นักขัตฤกษ์",b.direction,b.departure_time.slice(0,5),fdate(b.effective_from)])):`<p class="warn">ยังไม่ได้บันทึกตารางเรือ</p>`,false]);
  secs.push(["2.3","คุณภาพการให้บริการของเจ้าหน้าที่ท่าเรือ",Object.entries(AREAS).map(([k,v])=>{const a=D.svc.filter(x=>x.area===k);return `<h3>${v}</h3>`+(a.length?T(["วันที่","รายละเอียด","สถานที่"],a.map(x=>[fdate(x.activity_date),x.detail,x.location]))+photosFor(D,urls,"service_activity_id",a.map(x=>x.id)):"<p class='muted'>ยังไม่มีกิจกรรมที่บันทึก</p>")}).join(""),false]);
  // ภาคผนวก
  const dn=[...Array(days)].map((_,i)=>i+1);
  const shiftMat=D.shf.length?T(["ชื่อ","ตำแหน่ง",...dn],D.emp.filter(e=>D.shf.some(s=>s.employee_id===e.id)).map(e=>[e.full_name,e.position,...dn.map(d=>{const dd=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;return D.shf.filter(s=>s.employee_id===e.id&&s.shift_date===dd).map(s=>s.shift_code).join("+")||""})])):`<p class="warn">ยังไม่ได้บันทึกตารางเวร</p>`;
  const att=D.emp.filter(e=>D.att.some(a=>a.employee_id===e.id)).map(e=>{const a=D.att.filter(x=>x.employee_id===e.id);return `<h3>${esc(e.full_name)} (${esc(e.position)})</h3>`+T(["วันที่เริ่มกะ","เข้า","ออก","ควบกะ","สาย (นาที)","ขาด","ออกก่อน","OT (ชม.)"],a.map(x=>[fdate(x.shift_date),hm(x.clock_in),hm(x.clock_out),x.double_shift?"ใช่":"",x.late_minutes,x.absent?"ขาด":"",x.left_early?"ใช่":"",x.ot_hours]),{n:[4,7]})}).join("")||`<p class="warn">ยังไม่ได้บันทึกเวลาเข้าออก</p>`;
  const eq=D.eqi.length?T(["#","รายการ","คุณลักษณะ","ขั้นต่ำ","จำนวนที่พบ","ครบถ้วน","ใช้งานได้","ผู้ตรวจ/วันที่","ข้อแก้ไข"],D.eqi.map(i=>{const c=D.eqc.filter(x=>x.item_id===i.id).pop();return {cls:c&&(!c.complete||!c.usable||(i.min_qty!=null&&c.found_qty<i.min_qty))?"bad":"",c:[i.seq,i.name,i.spec,i.min_qty,c?c.found_qty:"ยังไม่ตรวจ",c?(c.complete?"ครบ":"ไม่ครบ"):"",c?(c.usable?"ใช้ได้":"ใช้ไม่ได้"):"",c?fdate(c.check_date):"",c&&c.fix_note]}}),{n:[3,4]})+photosFor(D,urls,"equipment_check_id",D.eqc.map(c=>c.id)):`<p class="warn">ยังไม่ได้ตั้งทะเบียนอุปกรณ์</p>`;
  const ac=D.acc[0], accH=ac?T(["งวดที่","วันที่ส่ง","ใบแจ้งหนี้","ก่อนภาษี","VAT","รวม","ผลตรวจรับ","ค่าปรับ"],[[ac.installment_no,ac.delivered_on?fdate(ac.delivered_on):"",ac.invoice_no,money(ac.amount_ex_vat),money(ac.vat),money(ac.amount_total),ac.result==="accepted"?"รับงาน":ac.result==="rejected"?"ไม่รับ":"รอตรวจ",money(ac.penalty)]],{n:[3,4,5,7]}):`<p class="warn">ยังไม่มีข้อมูลส่งมอบ/ตรวจรับ</p>`;
  const chgH=D.chg.length?T(["ตำแหน่ง","เปลี่ยนจาก","เป็น","เลขหนังสือ/วันที่","เริ่มงาน","กรรมการตรวจคุณสมบัติ"],D.chg.map(c=>[c.position,emp[c.old_employee_id],emp[c.new_employee_id],`${c.letter_no||""} ${c.letter_date?fdate(c.letter_date):""}`,fdate(c.effective_date),c.committee_verified?"ตรวจแล้ว"+(c.verified_on?" "+fdate(c.verified_on):""):"ยังไม่ตรวจ"])):"<p>ไม่มีการเปลี่ยนแปลงพนักงานในเดือนนี้</p>";
  const files=D.atc.filter(a=>a.report_id===(D.rep&&D.rep.id)||a.acceptance_id===(ac&&ac.id));
  const app=[["ก","ตารางเวรตามแผน",shiftMat,true],["ข","เวลาเข้า–ออกงานจริง",att,false],["ค","ผลตรวจอุปกรณ์",eq,false],["ง","ส่งมอบงานและใบแจ้งหนี้",accH+`<h3>การเปลี่ยนแปลงพนักงาน</h3>${chgH}<p class="muted">เอกสารส่วนบุคคลของพนักงานเก็บแยกในระบบ ไม่แนบในรายงานนี้</p>`,false],
    ["จ","เอกสารต้นฉบับที่ลงนามแล้ว (ไฟล์แนบ)",files.length?`<ul>${files.map(f=>`<li>${esc(f.file_name||f.storage_path)} ${esc(f.caption||"")}</li>`).join("")}</ul><p class="muted">เก็บไฟล์ต้นฉบับในระบบ ไม่ได้สร้างลายเซ็นขึ้นใหม่ ใบตรวจรับและบันทึกข้อความต้องแนบไฟล์ที่ลงนามจริงเมื่อส่ง รฟม.</p>`:"<p class='warn'>ยังไม่มีไฟล์ต้นฉบับที่ลงนามแนบไว้</p>",false]];
  const sh=(no,t,h,land)=>`<section class="${land?"land":""} pg"><h2>${no} ${esc(t)}</h2>${h}</section>`;
  const ov=`<section class="pg"><h2>สรุปภาพรวม ${esc(mn)}</h2>${T(["รายการ","ค่า"],[["ผู้โดยสารรวม (เรือไฟฟ้า+เรือด่วน)",num(sm(all,tot))+" คน"],["เฉลี่ยวันทำงาน (ปัดขึ้น)",num(ceilAvg(sm(wd,tot),wd.length))+" คน/วัน"],["เฉลี่ยวันหยุด (ปัดขึ้น)",num(ceilAvg(sm(hd,tot),hd.length))+" คน/วัน"],["เหตุการณ์",incs.length],["งานซ่อมค้าง",openJobs.length],["ค่าธรรมเนียมรวม",money(sm(D.fee,f=>+f.amount))+" บาท"],["ความครบถ้วนการบันทึกผู้โดยสาร",`${all.length}/${days} วัน`]])}
   ${D.rep&&D.rep.status!=="approved"?`<p class="warn">รายงานนี้ยังอยู่ในสถานะ "${esc(STATUS[D.rep.status])}" ไม่ใช่ฉบับอนุมัติ</p>`:""}</section>`;
  const toc=`<section class="pg"><h2>สารบัญ</h2><ol class="muted" style="font-size:11pt;color:#14213d">${[["","สรุปภาพรวม"],...secs.map(x=>[x[0],x[1]]),...app.map(x=>["ภาคผนวก "+x[0],x[1]])].map(x=>`<li style="list-style:none">${esc(x[0])} ${esc(x[1])}</li>`).join("")}</ol><p class="muted">เลขหน้าแสดงที่ท้ายกระดาษ</p></section>`;
  const cover=`<section class="cover">${draft?`<div class="draft">ฉบับร่าง</div>`:""}<div class="bar"></div><h1>รายงานสรุปผลการดำเนินการ<br>${esc(s.name_th)}</h1><p>ประจำเดือน ${esc(mn)}</p><p style="font-size:11pt">${esc(s.project_name||"")}<br>สัญญาเลขที่ ${esc(s.contract_no||"")}${D.rep&&D.rep.installment_no?` · งวดที่ ${D.rep.installment_no}`:""}</p><p style="font-size:12pt">จัดทำโดย บริษัท สมาร์ท เทอร์มินอล คอร์ปอเรชั่น จำกัด<br>เสนอ การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย (รฟม.)</p></section>`;
  const sign=`<section><h2>ผู้จัดทำและผู้ตรวจ</h2><div class="sign"><div>ผู้จัดทำ<br><br>ชื่อ........................<br>วันที่.......................</div><div>ผู้ตรวจ (ผู้จัดการท่าเรือ)<br><br>ชื่อ........................<br>วันที่.......................</div><div>ผู้อนุมัติ (ผู้ดูแลระบบ)<br><br>ชื่อ........................<br>วันที่.......................</div></div><p class="muted">พื้นที่ลงนามเว้นว่างให้ลงนามจริง ระบบไม่สร้างลายเซ็น และการอนุมัติในระบบไม่ถือเป็นลายเซ็นกรรมการตรวจรับ</p></section>`;
  return cover+toc+ov+secs.map(x=>sh(...x)).join("")+app.map(x=>sh("ภาคผนวก "+x[0],x[1],x[2],x[3])).join("")+sign;
}

async function buildReport({y,m},draft){
  toast("กำลังรวบรวมข้อมูล…");
  const D=await loadAll(y,m), paths=D.atc.filter(a=>/^image\//.test(a.mime_type||"")).map(a=>a.storage_path);
  const urls={}; if(paths.length){const {data}=await sb.storage.from("attachments").createSignedUrls(paths,3600); (data||[]).forEach(d=>{if(d.signedUrl)urls[d.path]=d.signedUrl})}
  let box=$("#print"); if(!box){box=document.createElement("div");box.id="print";document.body.appendChild(box)}
  box.innerHTML=render(D,y,m,urls,draft);
  await Promise.all([...box.querySelectorAll("img")].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r})));
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
