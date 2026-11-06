"use strict";
// เมนูตามลำดับ: (1) เหตุการณ์และความปลอดภัย ✔  ที่เหลือยังไม่ได้สร้าง
const MENU=[["📊","ภาพรวม","home"],["📝","ข้อมูลรายงาน","rep"],["🚤","สถิติผู้โดยสาร/เรือ","add"],["🚨","เหตุการณ์และความปลอดภัย","inc"],["🔧","เหตุขัดข้อง/ซ่อมบำรุง","mnt"],["💳","ค่าธรรมเนียม/นำส่งรายได้","fee"],["📣","ปัญหา/ข้อร้องเรียน/ทรัพย์สิน","cmp"],["✅","ตรวจความพร้อมท่าเรือ","rdy"],["🗓️","ตารางเรือ/คุณภาพบริการ","sch"],["👥","บุคลากร/เวร/เข้าออก","ppl"],["🦺","ตรวจอุปกรณ์","eqp"],["📤","ส่งรายงาน/ตรวจรับ","rep"]];
V.menu=()=>{ $("#main").innerHTML=`<div class="menu" style="margin-top:44px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${MENU.map(([i,n,t],k)=>`<button class="card" style="min-height:92px;padding:10px 4px;text-align:center;font-size:12px;margin:0" data-k="${k}"><div style="font-size:22px">${i}</div>${esc(n)}${t?"":`<div class="note">ยังไม่ได้สร้าง</div>`}</button>`).join("")}</div>`;
  $("#main").querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{const t=MENU[b.dataset.k][2]; t?go(t):toast("เมนูนี้ยังไม่ได้สร้าง")}); };

