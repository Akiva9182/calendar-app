// ===== Elements =====
const calendarEl = document.getElementById("calendar");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const toggleViewBtn = document.getElementById("toggleView");
const exportBtn = document.getElementById("exportIcs");
const calendarWrap = document.getElementById("calendarWrap");

// ===== Date State =====
let today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let currentWeekAnchor = new Date(today);
let viewMode = "month";

// ===== Labels =====
const weekDays = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const monthNames = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"
];

// ===== Events =====
const STORAGE_KEY = "calendarEvents_v1";
let events = loadEvents();

// animation state
let lastAnimated = null;

// ===== Holidays =====
let holidaysMap = {};

// ===== Utils =====
function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}
function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function sameDay(a,b){
  return a.getFullYear()===b.getFullYear() &&
         a.getMonth()===b.getMonth() &&
         a.getDate()===b.getDate();
}
function toYmd(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ===== Hebrew Date =====
let hebrewFormatter = null;
try {
  hebrewFormatter = new Intl.DateTimeFormat("he-u-ca-hebrew",{day:"numeric",month:"short"});
} catch {}

function hebrewDayGematria(n){
  if(n===15) return "ט״ו";
  if(n===16) return "ט״ז";
  const ones=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens=["","י","כ","ל"];
  const t=Math.floor(n/10), o=n%10;
  const s=(tens[t]||"")+(ones[o]||"");
  return s.length===1 ? s+"׳" : s.slice(0,-1)+"״"+s.slice(-1);
}
function formatHebrewDate(d){
  if(!hebrewFormatter) return "";
  const parts = hebrewFormatter.formatToParts(d);
  const day = parseInt(parts.find(p=>p.type==="day")?.value,10);
  const month = parts.find(p=>p.type==="month")?.value;
  if(!day||!month) return "";
  return `${hebrewDayGematria(day)} ${month}`;
}

// ===== Title & Animation =====
function setTitle(text){
  const old=document.querySelector("h2");
  if(old) old.remove();
  const h=document.createElement("h2");
  h.textContent=text;
  calendarWrap.parentElement.insertBefore(h,calendarWrap);
}
function animateRender(){
  calendarWrap.classList.remove("fade-slide-in");
  void calendarWrap.offsetWidth;
  calendarWrap.classList.add("fade-slide-in");
}

// ===== Holidays (Hebcal) =====
async function loadHolidaysForRange(start,end){
  const url=`https://www.hebcal.com/hebcal?v=1&cfg=json&geo=il&heb=on&maj=on&min=on&mod=on&start=${toYmd(start)}&end=${toYmd(end)}`;
  const res=await fetch(url);
  const data=await res.json();
  const map={};
  (data.items||[]).forEach(it=>{
    if(!it.date||!it.title) return;
    const key=it.date.slice(0,10);
    if(!map[key]) map[key]=[];
    map[key].push(it.title);
  });
  return map;
}
function startOfWeek(d){
  const c=new Date(d);
  c.setDate(c.getDate()-c.getDay());
  c.setHours(0,0,0,0);
  return c;
}
async function ensureHolidays(){
  let s,e;
  if(viewMode==="month"){
    s=new Date(currentYear,currentMonth,1);
    e=new Date(currentYear,currentMonth+1,0);
  }else{
    s=startOfWeek(currentWeekAnchor);
    e=new Date(s); e.setDate(e.getDate()+6);
  }
  try{ holidaysMap=await loadHolidaysForRange(s,e); }
  catch{ holidaysMap={}; }
}

// ===== Rendering =====
function buildDayCell(d,{small}){
  const cell=document.createElement("div");
  cell.className="day"+(small?" small":"");

  const num=document.createElement("div");
  num.textContent=d.getDate();
  cell.appendChild(num);

  const sub=document.createElement("div");
  sub.className="subdate";
  sub.textContent=formatHebrewDate(d);
  cell.appendChild(sub);

  if(sameDay(d,today)) cell.classList.add("today");

  const key=dateKeyFromDate(d);

  if(holidaysMap[key]){
    holidaysMap[key].slice(0,2).forEach(h=>{
      const hd=document.createElement("div");
      hd.className="holiday";
      hd.textContent=h;
      cell.appendChild(hd);
    });
  }

  if(events[key]){
    events[key].forEach((txt,i)=>{
      const ev=document.createElement("div");
      ev.className="event";
      ev.textContent=txt;
      if(lastAnimated && lastAnimated.key===key && lastAnimated.index===i){
        ev.classList.add("pop");
      }
      ev.onclick=e=>{
        e.stopPropagation();
        const u=prompt("ערוך אירוע (ריק=מחיקה)",txt);
        if(u===null) return;
        if(!u.trim()){
          events[key].splice(i,1);
          if(!events[key].length) delete events[key];
        }else{
          events[key][i]=u.trim();
          lastAnimated={key,index:i};
        }
        saveEvents();
        void render();
      };
      cell.appendChild(ev);
    });
  }

  cell.onclick=()=>{
    const t=prompt(`הוסף אירוע ל־${d.getDate()}/${d.getMonth()+1}`);
    if(!t||!t.trim()) return;
    if(!events[key]) events[key]=[];
    events[key].push(t.trim());
    lastAnimated={key,index:events[key].length-1};
    saveEvents();
    void render();
  };

  return cell;
}

function renderMonth(){
  setTitle(`${monthNames[currentMonth]} ${currentYear}`);
  calendarEl.innerHTML="";
  calendarEl.classList.remove("weekRow");
  weekDays.forEach(w=>{
    const h=document.createElement("div");
    h.className="day header";
    h.textContent=w;
    calendarEl.appendChild(h);
  });
  const first=new Date(currentYear,currentMonth,1).getDay();
  for(let i=0;i<first;i++){
    const e=document.createElement("div");
    e.className="day empty";
    calendarEl.appendChild(e);
  }
  const days=new Date(currentYear,currentMonth+1,0).getDate();
  for(let d=1;d<=days;d++){
    calendarEl.appendChild(buildDayCell(new Date(currentYear,currentMonth,d),{small:false}));
  }
  animateRender();
}

function renderWeek(){
  const s=startOfWeek(currentWeekAnchor);
  const e=new Date(s); e.setDate(e.getDate()+6);
  setTitle(`שבוע: ${s.getDate()}/${s.getMonth()+1} - ${e.getDate()}/${e.getMonth()+1}`);
  calendarEl.innerHTML="";
  calendarEl.classList.add("weekRow");
  weekDays.forEach(w=>{
    const h=document.createElement("div");
    h.className="day header";
    h.textContent=w;
    calendarEl.appendChild(h);
  });
  for(let i=0;i<7;i++){
    const d=new Date(s); d.setDate(s.getDate()+i);
    calendarEl.appendChild(buildDayCell(d,{small:true}));
  }
  animateRender();
}

async function render(){
  await ensureHolidays();
  if(viewMode==="month"){
    renderMonth();
    toggleViewBtn.textContent="תצוגה: חודשית";
  }else{
    renderWeek();
    toggleViewBtn.textContent="תצוגה: שבועית";
  }
  lastAnimated=null;
}

// ===== Controls =====
prevBtn.onclick=()=>{
  if(viewMode==="month"){
    currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;}
  }else{
    currentWeekAnchor.setDate(currentWeekAnchor.getDate()-7);
  }
  void render();
};
nextBtn.onclick=()=>{
  if(viewMode==="month"){
    currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;}
  }else{
    currentWeekAnchor.setDate(currentWeekAnchor.getDate()+7);
  }
  void render();
};
toggleViewBtn.onclick=()=>{
  viewMode=viewMode==="month"?"week":"month";
  void render();
};

// ===== iCal Export =====
exportBtn.onclick=()=>{
  let out="BEGIN:VCALENDAR\r\nVERSION:2.0\r\n";
  Object.keys(events).forEach(k=>{
    const [y,m,d]=k.split("-");
    events[k].forEach((t,i)=>{
      out+=`BEGIN:VEVENT\r\nSUMMARY:${t}\r\nDTSTART;VALUE=DATE:${y}${m}${d}\r\nDTEND;VALUE=DATE:${y}${m}${String(+d+1).padStart(2,"0")}\r\nEND:VEVENT\r\n`;
    });
  });
  out+="END:VCALENDAR";
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([out],{type:"text/calendar"}));
  a.download="calendar.ics";
  a.click();
};

// ===== Init =====
void render();
