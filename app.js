"use strict";
const $ = s => document.querySelector(s);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const STATUS = {draft:"ฉบับร่าง",submitted:"ส่งตรวจแล้ว",returned:"ส่งกลับแก้ไข",approved:"อนุมัติแล้ว"};
const ROLE_TH = {admin:"ผู้ดูแลระบบ",manager:"ผู้จัดการท่าเรือ",assistant:"ผู้ช่วยผู้จัดการ",security:"รปภ.",cleaner:"พนักงานทำความสะอาด",hr:"ฝ่ายบุคคล",finance:"การเงิน/บัญชี",rfm_officer:"เจ้าหน้าที่ รฟม.",committee:"คณะกรรมการตรวจรับ"};
const bkk = () => new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Bangkok"}));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fdate = s => { const [y,m,d] = s.split("-"); return `${+d} ${TH[m-1]} ${+y+543}`; };   // แสดงเป็น พ.ศ.
const sb = window.supabase.createClient(CFG.url, CFG.anonKey, {auth:{persistSession:true,autoRefreshToken:true}});
let S = {station:null, roles:[], period:{y:bkk().getFullYear(), m:bkk().getMonth()+1}};
const has = (...r) => r.some(x => S.roles.includes(x));
const canWrite = () => has("admin","manager","assistant");

function toast(m){const t=$("#toast");t.textContent=m;t.style.display="block";clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display="none",3200)}
function showErr(el,m){el.textContent=m;el.style.display="block"}
function dbMsg(e){  // แปลงข้อผิดพลาดฐานข้อมูลเป็นข้อความไทย (ไม่กลืนข้อผิดพลาด)
  if(!e) return "";
  if(e.code==="23505") return "มีรายการของวันนี้อยู่แล้ว ไม่บันทึกซ้ำ";
  if(e.code==="P0001"&&/report_locked/.test(e.message)) return "เดือนนี้ส่งตรวจ/อนุมัติแล้ว ต้องส่งกลับแก้ไขก่อน";
  if(e.code==="42501") return "ไม่มีสิทธิ์ทำรายการนี้";
  if(e.code==="23514") return "ข้อมูลไม่ผ่านเงื่อนไข (เช่น ยอดเช้า+เย็นต้องเท่ากับยอดรวมเรือ)";
  return "บันทึกไม่สำเร็จ: " + e.message;
}

