"use strict";
(()=>{
// เมนู: เหตุขัดข้อง/ซ่อมบำรุง · ค่าธรรมเนียม/นำส่งรายได้ · ตารางเรือ/คุณภาพบริการ · บุคลากร/เวร/เข้าออก
// ใช้ตัวช่วย CRUD กลาง (รายการ + ฟอร์มเพิ่ม/แก้ไข/ลบ) — สิทธิ์จริงบังคับที่ RLS ในฐานข้อมูล ปุ่มในแอปเป็นเพียงการซ่อน/แสดง
const dr=()=>{const {y,m}=S.period,p=n=>String(n).padStart(2,"0");return [`${y}-${p(m)}-01`,`${y}-${p(m)}-${p(new Date(y,m,0).getDate())}`]};
const W_OPS=()=>has("admin","manager","assistant"), W_FIN=()=>has("admin","manager","assistant","finance"), W_HR=()=>has("admin","manager","hr");
const baht=n=>Number(n||0).toLocaleString("th",{minimumFractionDigits:2,maximumFractionDigits:2});
let EMP=[];
const empName=id=>{const e=EMP.find(x=>x.id===id);return e?e.full_name:"–"};

function fieldHtml(f,v){
  const id="f_"+f.k, dis="";
  if(f.t==="sel") return `<label class="l" for="${id}">${f.l}${f.req?" *":""}</label><select class="in" id="${id}">${f.req?"":`<option value="">–</option>`}${Object.entries(f.o).map(([a,b])=>`<option value="${a}" ${String(v)===a?"selected":""}>${esc(b)}</option>`).join("")}</select>`;
  if(f.t==="emp") return `<label class="l" for="${id}">${f.l}${f.req?" *":""}</label><select class="in" id="${id}">${f.req?"":`<option value="">–</option>`}${EMP.map(e=>`<option value="${e.id}" ${v===e.id?"selected":""}>${esc(e.full_name)} (${esc(e.position)})</option>`).join("")}</select>`;
  if(f.t==="bool") return `<label class="l" for="${id}">${f.l}</label><select class="in" id="${id}"><option value="0">ไม่</option><option value="1" ${v?"selected":""}>ใช่</option></select>`;
  if(f.t==="ts") return `<label class="l" for="${id}">${f.l}</label><input class="in" id="${id}" type="datetime-local" value="${v?toLocal(v):""}">`;
  if(f.t==="fees") return `<label class="l">${f.l}</label><div id="${id}">${(f.list||[]).map(x=>`<label style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)"><input type="checkbox" value="${x.id}" data-a="${x.amount}" ${(v||[]).includes(x.id)?"checked":""}> <span>${fdate(x.fee_date)} · ${esc(x.requester||"–")} · ${baht(x.amount)} บาท</span></label>`).join("")||`<p class="note">ไม่มีค่าธรรมเนียมที่ยังไม่นำส่ง</p>`}</div>`;
  const type={date:"date",num:"number",time:"time",text:"text"}[f.t||"text"];
  const val=f.t==="time"&&v?String(v).slice(0,5):(v??"");
  return `<label class="l" for="${id}">${f.l}${f.req?" *":""}</label><input class="in" id="${id}" type="${type}" ${f.t==="num"?`inputmode="decimal" step="any" min="0"`:""} value="${esc(val)}" ${f.ph?`placeholder="${esc(f.ph)}"`:""}>`;
}
function readField(f){
  const el=$("#f_"+f.k); if(f.t==="fees") return [...el.querySelectorAll("input:checked")].map(i=>i.value);
  const v=el.value;
  if(f.t==="bool") return v==="1";
  if(f.t==="num") return v===""?null:Number(v);
  if(f.t==="ts") return v?localIso(v):null;
  return v===""?null:v;
}

// cfg: {table,title,fields,query(q,[a,b]),label(r)->[หัวข้อ,รอง,ขวา,สี],canW,check(o,row)->ข้อความผิดพลาด,def(),noMonth,after(saved,o,row)}
async function crud(host,cfg,back){
  const w=cfg.canW();
  host.innerHTML=`<div class="card">กำลังโหลด…</div>`;
  const [a,b]=dr();
  let q=sb.from(cfg.table).select("*").eq("station_id",S.station.id);
  q=cfg.query?cfg.query(q,[a,b]):q;
  const {data,error}=await q;
  if(error) return host.innerHTML=`<div class="card err">${esc(dbMsg(error))}</div>`;
  const list=()=>{
    host.innerHTML=`${w?`<button class="btn" id="cnew">＋ ${esc(cfg.add||"เพิ่มรายการ")}</button>`:""}
     <h2>${esc(cfg.title)}${cfg.noMonth?"":" (เดือนนี้)"} · ${data.length}</h2>
     ${data.map((r,i)=>{const [t,s,e,c]=cfg.label(r);return `<button class="dayrow" data-i="${i}"><span><b>${esc(t)}</b><small>${esc(s||"")}</small></span><span class="dtot" ${c?`style="color:${c}"`:""}>${esc(e||"")} ›</span></button>`}).join("")||`<p class="note">ยังไม่มีรายการ</p>`}`;
    if($("#cnew")) $("#cnew").onclick=()=>form(null);
    host.querySelectorAll("[data-i]").forEach(x=>x.onclick=()=>form(data[+x.dataset.i]));
  };
  const form=async row=>{
    const ro=!w, vals=row||(cfg.def?cfg.def():{});
    if(cfg.prep) await cfg.prep(row,vals);
    host.innerHTML=`<button class="btn alt" id="cbk" style="margin:0 0 12px">‹ กลับรายการ</button><div class="card">
     ${cfg.fields.map(f=>fieldHtml(f,vals[f.k])).join("")}<div class="err" id="cerr"></div>
     ${ro?`<p class="note">ดูอย่างเดียว (ไม่มีสิทธิ์แก้ไข)</p>`:`<button class="btn" id="csv">${row?"บันทึกการแก้ไข":"บันทึก"}</button>${row?`<button class="btn alt" id="cdel" style="color:#c0392b">ลบรายการนี้</button>`:""}`}</div>`;
    if(ro) host.querySelectorAll("input,select").forEach(x=>x.disabled=true);
    $("#cbk").onclick=list;
    if(ro) return;
    $("#csv").onclick=async()=>{
      const o={station_id:S.station.id}, e=$("#cerr"); e.textContent="";
      for(const f of cfg.fields){ if(f.t==="fees") continue; o[f.k]=readField(f); if(f.req&&(o[f.k]===null||o[f.k]==="")) return e.textContent=`กรอก "${f.l}"`; }
      const extra={}; for(const f of cfg.fields) if(f.t==="fees") extra[f.k]=readField(f);
      const msg=cfg.check&&cfg.check(o,row,extra); if(msg) return e.textContent=msg;
      $("#csv").disabled=true;
      const r=row?await sb.from(cfg.table).update(o).eq("id",row.id).select().single():await sb.from(cfg.table).insert(o).select().single();
      if(r.error){$("#csv").disabled=false;return toast(dbMsg(r.error))}
      if(cfg.after){const m=await cfg.after(r.data,o,row,extra); if(m){$("#csv").disabled=false;return toast(m)}}
      toast("บันทึกแล้ว"); cfg.reload();
    };
    if($("#cdel")) $("#cdel").onclick=async()=>{
      if(!confirm("ลบรายการนี้? (การลบถูกบันทึกในประวัติการแก้ไข)")) return;
      const {error}=await sb.from(cfg.table).delete().eq("id",row.id);
      error?toast(dbMsg(error)):(toast("ลบแล้ว"),cfg.reload());
    };
  };
  list();
}

// หน้าเมนูที่มีหลายแท็บย่อย
function page(title,tabs){
  $("#main").innerHTML=`<button class="btn alt" id="bk" style="margin-top:44px">‹ เมนู</button>
   ${tabs.length>1?`<div style="display:flex;gap:6px;margin:12px 0;overflow-x:auto">${tabs.map(([n],i)=>`<button class="pill" data-t="${i}" style="flex:none;min-height:40px;padding:0 16px;border-radius:99px;background:var(--tint);color:var(--navy);font-weight:600">${esc(n)}</button>`).join("")}</div>`:""}<div id="sub" style="margin-top:12px"></div>`;
  $("#bk").onclick=()=>go("menu");
  const open=i=>{
    $("#main").querySelectorAll(".pill").forEach((p,k)=>{p.style.background=k===i?"var(--navy)":"var(--tint)";p.style.color=k===i?"#fff":"var(--navy)"});
    const cfg=tabs[i][1]; cfg.reload=()=>open(i);
    (async()=>{ if(cfg.needEmp){const r=await sb.from("employees").select("id,full_name,position,active").eq("station_id",S.station.id).order("full_name");EMP=r.data||[]}
      if(cfg.needFees) await cfg.needFees(); crud($("#sub"),cfg); })();
  };
  $("#main").querySelectorAll(".pill").forEach(p=>p.onclick=()=>open(+p.dataset.t));
  open(0);
}

// ---------- 1.3 เหตุขัดข้องและการซ่อมบำรุง ----------
const SYS={pontoon_fender:"โป๊ะ/กันกระแทก",civil:"งานโยธา",lighting_outlets:"ไฟฟ้า/แสงสว่าง/เต้ารับ",fire_detection:"ระบบตรวจจับเพลิง",fire_protection:"ระบบดับเพลิง",communication:"ระบบสื่อสาร",water:"ระบบน้ำ"};
const MST={open:"เปิดงาน",in_progress:"กำลังดำเนินการ",done:"เสร็จสิ้น"};
V.mnt=()=>page("ซ่อมบำรุง",[["งานซ่อม",{
  table:"maintenance_jobs",title:"งานซ่อม (เดือนนี้ + งานค้าง)",add:"แจ้งเหตุขัดข้อง/เปิดงานซ่อม",canW:W_OPS,
  query:(q,[a,b])=>q.or(`status.neq.done,and(reported_on.gte.${a},reported_on.lte.${b})`).order("reported_on",{ascending:false}),
  def:()=>({reported_on:ymd(bkk()),status:"open"}),
  fields:[{k:"system",l:"ระบบ",t:"sel",o:SYS,req:1},{k:"equipment",l:"อุปกรณ์/จุดที่ชำรุด"},{k:"reported_on",l:"วันที่แจ้ง",t:"date",req:1},{k:"symptom",l:"อาการ/เหตุขัดข้อง",req:1},{k:"assignee",l:"ผู้รับผิดชอบ/ผู้ซ่อม"},{k:"status",l:"สถานะ",t:"sel",o:MST,req:1},{k:"result",l:"ผลการแก้ไข"},{k:"completed_on",l:"วันที่แล้วเสร็จ",t:"date"}],
  check:o=>{ if(o.reported_on>ymd(bkk())) return "วันที่แจ้งห้ามเป็นอนาคต";
    if(o.completed_on&&o.completed_on<o.reported_on) return "วันที่แล้วเสร็จต้องไม่ก่อนวันที่แจ้ง";
    if(o.status==="done"&&(!o.completed_on||!o.result)) return "สถานะ \"เสร็จสิ้น\" ต้องกรอกผลการแก้ไขและวันที่แล้วเสร็จ"; },
  label:r=>[SYS[r.system]+(r.equipment?" · "+r.equipment:""),fdate(r.reported_on)+" · "+r.symptom,MST[r.status],r.status==="done"?"#2f7d5b":"#c0392b"]
}]]);

// ---------- 1.4 ค่าธรรมเนียมและการนำส่ง ----------
let FEES=[];
V.fee=()=>page("ค่าธรรมเนียม",[
 ["ค่าธรรมเนียม",{
  table:"pier_fees",title:"ค่าธรรมเนียมที่เก็บ",add:"บันทึกค่าธรรมเนียม",canW:W_FIN,
  query:(q,[a,b])=>q.gte("fee_date",a).lte("fee_date",b).order("fee_date",{ascending:false}),
  def:()=>({fee_date:ymd(bkk()),boat_count:1}),
  fields:[{k:"fee_date",l:"วันที่",t:"date",req:1},{k:"requester",l:"ผู้ขอใช้/ผู้ชำระ"},{k:"boat_size",l:"ขนาดเรือ",req:1,ph:"เช่น ไม่เกิน 10 เมตร"},{k:"boat_count",l:"จำนวนเรือ",t:"num",req:1},{k:"amount",l:"จำนวนเงิน (บาท)",t:"num",req:1}],
  check:o=>{ if(o.fee_date>ymd(bkk())) return "วันที่ห้ามเป็นอนาคต"; if(!Number.isInteger(o.boat_count)||o.boat_count<1) return "จำนวนเรือต้องเป็นเลขจำนวนเต็ม ≥ 1"; if(o.amount<0) return "จำนวนเงินต้องไม่ติดลบ"; },
  label:r=>[(r.requester||"–")+" · "+r.boat_size,fdate(r.fee_date)+" · "+r.boat_count+" ลำ",baht(r.amount)+" บาท"]
 }],
 ["นำส่งรายได้",{
  table:"revenue_remittances",title:"การนำส่งรายได้",add:"บันทึกการนำส่ง",canW:W_FIN,noMonth:true,
  query:q=>q.order("remitted_on",{ascending:false,nullsFirst:true}).limit(60),
  def:()=>({remitted_on:ymd(bkk())}),
  needFees:async()=>{const [f,l]=await Promise.all([sb.from("pier_fees").select("id,fee_date,requester,amount").eq("station_id",S.station.id).order("fee_date",{ascending:false}).limit(120),sb.from("remittance_fee_links").select("remittance_id,fee_id").eq("station_id",S.station.id)]);
    FEES=f.data||[]; FEES.forEach(x=>x.rem=(l.data||[]).filter(k=>k.fee_id===x.id).map(k=>k.remittance_id)); FEES.links=l.data||[]; },
  prep:async(row,vals)=>{ const el=FEES; const fl=el.filter(x=>!x.rem.length||(row&&x.rem.includes(row.id))); vals._fees=(row?el.filter(x=>x.rem.includes(row.id)).map(x=>x.id):[]);
    cfgFeeField.list=fl; vals.fees=vals._fees; },
  fields:[{k:"remitted_on",l:"วันที่นำส่ง",t:"date"},{k:"amount",l:"ยอดนำส่ง (บาท)",t:"num",req:1},{k:"reference_no",l:"เลขที่อ้างอิง"},(window.cfgFeeField={k:"fees",l:"ค่าธรรมเนียมที่นำส่งในครั้งนี้ (ยอดรวมต้องเท่ากับยอดนำส่ง)",t:"fees",list:[]})],
  check:(o,row,x)=>{ if(o.remitted_on&&o.remitted_on>ymd(bkk())) return "วันที่นำส่งห้ามเป็นอนาคต";
    const sum=x.fees.reduce((s,id)=>s+Number((FEES.find(f=>f.id===id)||{}).amount||0),0);
    if(x.fees.length&&Math.abs(sum-o.amount)>0.005) return `ยอดค่าธรรมเนียมที่เลือกรวม ${baht(sum)} ไม่เท่ากับยอดนำส่ง ${baht(o.amount)} (ถ้านำส่งไม่ตรงกัน ให้แยกบันทึกเป็นหลายครั้ง)`; },
  after:async(saved,o,row,x)=>{
    if(row){const d=await sb.from("remittance_fee_links").delete().eq("remittance_id",saved.id); if(d.error) return dbMsg(d.error)}
    if(x.fees.length){const ins=await sb.from("remittance_fee_links").insert(x.fees.map(id=>({remittance_id:saved.id,fee_id:id,station_id:S.station.id,allocated:Number((FEES.find(f=>f.id===id)||{}).amount)})));
      if(ins.error) return "บันทึกยอดนำส่งแล้ว แต่ผูกค่าธรรมเนียมไม่สำเร็จ: "+dbMsg(ins.error)+" (เปิดรายการนี้เพื่อลองใหม่)"; } },
  label:r=>[r.remitted_on?fdate(r.remitted_on):"ยังไม่นำส่ง",r.reference_no?"อ้างอิง "+r.reference_no:"",baht(r.amount)+" บาท"]
 }]]);

// ---------- 2.2 ตารางเรือ / 2.3 คุณภาพการให้บริการ ----------
const AREA={coordination:"ประสานงาน",boarding_assist:"ช่วยเหลือการขึ้น-ลงเรือ",travel_info:"ให้ข้อมูลการเดินทาง",safety:"ความปลอดภัย",maintenance:"ซ่อมบำรุง",cleaning:"ทำความสะอาด"};
const DT={weekday:"วันทำงาน",weekend_holiday:"วันหยุด"};
V.sch=()=>page("ตารางเรือ",[
 ["กิจกรรมบริการ",{
  table:"service_activities",title:"กิจกรรมการให้บริการ",add:"บันทึกกิจกรรม",canW:()=>has("admin","manager","assistant","cleaner"),
  query:(q,[a,b])=>q.gte("activity_date",a).lte("activity_date",b).order("activity_date",{ascending:false}),
  def:()=>({activity_date:ymd(bkk())}),
  fields:[{k:"activity_date",l:"วันที่",t:"date",req:1},{k:"area",l:"ประเภทกิจกรรม",t:"sel",o:AREA,req:1},{k:"detail",l:"รายละเอียด",req:1},{k:"location",l:"สถานที่"}],
  check:o=>o.activity_date>ymd(bkk())?"วันที่ห้ามเป็นอนาคต":"",
  label:r=>[AREA[r.area],fdate(r.activity_date)+" · "+r.detail,r.location||""]
 }],
 ["ตารางเรือ",{
  table:"boat_schedules",title:"ตารางเดินเรือที่ใช้อยู่",add:"เพิ่มรอบเรือ",canW:W_OPS,noMonth:true,
  query:q=>q.order("operator").order("departure_time").limit(300),
  def:()=>({effective_from:ymd(bkk()),day_type:"weekday"}),
  fields:[{k:"operator",l:"ผู้ให้บริการ",req:1},{k:"route",l:"เส้นทาง",req:1},{k:"day_type",l:"ประเภทวัน",t:"sel",o:DT,req:1},{k:"direction",l:"ทิศทาง",ph:"เช่น ขาเข้า/ขาออก"},{k:"departure_time",l:"เวลาออก",t:"time",req:1},{k:"effective_from",l:"มีผลตั้งแต่",t:"date",req:1},{k:"effective_to",l:"สิ้นสุด (ถ้ามี)",t:"date"}],
  check:o=>o.effective_to&&o.effective_to<o.effective_from?"วันสิ้นสุดต้องไม่ก่อนวันเริ่มมีผล":"",
  label:r=>[r.operator+" · "+r.route,DT[r.day_type]+(r.direction?" · "+r.direction:"")+" · ตั้งแต่ "+fdate(r.effective_from)+(r.effective_to?" ถึง "+fdate(r.effective_to):""),String(r.departure_time).slice(0,5)+" น."]
 }]]);

// ---------- บุคลากร / เวร / เข้าออก ----------
const SH={M:"เช้า (M)",A:"บ่าย (A)",M12:"เช้า 12 ชม. (M12)",N12:"ดึก 12 ชม. (N12)",S1:"S1",FULL:"เต็มวัน",OFF:"หยุด"};
V.ppl=()=>page("บุคลากร",[
 ["พนักงาน",{
  table:"employees",title:"รายชื่อพนักงาน",add:"เพิ่มพนักงาน",canW:W_HR,noMonth:true,
  query:q=>q.order("active",{ascending:false}).order("full_name"),
  def:()=>({active:true}),
  fields:[{k:"full_name",l:"ชื่อ-สกุล",req:1},{k:"position",l:"ตำแหน่ง",req:1},{k:"phone",l:"โทรศัพท์"},{k:"start_date",l:"วันเริ่มงาน",t:"date"},{k:"end_date",l:"วันสิ้นสุด",t:"date"},{k:"active",l:"ปฏิบัติงานอยู่",t:"bool"}],
  check:o=>o.end_date&&o.start_date&&o.end_date<o.start_date?"วันสิ้นสุดต้องไม่ก่อนวันเริ่มงาน":"",
  label:r=>[r.full_name,r.position,r.active?"ปฏิบัติงาน":"ไม่ได้ปฏิบัติงาน",r.active?"#2f7d5b":"#62627a"]
 }],
 ["เวรตามแผน",{
  table:"shift_assignments",title:"ตารางเวรตามแผน",add:"เพิ่มเวร",canW:W_HR,needEmp:1,
  query:(q,[a,b])=>q.gte("shift_date",a).lte("shift_date",b).order("shift_date",{ascending:false}),
  def:()=>({shift_date:ymd(bkk()),shift_code:"M"}),
  fields:[{k:"employee_id",l:"พนักงาน",t:"emp",req:1},{k:"shift_date",l:"วันที่เริ่มกะ",t:"date",req:1},{k:"shift_code",l:"กะ",t:"sel",o:SH,req:1},{k:"start_time",l:"เวลาเริ่ม",t:"time"},{k:"end_time",l:"เวลาสิ้นสุด (กะข้ามเที่ยงคืนให้ใส่เวลาน้อยกว่าเวลาเริ่ม)",t:"time"},{k:"note",l:"หมายเหตุ"}],
  label:r=>[empName(r.employee_id),fdate(r.shift_date)+(r.start_time?" · "+String(r.start_time).slice(0,5)+"–"+String(r.end_time||"").slice(0,5):""),SH[r.shift_code]]
 }],
 ["เข้า–ออกงานจริง",{
  table:"attendance_logs",title:"เวลาเข้า–ออกงานจริง",add:"บันทึกเข้า–ออกงาน",canW:W_HR,needEmp:1,
  query:(q,[a,b])=>q.gte("shift_date",a).lte("shift_date",b).order("shift_date",{ascending:false}),
  def:()=>({shift_date:ymd(bkk()),late_minutes:0,ot_hours:0}),
  fields:[{k:"employee_id",l:"พนักงาน",t:"emp",req:1},{k:"shift_date",l:"วันที่เริ่มกะ (กะข้ามเที่ยงคืนนับเป็นวันเริ่มกะ)",t:"date",req:1},{k:"clock_in",l:"เวลาเข้า",t:"ts"},{k:"clock_out",l:"เวลาออก",t:"ts"},{k:"double_shift",l:"ควบกะ",t:"bool"},{k:"late_minutes",l:"มาสาย (นาที)",t:"num"},{k:"absent",l:"ขาดงาน",t:"bool"},{k:"left_early",l:"ออกก่อนเวลา",t:"bool"},{k:"ot_hours",l:"ล่วงเวลา (ชม.)",t:"num"}],
  check:o=>{ if(o.clock_in&&o.clock_out&&o.clock_out<=o.clock_in) return "เวลาออกต้องหลังเวลาเข้า"; if(!Number.isInteger(o.late_minutes)||o.late_minutes<0) return "มาสาย (นาที) ต้องเป็นเลขจำนวนเต็ม ≥ 0"; },
  label:r=>[empName(r.employee_id),fdate(r.shift_date)+(r.clock_in?" · เข้า "+toLocal(r.clock_in).slice(11):"")+(r.clock_out?" ออก "+toLocal(r.clock_out).slice(11):""),r.absent?"ขาดงาน":r.double_shift?"ควบกะ":r.late_minutes?"สาย "+r.late_minutes+" น.":"ปกติ",r.absent?"#c0392b":""]
 }],
 ["เปลี่ยนตัวบุคลากร",{
  table:"employee_change_notices",title:"แจ้งเปลี่ยนตัวบุคลากร",add:"บันทึกการเปลี่ยนตัว",canW:W_HR,needEmp:1,noMonth:true,
  query:q=>q.order("effective_date",{ascending:false}).limit(60),
  def:()=>({effective_date:ymd(bkk())}),
  fields:[{k:"position",l:"ตำแหน่ง",req:1},{k:"old_employee_id",l:"ผู้เดิม",t:"emp"},{k:"new_employee_id",l:"ผู้ใหม่",t:"emp",req:1},{k:"letter_no",l:"เลขที่หนังสือ"},{k:"letter_date",l:"ลงวันที่",t:"date"},{k:"effective_date",l:"มีผลตั้งแต่",t:"date",req:1},{k:"committee_verified",l:"คณะกรรมการตรวจรับรองแล้ว",t:"bool"},{k:"verified_on",l:"วันที่ตรวจรับรอง",t:"date"}],
  check:o=>o.committee_verified&&!o.verified_on?"ระบุวันที่ตรวจรับรอง":"",
  label:r=>[r.position+" · "+empName(r.new_employee_id),"มีผล "+fdate(r.effective_date)+(r.letter_no?" · หนังสือ "+r.letter_no:""),r.committee_verified?"รับรองแล้ว":"รอตรวจ",r.committee_verified?"#2f7d5b":"#b7791f"]
 }]]);

// ---------- 1.5 ปัญหา ข้อร้องเรียน และทรัพย์สิน ----------
const JOBO={}, INCO={};
V.cmp=()=>page("ข้อร้องเรียน",[
 ["ข้อร้องเรียน/ปัญหา",{
  table:"complaints",title:"ข้อร้องเรียน/ปัญหาที่พบ",add:"บันทึกข้อร้องเรียน",canW:()=>has("admin","manager","assistant","security","cleaner"),
  query:(q,[a,b])=>q.gte("received_on",a).lte("received_on",b).order("received_on",{ascending:false}),
  needFees:async()=>{const [j,i]=await Promise.all([sb.from("maintenance_jobs").select("id,system,equipment,reported_on,status").eq("station_id",S.station.id).order("reported_on",{ascending:false}).limit(60),sb.from("incidents").select("id,occurred_at,location,detail").eq("station_id",S.station.id).order("occurred_at",{ascending:false}).limit(60)]);
    Object.keys(JOBO).forEach(k=>delete JOBO[k]); Object.keys(INCO).forEach(k=>delete INCO[k]);
    (j.data||[]).forEach(x=>JOBO[x.id]=`${fdate(x.reported_on)} · ${SYS[x.system]}${x.equipment?" · "+x.equipment:""} (${MST[x.status]})`);
    (i.data||[]).forEach(x=>INCO[x.id]=`${fdate(toLocal(x.occurred_at).slice(0,10))} · ${x.location} · ${String(x.detail).slice(0,40)}`); },
  def:()=>({received_on:ymd(bkk())}),
  fields:[{k:"received_on",l:"วันที่รับเรื่อง",t:"date",req:1},{k:"channel",l:"ช่องทางรับเรื่อง",ph:"เช่น โทรศัพท์ / ผู้ใช้บริการแจ้งหน้างาน"},{k:"location",l:"สถานที่"},{k:"detail",l:"รายละเอียดเรื่อง",req:1},{k:"cause",l:"สาเหตุ"},{k:"responsible",l:"ผู้รับผิดชอบ"},{k:"action_result",l:"ผลการดำเนินการ"},
   {k:"incident_id",l:"เหตุการณ์ที่เกี่ยวข้อง",t:"sel",o:INCO},{k:"maintenance_job_id",l:"งานซ่อมที่เกี่ยวข้อง",t:"sel",o:JOBO}],
  check:o=>o.received_on>ymd(bkk())?"วันที่ห้ามเป็นอนาคต":"",
  label:r=>[r.detail.slice(0,60),fdate(r.received_on)+(r.location?" · "+r.location:""),r.action_result?"ดำเนินการแล้ว":"รอดำเนินการ",r.action_result?"#2f7d5b":"#b7791f"]
 }],
 ["ทรัพย์สินตกหล่น",{
  table:"lost_property",title:"ทรัพย์สินที่พบ/สูญหาย",add:"บันทึกทรัพย์สิน",canW:()=>has("admin","manager","assistant","security","cleaner"),
  query:(q,[a,b])=>q.gte("event_date",a).lte("event_date",b).order("event_date",{ascending:false}),
  def:()=>({event_date:ymd(bkk()),kind:"found"}),
  fields:[{k:"event_date",l:"วันที่",t:"date",req:1},{k:"kind",l:"ประเภท",t:"sel",o:{found:"พบของ (ผู้ใช้บริการทำหาย)",lost:"แจ้งของหาย"},req:1},{k:"item",l:"รายการทรัพย์สิน",req:1},{k:"handed_to",l:"ส่งมอบ/เก็บรักษาโดย"},{k:"returned_on",l:"วันที่ส่งคืนเจ้าของ",t:"date"}],
  check:o=>o.event_date>ymd(bkk())?"วันที่ห้ามเป็นอนาคต":(o.returned_on&&o.returned_on<o.event_date?"วันที่ส่งคืนต้องไม่ก่อนวันที่พบ":""),
  label:r=>[r.item,fdate(r.event_date)+" · "+(r.kind==="found"?"พบของ":"แจ้งของหาย")+(r.handed_to?" · "+r.handed_to:""),r.returned_on?"คืนแล้ว":"ยังไม่คืน",r.returned_on?"#2f7d5b":"#b7791f"]
 }]]);

// ---------- ผลตรวจอุปกรณ์ (ภาคผนวก ค) ----------
V.eqp=async()=>{
  $("#main").innerHTML=`<div class="card" style="margin-top:44px">กำลังโหลด…</div>`;
  const today=ymd(bkk()); await eqpForm(today);
};
async function eqpForm(date){
  const w=has("admin","manager","assistant","security","cleaner");
  const [it,ck]=await Promise.all([sb.from("equipment_items").select("*").eq("station_id",S.station.id).order("seq"),sb.from("equipment_checks").select("*").eq("station_id",S.station.id).eq("check_date",date)]);
  if(it.error||ck.error) return $("#main").innerHTML=`<button class="btn alt" id="bk" style="margin-top:44px">‹ เมนู</button><div class="card err" style="margin-top:12px">${esc(dbMsg(it.error||ck.error))}</div>`,$("#bk").onclick=()=>go("menu");
  const by={}; (ck.data||[]).forEach(c=>by[c.item_id]=c);
  $("#main").innerHTML=`<button class="btn alt" id="bk" style="margin-top:44px">‹ เมนู</button>
   <div class="card" style="margin-top:12px"><label class="l" for="e_d">วันที่ตรวจ</label><input class="in" id="e_d" type="date" max="${ymd(bkk())}" value="${date}">
   <p class="note">${ck.data.length?`มีผลตรวจของวันนี้แล้ว ${ck.data.length}/${it.data.length} รายการ — แก้ไขแล้วกดบันทึกได้`:"ยังไม่มีผลตรวจของวันนี้"} · เปลี่ยนวันที่เพื่อดูย้อนหลัง</p></div>
   ${it.data.map(i=>{const c=by[i.id]||{};return `<div class="card" data-i="${i.id}"><b>${i.seq}. ${esc(i.name)}</b>${i.spec?`<div class="note">${esc(i.spec)}</div>`:""}<div class="note">จำนวนขั้นต่ำ ${i.min_qty??"–"}</div>
    <div class="grid2"><div><label class="l">จำนวนที่พบ</label><input class="in q" type="number" inputmode="numeric" min="0" value="${c.found_qty??""}" ${w?"":"disabled"}></div>
    <div><label class="l">ครบตามกำหนด</label><select class="in cp" ${w?"":"disabled"}><option value="1" ${c.complete===false?"":"selected"}>ครบ</option><option value="0" ${c.complete===false?"selected":""}>ไม่ครบ</option></select></div>
    <div><label class="l">ใช้งานได้</label><select class="in us" ${w?"":"disabled"}><option value="1" ${c.usable===false?"":"selected"}>ใช้ได้</option><option value="0" ${c.usable===false?"selected":""}>ใช้ไม่ได้</option></select></div></div>
    <label class="l">แนวทางแก้ไข (ต้องกรอกถ้าไม่ครบหรือใช้ไม่ได้)</label><input class="in fx" value="${esc(c.fix_note||"")}" ${w?"":"disabled"}></div>`}).join("")||`<div class="card">ยังไม่มีรายการอุปกรณ์</div>`}
   <div class="err" id="e_e"></div>${w&&it.data.length?`<button class="btn" id="e_sv">บันทึกผลตรวจ</button>`:`<p class="note">ดูอย่างเดียว</p>`}`;
  $("#bk").onclick=()=>go("menu"); $("#e_d").onchange=()=>{if($("#e_d").value) eqpForm($("#e_d").value)};
  // ตั้งค่า "ครบ" อัตโนมัติจากจำนวนที่พบเทียบขั้นต่ำ (ผู้ตรวจแก้ได้)
  $("#main").querySelectorAll("[data-i]").forEach(c=>{const it0=it.data.find(x=>x.id===c.dataset.i); c.querySelector(".q").oninput=e=>{ if(it0.min_qty!=null&&e.target.value!=="") c.querySelector(".cp").value=Number(e.target.value)>=it0.min_qty?"1":"0"; }});
  if(!w||!it.data.length) return;
  $("#e_sv").onclick=async()=>{
    const e=$("#e_e"); e.textContent=""; const d=$("#e_d").value; if(!d) return e.textContent="เลือกวันที่"; if(d>ymd(bkk())) return e.textContent="วันที่ห้ามเป็นอนาคต";
    const {data:{user}}=await sb.auth.getUser(); const rows=[];
    for(const c of $("#main").querySelectorAll("[data-i]")){
      const q=c.querySelector(".q").value; const nm=c.querySelector("b").textContent;
      if(q==="") continue;                                     // ข้ามรายการที่ยังไม่ได้ตรวจ
      const n=Number(q); if(!Number.isInteger(n)||n<0) return e.textContent=`จำนวนที่พบของ "${nm}" ต้องเป็นเลขจำนวนเต็ม ≥ 0`;
      const cp=c.querySelector(".cp").value==="1", us=c.querySelector(".us").value==="1", fx=c.querySelector(".fx").value.trim();
      if(!(cp&&us)&&!fx) return e.textContent=`กรอกแนวทางแก้ไขของ "${nm}"`;
      rows.push({station_id:S.station.id,item_id:c.dataset.i,check_date:d,found_qty:n,complete:cp,usable:us,fix_note:fx||null,inspector_id:user.id});
    }
    if(!rows.length) return e.textContent="กรอกจำนวนที่พบอย่างน้อย 1 รายการ";
    $("#e_sv").disabled=true;
    const {error}=await sb.from("equipment_checks").upsert(rows,{onConflict:"item_id,check_date"});
    $("#e_sv").disabled=false; if(error) return toast(dbMsg(error));
    toast(`บันทึกแล้ว ${rows.length} รายการ`); eqpForm(d);
  };
}

})();