const INC_W=()=>has("admin","manager","assistant","security"), CAT={accident:"อุบัติเหตุ",unsafe:"เหตุการณ์ไม่ปลอดภัย",other:"อื่น ๆ"};
const mrange=()=>{const {y,m}=S.period,p=n=>String(n).padStart(2,"0"),ny=m===12?y+1:y,nm=m===12?1:m+1;return [`${y}-${p(m)}-01T00:00:00+07:00`,`${ny}-${p(nm)}-01T00:00:00+07:00`]};
const localIso=v=>`${v}:00+07:00`, toLocal=ts=>{const d=new Date(new Date(ts).toLocaleString("en-US",{timeZone:"Asia/Bangkok"}));return `${ymd(d)}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
const dtTh=ts=>fdate(toLocal(ts).slice(0,10))+" "+toLocal(ts).slice(11);

V.inc=async()=>{
  $("#main").innerHTML=`<div class="card">กำลังโหลด…</div>`;
  const [a,b]=mrange(), today=ymd(bkk());
  const [r,att,dec]=await Promise.all([
    sb.from("incidents").select("*").eq("station_id",S.station.id).gte("occurred_at",a).lt("occurred_at",b).order("occurred_at",{ascending:false}),
    sb.from("attachments").select("incident_id").eq("station_id",S.station.id).not("incident_id","is",null),
    sb.from("daily_declarations").select("*").eq("station_id",S.station.id).eq("topic","incident").eq("log_date",today).maybeSingle()]);
  if(r.error) return $("#main").innerHTML=`<div class="card err">${esc(dbMsg(r.error))}</div>`;
  const cnt={}; (att.data||[]).forEach(x=>cnt[x.incident_id]=(cnt[x.incident_id]||0)+1);
  const todayInc=r.data.filter(i=>toLocal(i.occurred_at).startsWith(today)).length;
  $("#main").innerHTML=`<button class="btn alt" id="bk" style="margin-top:44px">‹ เมนู</button>
   ${INC_W()?`<button class="btn" id="new">＋ บันทึกเหตุการณ์</button>
   <div class="card" style="margin-top:12px"><small>วันนี้ (${fdate(today)}): ${dec.data?(dec.data.status==="none"?"บันทึกว่า ไม่มีเหตุการณ์":"มีรายการ"):todayInc?`มี ${todayInc} รายการ`:"ยังไม่บันทึก"}</small>
   ${todayInc?"":`<button class="btn alt" id="none">บันทึกว่าวันนี้ไม่มีเหตุการณ์</button>`}</div>`:""}
   <h2>เหตุการณ์ในเดือนนี้ (${r.data.length})</h2>
   ${r.data.map(i=>`<button class="card" data-id="${i.id}" style="width:100%;text-align:left"><b>${esc(CAT[i.category])}</b> · ${esc(i.location)}<div class="note">${esc(dtTh(i.occurred_at))}${i.injured||i.deaths?` · บาดเจ็บ ${i.injured} เสียชีวิต ${i.deaths}`:""}${cnt[i.id]?` · 📷 ${cnt[i.id]}`:""}</div><div>${esc(i.detail)}</div></button>`).join("")||`<p class="note">ยังไม่มีรายการในเดือนนี้</p>`}`;
  $("#bk").onclick=()=>go("menu");
  if($("#new")) $("#new").onclick=()=>incForm();
  if($("#none")) $("#none").onclick=async()=>{const {error}=await sb.from("daily_declarations").upsert({station_id:S.station.id,log_date:today,topic:"incident",status:"none"},{onConflict:"station_id,log_date,topic"}); error?toast(dbMsg(error)):(toast("บันทึกแล้ว"),V.inc())};
  $("#main").querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>incForm(r.data.find(i=>i.id===b.dataset.id)));
};

async function resizeJpeg(file,max=1600){
  try{const bm=await createImageBitmap(file),k=Math.min(1,max/Math.max(bm.width,bm.height)),c=document.createElement("canvas");c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext("2d").drawImage(bm,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(r,"image/jpeg",.82));}catch{return file}
}
function incForm(row){
  const ro=!INC_W(), now=toLocal(new Date().toISOString());
  $("#main").innerHTML=`<button class="btn alt" id="bk" style="margin-top:44px">‹ กลับ</button><div class="card" style="margin-top:12px">
   <label class="l" for="i_t">วันเวลา</label><input class="in" id="i_t" type="datetime-local" max="${now}" value="${row?toLocal(row.occurred_at):now}">
   <label class="l" for="i_c">ประเภท</label><select class="in" id="i_c">${Object.entries(CAT).map(([k,v])=>`<option value="${k}" ${row&&row.category===k?"selected":""}>${v}</option>`).join("")}</select>
   <label class="l" for="i_l">สถานที่ *</label><input class="in" id="i_l" value="${esc(row?.location)}">
   <label class="l" for="i_v">ระดับเหตุการณ์</label><input class="in" id="i_v" value="${esc(row?.level)}">
   <label class="l" for="i_d">รายละเอียด *</label><textarea class="in" id="i_d" rows="3" style="padding:10px">${esc(row?.detail)}</textarea>
   <label class="l" for="i_s">สาเหตุ</label><input class="in" id="i_s" value="${esc(row?.cause)}">
   <label class="l" for="i_r">การแก้ไข</label><input class="in" id="i_r" value="${esc(row?.resolution)}">
   <div class="grid2"><div><label class="l" for="i_i">บาดเจ็บ (คน)</label><input class="in" id="i_i" type="number" min="0" inputmode="numeric" value="${row?row.injured:0}"></div>
   <div><label class="l" for="i_x">เสียชีวิต (คน)</label><input class="in" id="i_x" type="number" min="0" inputmode="numeric" value="${row?row.deaths:0}"></div></div>
   <label class="l" for="i_p">แนบภาพ (ถ่ายจากกล้องหรือเลือกไฟล์)</label><input class="in" id="i_p" type="file" accept="image/*" multiple style="padding-top:12px">
   <div class="err" id="i_e"></div>${ro?"":`<button class="btn" id="i_sv">${row?"บันทึกการแก้ไข":"บันทึก"}</button>`}</div>`;
  $("#bk").onclick=()=>V.inc();
  if(ro) return;
  $("#i_sv").onclick=async()=>{
    const g=id=>$(id).value, e=$("#i_e"); e.textContent="";
    const o={station_id:S.station.id,occurred_at:g("#i_t")?localIso(g("#i_t")):null,category:g("#i_c"),location:g("#i_l").trim(),level:g("#i_v").trim()||null,detail:g("#i_d").trim(),cause:g("#i_s").trim()||null,resolution:g("#i_r").trim()||null,injured:+g("#i_i"),deaths:+g("#i_x")};
    if(!o.occurred_at) return e.textContent="เลือกวันเวลา";
    if(new Date(o.occurred_at)>new Date()) return e.textContent="วันเวลาห้ามเป็นอนาคต";
    if(!o.location||!o.detail) return e.textContent="กรอกสถานที่และรายละเอียด";
    if(!Number.isInteger(o.injured)||!Number.isInteger(o.deaths)||o.injured<0||o.deaths<0) return e.textContent="จำนวนผู้บาดเจ็บ/เสียชีวิตต้องเป็นเลขจำนวนเต็ม ≥ 0";
    $("#i_sv").disabled=true;
    const q=row?sb.from("incidents").update(o).eq("id",row.id).select().single():sb.from("incidents").insert(o).select().single();
    const {data,error}=await q; if(error){$("#i_sv").disabled=false;return toast(dbMsg(error))}   // ไม่ล้างฟอร์ม
    let fail=0; for(const f of [...$("#i_p").files]){
      const blob=await resizeJpeg(f), path=`${S.station.id}/${data.id}/${crypto.randomUUID()}.jpg`;
      const up=await sb.storage.from("attachments").upload(path,blob,{contentType:"image/jpeg"});
      const ins=up.error?{error:up.error}:await sb.from("attachments").insert({station_id:S.station.id,storage_path:path,file_name:f.name,mime_type:"image/jpeg",captured_at:new Date(f.lastModified).toISOString(),place:o.location,incident_id:data.id});
      if(ins.error){fail++; if(!up.error) await sb.storage.from("attachments").remove([path]);}   // กันไฟล์กำพร้า
    }
    toast(fail?`บันทึกเหตุการณ์แล้ว แต่แนบภาพไม่สำเร็จ ${fail} ไฟล์ (เปิดรายการแล้วแนบใหม่)`:"บันทึกแล้ว"); V.inc();
  };
}


// ---------- ตรวจความพร้อมท่าเรือ (2.1) ----------
const RD_PTS={pontoon1:"โป๊ะเทียบเรือที่ 1",pontoon2:"โป๊ะเทียบเรือที่ 2",pontoon3_express:"โป๊ะเทียบเรือที่ 3 เรือด่วน",pontoon4_ev:"โป๊ะเทียบเรือที่ 4 EV",walkway_bridge:"ทางเดินและสะพานปรับระดับ",terminal:"อาคารผู้โดยสาร"};
const RD_SYS={pontoon_fender:"โป๊ะ/กันกระแทก",civil:"งานโยธา",lighting_outlets:"ไฟฟ้า/แสงสว่าง/เต้ารับ",fire_detection:"ระบบตรวจจับเพลิง",fire_protection:"ระบบดับเพลิง",communication:"ระบบสื่อสาร",water:"ระบบน้ำ"};
const RD_DEF={pontoon1:"pontoon_fender",pontoon2:"pontoon_fender",pontoon3_express:"pontoon_fender",pontoon4_ev:"pontoon_fender",walkway_bridge:"civil",terminal:"civil"};
const RD_PH={before_open:"ก่อนเปิดให้บริการ",close:"ปิดให้บริการ"};
const RD_W=()=>has("admin","manager","assistant","security");
V.rdy=async()=>{
  $("#main").innerHTML=`<div class="card">กำลังโหลด…</div>`;
  const {y,m}=S.period,p=n=>String(n).padStart(2,"0"),a=`${y}-${p(m)}-01`,b=`${y}-${p(m)}-${p(new Date(y,m,0).getDate())}`;
  const {data,error}=await sb.from("readiness_checks").select("*,readiness_check_items(point,ready)").eq("station_id",S.station.id).gte("check_date",a).lte("check_date",b).order("check_date",{ascending:false});
  if(error) return $("#main").innerHTML=`<div class="card err">${esc(dbMsg(error))}</div>`;
  $("#main").innerHTML=`<button class="btn alt" id="bk" style="margin-top:44px">‹ เมนู</button>
   ${RD_W()?`<button class="btn" id="new">＋ บันทึกผลตรวจความพร้อม</button>`:""}
   <h2>ผลตรวจในเดือนนี้ (${data.length})</h2>
   ${data.map(c=>{const bad=c.readiness_check_items.filter(i=>!i.ready).length;return `<button class="dayrow" data-d="${c.check_date}" data-p="${c.phase}"><span><b>${fdate(c.check_date)}</b><small>${RD_PH[c.phase]} · ตรวจ ${c.readiness_check_items.length}/6 จุด</small></span><span class="dtot" style="color:${bad?"#c0392b":"#2f7d5b"}">${bad?`ไม่พร้อม ${bad} จุด`:"พร้อมทุกจุด"} ›</span></button>`}).join("")||`<p class="note">ยังไม่มีผลตรวจในเดือนนี้</p>`}`;
  $("#bk").onclick=()=>go("menu");
  if($("#new")) $("#new").onclick=()=>rdyForm(ymd(bkk()),"before_open");
  $("#main").querySelectorAll("[data-d]").forEach(x=>x.onclick=()=>rdyForm(x.dataset.d,x.dataset.p));
};
async function rdyForm(date,phase){
  const ro=!RD_W();
  $("#main").innerHTML=`<div class="card" style="margin-top:44px">กำลังโหลด…</div>`;
  const {data:ex,error}=await sb.from("readiness_checks").select("*,readiness_check_items(*)").eq("station_id",S.station.id).eq("check_date",date).eq("phase",phase).maybeSingle();
  if(error) return toast(dbMsg(error));
  const it={}; (ex?.readiness_check_items||[]).forEach(i=>it[i.point]=i);
  const today=ymd(bkk());
  $("#main").innerHTML=`<button class="btn alt" id="bk" style="margin-top:44px">‹ กลับ</button><div class="card" style="margin-top:12px">
   <div class="grid2"><div><label class="l" for="r_d">วันที่</label><input class="in" id="r_d" type="date" max="${today}" value="${date}" ${ro?"disabled":""}></div>
   <div><label class="l" for="r_p">รอบ</label><select class="in" id="r_p" ${ro?"disabled":""}>${Object.entries(RD_PH).map(([k,v])=>`<option value="${k}" ${k===phase?"selected":""}>${v}</option>`).join("")}</select></div></div>
   <p class="note">${ex?"มีผลตรวจของวัน/รอบนี้แล้ว — แก้ไขได้":"ยังไม่มีผลตรวจของวัน/รอบนี้"}</p></div>
   ${Object.entries(RD_PTS).map(([k,n])=>{const i=it[k]||{ready:true};return `<div class="card" data-pt="${k}"><b>${n}</b>
    <select class="in rd" style="margin-top:8px" ${ro?"disabled":""}><option value="1" ${i.ready?"selected":""}>พร้อมใช้</option><option value="0" ${i.ready?"":"selected"}>ไม่พร้อมใช้</option></select>
    <div class="bad" style="display:${i.ready?"none":"block"}">
     <label class="l">รายละเอียดที่ไม่พร้อม *</label><input class="in dt" value="${esc(i.detail)}" ${ro?"disabled":""}>
     <label class="l">ระบบที่เกี่ยวข้อง (สร้างงานซ่อมให้อัตโนมัติ)</label><select class="in sy" ${ro||i.maintenance_job_id?"disabled":""}>${Object.entries(RD_SYS).map(([v,l])=>`<option value="${v}" ${v===RD_DEF[k]?"selected":""}>${l}</option>`).join("")}</select>
     ${i.maintenance_job_id?`<p class="note">มีงานซ่อมผูกไว้แล้ว</p>`:""}</div>
    <label class="l">หมายเหตุ</label><input class="in nt" value="${esc(i.note)}" ${ro?"disabled":""}>
    ${ro?"":`<label class="l">แนบภาพ (ถ้ามี)</label><input class="in ph" type="file" accept="image/*" multiple style="padding-top:12px">`}</div>`}).join("")}
   <div class="err" id="r_e"></div>
   ${ro?`<p class="note">ดูอย่างเดียว (ไม่มีสิทธิ์แก้ไข)</p>`:`<button class="btn" id="r_sv">บันทึกผลตรวจ</button>`}`;
  $("#bk").onclick=()=>V.rdy();
  $("#r_d").onchange=$("#r_p").onchange=()=>{ if($("#r_d").value) rdyForm($("#r_d").value,$("#r_p").value) };
  $("#main").querySelectorAll("[data-pt]").forEach(c=>c.querySelector(".rd").onchange=e=>c.querySelector(".bad").style.display=e.target.value==="1"?"none":"block");
  if(ro) return;
  $("#r_sv").onclick=async()=>{
    const e=$("#r_e"); e.textContent="";
    const d=$("#r_d").value, ph=$("#r_p").value;
    if(!d) return e.textContent="เลือกวันที่"; if(d>today) return e.textContent="วันที่ห้ามเป็นอนาคต";
    const rows=[...$("#main").querySelectorAll("[data-pt]")].map(c=>({point:c.dataset.pt,ready:c.querySelector(".rd").value==="1",detail:c.querySelector(".dt").value.trim(),sys:c.querySelector(".sy").value,note:c.querySelector(".nt").value.trim()||null,files:[...c.querySelector(".ph").files]}));
    const miss=rows.find(r=>!r.ready&&!r.detail); if(miss) return e.textContent=`กรอกรายละเอียดที่ไม่พร้อมของ "${RD_PTS[miss.point]}"`;
    $("#r_sv").disabled=true;
    const {data:{user}}=await sb.auth.getUser();
    const {data:ck,error:ce}=await sb.from("readiness_checks").upsert({station_id:S.station.id,check_date:d,phase:ph,inspector_id:user.id},{onConflict:"station_id,check_date,phase"}).select().single();
    if(ce){$("#r_sv").disabled=false;return toast(dbMsg(ce))}
    let fail=0, bad=0;
    for(const r of rows){
      const old=(ex&&ex.check_date===d&&ex.phase===ph?it[r.point]:null), had=old?.maintenance_job_id||null; let job=had, newJob=null;
      if(!r.ready&&!job){
        const {data:j,error:je}=await sb.from("maintenance_jobs").insert({station_id:S.station.id,system:r.sys,equipment:RD_PTS[r.point],reported_on:d,symptom:r.detail}).select().single();
        if(je){fail++;toast(dbMsg(je));continue} job=newJob=j.id;
      }
      const {data:row,error:ie}=await sb.from("readiness_check_items").upsert({check_id:ck.id,station_id:S.station.id,point:r.point,ready:r.ready,detail:r.ready?null:r.detail,note:r.note,maintenance_job_id:job},{onConflict:"check_id,point"}).select().single();
      if(ie){fail++;if(newJob) await sb.from("maintenance_jobs").delete().eq("id",newJob);toast(dbMsg(ie));continue}
      if(!r.ready) bad++;
      for(const f of r.files){
        const blob=await resizeJpeg(f), path=`${S.station.id}/${row.id}/${crypto.randomUUID()}.jpg`;
        const up=await sb.storage.from("attachments").upload(path,blob,{contentType:"image/jpeg"});
        const ins=up.error?{error:up.error}:await sb.from("attachments").insert({station_id:S.station.id,storage_path:path,file_name:f.name,mime_type:"image/jpeg",captured_at:new Date(f.lastModified).toISOString(),place:RD_PTS[r.point],readiness_item_id:row.id});
        if(ins.error){fail++;if(!up.error) await sb.storage.from("attachments").remove([path])}
      }
    }
    $("#r_sv").disabled=false;
    if(fail) return toast(`บันทึกไม่ครบ ${fail} รายการ — เปิดผลตรวจนี้เพื่อตรวจและบันทึกซ้ำ`);
    toast(bad?`บันทึกแล้ว · ไม่พร้อม ${bad} จุด (สร้างงานซ่อมให้แล้ว)`:"บันทึกแล้ว"); V.rdy();
  };
}