// ---------- auth ----------
const loginEmail = v => (CFG.usernames && CFG.usernames[v.trim().toLowerCase()]) || v.trim();
$("#go").onclick = async () => {
  const x=$("#lerr"), email=loginEmail($("#em").value), pw=$("#pw").value;
  if(!/^\S+@\S+\.\S+$/.test(email)) return showErr(x,"ไม่รู้จักชื่อผู้ใช้นี้ หรืออีเมลไม่ถูกต้อง");
  if(!pw) return showErr(x,"กรอกรหัสผ่าน");
  $("#go").disabled=true; x.style.display="none";
  const {error} = await sb.auth.signInWithPassword({email,password:pw});
  $("#go").disabled=false;
  if(error) return showErr(x,"เข้าสู่ระบบไม่สำเร็จ ตรวจชื่อผู้ใช้และรหัสผ่าน");
  boot();
};
$("#forgot").onclick = async () => {
  const x=$("#lerr"), email=loginEmail($("#em").value);
  if(!/^\S+@\S+\.\S+$/.test(email)||/\.test$/.test(email)) return showErr(x,"รีเซ็ตรหัสผ่านต้องใช้อีเมลจริง บัญชีทดสอบให้ผู้ดูแลระบบเปลี่ยนรหัสให้");
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  showErr(x, error ? "ส่งลิงก์ไม่สำเร็จ" : "ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
};
async function boot(){
  const {data:{session}} = await sb.auth.getSession();
  if(!session) return;
  const {data,error} = await sb.from("station_members").select("role,station_id,stations(name_th)").eq("user_id",session.user.id).eq("active",true);
  if(error) return showErr($("#lerr"),dbMsg(error));
  if(!data.length){ await sb.auth.signOut(); return showErr($("#lerr"),"บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน ติดต่อผู้ดูแลระบบ"); }
  S.station = {id:data[0].station_id, name:data[0].stations.name_th};
  S.roles = data.filter(r=>r.station_id===S.station.id).map(r=>r.role);
  S.email = session.user.email;
  $("#login").style.display="none"; $("#shell").style.display="flex";
  $("#stn").textContent=S.station.name;
  go("home");
}

// ---------- screens ----------
const TABS=[["home","🏠","ภาพรวม"],["menu","▦","เมนู"],["add","＋","บันทึก"],["rep","📄","รายงาน"],["me","👤","ฉัน"]];
const TITLES={home:"ภาพรวม",menu:"เมนูทั้งหมด",add:"บันทึกสถิติผู้โดยสาร",rep:"รายงานประจำเดือน",me:"บัญชีและสิทธิ์",inc:"เหตุการณ์และความปลอดภัย"};
function go(t){
  const tabs = TABS.filter(([k])=> k!=="add" || canWrite());
  $("#nav").innerHTML = tabs.map(([k,i,n])=>`<button class="${k===t?"on":""}" data-t="${k}"><b>${i}</b>${n}</button>`).join("");
  $("#nav").querySelectorAll("button").forEach(b=>b.onclick=()=>go(b.dataset.t));
  $("#ttl").textContent = TITLES[t]||"";
  $("#who").textContent = `${MONTHS[S.period.m-1]} ${S.period.y+543}`;
  $("#main").scrollTop=0; V[t]();
}
const num = v => v==null ? "–" : Number(v).toLocaleString("th");
const V = {
 async home(){
  $("#main").innerHTML = `<div class="card">กำลังโหลด…</div>`;
  const {data,error} = await sb.rpc("report_overview",{p_station:S.station.id,p_year:S.period.y,p_month:S.period.m});
  if(error) return $("#main").innerHTML=`<div class="card err">${esc(dbMsg(error))}</div>`;
  const p = data.passengers || {};
  $("#main").innerHTML = `
   <div class="card" style="background:linear-gradient(160deg,#0a1d47,#1b3a82);color:#fff"><small style="opacity:.75">ผู้โดยสารรวม (เรือไฟฟ้า + เรือด่วน)</small>
    <div style="font-size:30px;font-weight:700">${num(p.total_pax)}</div><small>บันทึกแล้ว ${data.days_recorded} วัน</small></div>
   <div class="grid2">
    <div class="card kpi"><b>${num(p.workday_avg_ceil)}</b><span>เฉลี่ยวันทำงาน (ปัดขึ้น ÷ ${p.workday_count ?? 0} วัน)</span></div>
    <div class="card kpi"><b>${num(p.holiday_avg_ceil)}</b><span>เฉลี่ยวันหยุด (ปัดขึ้น ÷ ${p.holiday_count ?? 0} วัน)</span></div>
    <div class="card kpi"><b>${num(data.incident_count)}</b><span>เหตุการณ์</span></div>
    <div class="card kpi"><b>${num(data.open_maintenance)}</b><span>งานซ่อมค้าง</span></div>
    <div class="card kpi"><b>${num(data.fee_total)}</b><span>ค่าธรรมเนียม (บาท)</span></div>
    <div class="card kpi"><b>${esc(STATUS[data.status]||"ยังไม่มีรายงาน")}</b><span>สถานะรายงาน</span></div></div>
   <p class="note">เรือ HEAVEN GATE นับแยกจากยอดเรือหลัก: ${num(p.heaven_gate_pax)} คน ${num(p.heaven_gate_rounds)} รอบ · ค่าเฉลี่ยปัดขึ้นอาจต่างจากรายงานเล่มก่อน</p>`;
 },
 add(){
  const t = ymd(bkk());
  $("#main").innerHTML = `<div class="card">
   <label class="l" for="fd">วันที่</label><input class="in" id="fd" type="date" max="${t}" value="${t}"><div class="err" id="r1"></div>
   <label class="l" for="ft">ประเภทวัน</label><select class="in" id="ft"><option value="workday">วันทำงาน</option><option value="holiday">วันหยุด</option></select>
   <div class="grid2"><div><label class="l" for="fe">เรือไฟฟ้า (คน)</label><input class="in" id="fe" type="number" inputmode="numeric" min="0"></div>
   <div><label class="l" for="fx">เรือด่วน (คน)</label><input class="in" id="fx" type="number" inputmode="numeric" min="0" value="0"></div>
   <div><label class="l" for="fm">เร่งด่วนเช้า</label><input class="in" id="fm" type="number" inputmode="numeric" min="0"></div>
   <div><label class="l" for="fv">เร่งด่วนเย็น</label><input class="in" id="fv" type="number" inputmode="numeric" min="0"></div>
   <div><label class="l" for="fhr">HEAVEN GATE (รอบ)</label><input class="in" id="fhr" type="number" inputmode="numeric" min="0" value="0"></div>
   <div><label class="l" for="fhp">HEAVEN GATE (คน)</label><input class="in" id="fhp" type="number" inputmode="numeric" min="0" value="0"></div></div>
   <div class="err" id="r2"></div>
   <label class="l" for="fn">หมายเหตุ</label><input class="in" id="fn" placeholder="ถ้ามี">
   <button class="btn" id="sv">บันทึก</button></div>
   <p class="note">วันหยุดนักขัตฤกษ์ต้องเลือก "วันหยุด" เอง (ระบบเดาจากวันเสาร์–อาทิตย์เท่านั้น)</p>`;
  const guess=()=>{const d=new Date($("#fd").value+"T00:00:00").getDay(); $("#ft").value=(d===0||d===6)?"holiday":"workday"};
  $("#fd").onchange=guess; guess();
  $("#sv").onclick=savePassenger;
 },
 async rep(){
  const {y,m}=S.period;
  const {data:r,error}=await sb.from("monthly_reports").select("*").eq("station_id",S.station.id).eq("period_year",y).eq("period_month",m).maybeSingle();
  if(error) return $("#main").innerHTML=`<div class="card err">${esc(dbMsg(error))}</div>`;
  if(!r) return $("#main").innerHTML=`<div class="card"><p>ยังไม่มีรายงานเดือน ${MONTHS[m-1]} ${y+543}</p>
   ${canWrite()?`<button class="btn" id="mk">สร้างรายงานฉบับร่าง</button>`:""}</div>`, canWrite()&&($("#mk").onclick=async()=>{
     const {error:e}=await sb.from("monthly_reports").insert({station_id:S.station.id,period_year:y,period_month:m,status:"draft"});
     e?toast(dbMsg(e)):go("rep")});
  const order=["draft","submitted","approved"], cur=r.status==="returned"?"draft":r.status;
  const acts=[];
  if(has("manager")&&(r.status==="draft"||r.status==="returned")) acts.push(["submitted","ส่งตรวจ"]);
  if(has("admin")&&r.status==="submitted") acts.push(["approved","อนุมัติ"]);
  if(has("admin","manager")&&r.status==="submitted") acts.push(["returned","ส่งกลับแก้ไข"]);
  if(has("admin")&&r.status==="approved") acts.push(["returned","เปิดแก้ไข (ส่งกลับ)"]);
  $("#main").innerHTML=`<div class="card"><div class="steps">${order.map(k=>`<div class="${k===cur?"on":""}">${STATUS[k]}</div>`).join("")}</div>
   <p class="note">สถานะ: ${esc(STATUS[r.status])} · รุ่นที่ ${r.revision}</p>
   ${acts.map(([to,l])=>`<button class="btn ${to==="returned"?"alt":""}" data-to="${to}">${l}</button>`).join("")}
   <button class="btn alt" id="pv">ดูตัวอย่าง/พิมพ์ PDF${r.status==="approved"?"":" (ฉบับร่าง)"}</button>
   ${r.status==="approved"&&has("admin")?`<button class="btn alt" id="up">อัปโหลด PDF ที่ส่งจริง (รุ่น ${r.revision})</button>`:""}</div>
   <p class="note">กดพิมพ์ แล้วเลือก "บันทึกเป็น PDF" (ตารางกว้างใช้กระดาษแนวนอนอัตโนมัติบน Chrome/Edge)</p>
   <p class="note">การอนุมัติในแอปไม่ใช่ลายเซ็นกรรมการ · กำหนดส่ง รฟม. ภายในวันที่ 10 ของเดือนถัดไป</p>`;
  $("#main").querySelectorAll("[data-to]").forEach(b=>b.onclick=async()=>{
    let c=null; if(b.dataset.to==="returned"){ c=prompt("ระบุเหตุผลที่ส่งกลับ"); if(!c||!c.trim()) return; }
    b.disabled=true;
    const {error:e}=await sb.rpc("transition_report",{p_report:r.id,p_to:b.dataset.to,p_comment:c});
    e?(toast(dbMsg(e)),b.disabled=false):(toast("เปลี่ยนสถานะแล้ว"),go("rep"));
  });
  $("#pv").onclick=()=>printReport(r.status!=="approved");
  if($("#up")) $("#up").onclick=()=>uploadFinalPdf(r);
 },
 me(){
  $("#main").innerHTML=`<div class="card" style="margin-top:44px"><b>${esc(S.email)}</b>
   <p class="note">บทบาท: ${S.roles.map(r=>esc(ROLE_TH[r]||r)).join(", ")}</p></div>
   <button class="btn alt" id="out">ออกจากระบบ</button>`;
  $("#out").onclick=async()=>{await sb.auth.signOut();location.reload()};
 }
};
async function savePassenger(){
  const v=id=>$(id).value, n=id=>v(id)===""?NaN:Number(v(id));
  $("#r1").textContent=$("#r2").textContent="";
  const row={station_id:S.station.id,log_date:v("#fd"),day_type:v("#ft"),electric_pax:n("#fe"),express_pax:n("#fx"),
    morning_peak:n("#fm"),evening_peak:n("#fv"),heaven_gate_rounds:n("#fhr"),heaven_gate_pax:n("#fhp"),note:v("#fn").trim()||null};
  if(!row.log_date) return $("#r1").textContent="เลือกวันที่";
  if(row.log_date>ymd(bkk())) return $("#r1").textContent="วันที่ห้ามเป็นอนาคต";
  const f=["electric_pax","express_pax","morning_peak","evening_peak","heaven_gate_rounds","heaven_gate_pax"];
  if(f.some(k=>!Number.isInteger(row[k])||row[k]<0)) return $("#r2").textContent="กรอกจำนวนเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไปให้ครบ";
  if(row.day_type==="holiday"&&row.express_pax>0) return $("#r2").textContent="เรือด่วนไม่วิ่งวันหยุด ต้องเป็น 0";
  if(row.morning_peak+row.evening_peak!==row.electric_pax+row.express_pax)
    return $("#r2").textContent=`เช้า+เย็น (${row.morning_peak+row.evening_peak}) ต้องเท่ากับ ไฟฟ้า+เรือด่วน (${row.electric_pax+row.express_pax})`;
  $("#sv").disabled=true;
  const {error}=await sb.from("passenger_logs").insert(row);
  $("#sv").disabled=false;
  if(error) return toast(dbMsg(error));     // ไม่ล้างฟอร์ม ข้อมูลที่กรอกไม่หาย
  toast("บันทึกแล้ว"); go("home");
}
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
boot();
