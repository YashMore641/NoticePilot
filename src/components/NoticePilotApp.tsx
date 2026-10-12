"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutDashboard, FileText, CalendarClock, CheckSquare, Settings, Sparkles, Upload, ClipboardPaste, Search, Plus, Trash2, Check, Clock, AlertTriangle, ChevronRight, X, FileUp, Loader2, MessageCircleQuestion, Send, ShieldCheck, Bot, CircleHelp, Pencil, Filter, ArrowRight, BookOpenCheck, BellRing, Landmark, ListTodo, CircleCheck, Info } from "lucide-react";

type Analysis = { title:string; summary:string; notice_type:string; issuer:string|null; important_dates:{event:string;date:string|null;date_text:string;time:string|null;urgency:string;evidence:string}[]; eligibility:string[]; required_documents:string[]; action_items:{title:string;description:string;due_date:string|null;priority:string;evidence:string}[]; missing_information:string[] };
type Notice = { id:number; title:string; summary:string; noticeType:string; issuer:string|null; rawText:string; source:string; sourceName:string|null; engine:string; analysis:Analysis; createdAt:string; actionCount?:number };
type Task = { id:number; title:string; description:string; noticeId:number|null; dueDate:string|null; priority:string; status:string; createdAt:string; noticeTitle?:string };
type View = "overview"|"analyze"|"notices"|"deadlines"|"tasks"|"settings"|"detail";

const SAMPLE = `TRINITY COLLEGE — EXAMINATION DEPARTMENT

Notice: Semester Examination Form Submission

All eligible students must submit their semester examination forms online by 15 October 2026 at 5:00 PM.

Students must verify their personal details before submission and contact the examination department if they encounter payment issues.

Required documents: The notice does not specify additional documents.

Late submission: No information about late submission is provided.

Students should refer to the official examination portal for the submission procedure.`;

const PROGRESS = ["Reading your notice…","Finding important dates…","Checking eligibility & documents…","Organizing your action items…"];
const fmtDate = (d:string|null) => d ? new Date(d+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"}) : "Date not confirmed";
const fmtShort = (d:string) => new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
const todayISO = () => new Date().toISOString().slice(0,10);
function daysLabel(d:string|null){ if(!d) return "No confirmed date"; const days=Math.ceil((new Date(d+"T00:00:00").getTime()-new Date(todayISO()+"T00:00:00").getTime())/864e5); if(days<0) return `${Math.abs(days)}d overdue`; if(days===0) return "Due today"; if(days===1) return "Tomorrow"; return `In ${days} days`; }
const TYPE_LABEL: Record<string,string> = { exam:"Exam", assignment:"Assignment", scholarship:"Scholarship", event:"Event", placement:"Placement", administrative:"Administrative", other:"General" };
function Badge({children,tone="blue"}:{children:React.ReactNode;tone?:string}){ const map:any={blue:"bg-blue-50 text-blue-700 ring-blue-200",red:"bg-red-50 text-red-700 ring-red-200",amber:"bg-amber-50 text-amber-700 ring-amber-200",green:"bg-emerald-50 text-emerald-700 ring-emerald-200",slate:"bg-slate-100 text-slate-600 ring-slate-200",violet:"bg-violet-50 text-violet-700 ring-violet-200"}; return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${map[tone]||map.blue}`}>{children}</span>; }
const priTone = (p:string)=> p==="high"?"red":p==="medium"?"amber":"slate";
const urgTone = (p:string)=> p==="high"?"red":p==="medium"?"amber":"green";

async function api(path:string, opts?:RequestInit){ const r=await fetch(path,{headers:{"Content-Type":"application/json"},...opts}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||"Something went wrong. Please try again."); return d; }

export default function NoticePilotApp(){
  const [view,setView]=useState<View>("overview");
  const [dash,setDash]=useState<any>(null);
  const [notices,setNotices]=useState<Notice[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [selected,setSelected]=useState<Notice|null>(null);
  const [selectedTasks,setSelectedTasks]=useState<Task[]>([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState("");
  const [mobileNav,setMobileNav]=useState(false);
  // analyzer
  const [mode,setMode]=useState<"paste"|"pdf">("paste");
  const [text,setText]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [progressIdx,setProgressIdx]=useState(0);
  const [analyzeError,setAnalyzeError]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  // notices filters
  const [nq,setNq]=useState(""); const [ntype,setNtype]=useState("all");
  // tasks filters
  const [tStatus,setTStatus]=useState("all"); const [tPri,setTPri]=useState("all"); const [tq,setTq]=useState("");
  const [taskForm,setTaskForm]=useState({title:"",description:"",dueDate:"",priority:"medium"});
  const [editing,setEditing]=useState<Task|null>(null);
  // QA
  const [question,setQuestion]=useState(""); const [qa,setQa]=useState<{q:string;a:string;sources:string[]}[]>([]); const [asking,setAsking]=useState(false);
  const [addedTitles,setAddedTitles]=useState<Set<string>>(new Set());
  const [showRaw,setShowRaw]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState<Notice|null>(null);

  const notify=(m:string)=>{ setToast(m); setTimeout(()=>setToast(""),3600); };
  const refresh=useCallback(async()=>{
    try{ const [d,n,t]=await Promise.all([api("/api/dashboard/stats"),api("/api/notices"),api("/api/tasks")]); setDash(d); setNotices(n.notices); setTasks(t.tasks); }
    catch(e:any){ notify(e.message||"Backend unavailable — check your connection and retry."); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ refresh(); },[refresh]);
  useEffect(()=>{ if(!analyzing) return; const i=setInterval(()=>setProgressIdx(p=>(p+1)%PROGRESS.length),1400); return ()=>clearInterval(i); },[analyzing]);

  const hour=new Date().getHours(); const greeting= hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";

  async function openNotice(n:Notice){ try{ const d=await api(`/api/notices/${n.id}`); setSelected(d.notice); setSelectedTasks(d.tasks); setAddedTitles(new Set(d.tasks.map((t:Task)=>t.title))); setQa([]); setQuestion(""); setShowRaw(false); setView("detail"); }catch(e:any){ notify(e.message); } }

  async function runAnalyze(){
    setAnalyzeError(""); setProgressIdx(0);
    if(mode==="paste"){
      if(!text.trim()){ setAnalyzeError("Paste a notice first — the text box is empty."); return; }
      if(text.trim().length<30){ setAnalyzeError("That looks too short to be a full notice. Paste the complete notice so no deadline is missed."); return; }
    } else if(!file){ setAnalyzeError("Choose a PDF file first, or switch to “Paste notice”."); return; }
    setAnalyzing(true);
    try{
      let data:any;
      if(mode==="pdf" && file){ const fd=new FormData(); fd.append("file",file); const r=await fetch("/api/notices/upload",{method:"POST",body:fd}); data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data.error||"Upload failed."); }
      else data=await api("/api/notices/analyze",{method:"POST",body:JSON.stringify({text})});
      await refresh(); notify(data.engine==="gemini" ? "Notice analysed with Gemini AI ✓" : "Notice analysed — deadlines & actions extracted.");
      openNotice(data.notice);
    }catch(e:any){ setAnalyzeError(e.message||"Analysis failed. Your input is preserved — please try again."); }
    finally{ setAnalyzing(false); }
  }

  async function addTaskFromAction(notice:Notice, a:Analysis["action_items"][number]){
    try{ const d=await api("/api/tasks",{method:"POST",body:JSON.stringify({title:a.title,description:a.description,noticeId:notice.id,dueDate:a.due_date,priority:a.priority})});
      setAddedTitles(s=>new Set(s).add(a.title)); setSelectedTasks(t=>[d.task,...t]); notify("Added to My Tasks"); refresh();
    }catch(e:any){ notify(e.message); if(/already/i.test(e.message)) setAddedTitles(s=>new Set(s).add(a.title)); }
  }
  async function toggleTask(t:Task){ try{ const d=await api(`/api/tasks/${t.id}`,{method:"PATCH",body:JSON.stringify({status:t.status==="completed"?"pending":"completed"})}); setTasks(ts=>ts.map(x=>x.id===t.id?d.task:x)); setSelectedTasks(ts=>ts.map(x=>x.id===t.id?d.task:x)); refresh(); }catch(e:any){ notify(e.message); } }
  async function deleteTask(id:number){ try{ await api(`/api/tasks/${id}`,{method:"DELETE"}); setTasks(ts=>ts.filter(t=>t.id!==id)); setSelectedTasks(ts=>ts.filter(t=>t.id!==id)); notify("Task deleted"); refresh(); }catch(e:any){ notify(e.message); } }
  async function saveTask(e:React.FormEvent){ e.preventDefault(); if(!taskForm.title.trim()){ notify("Give your task a title first."); return; }
    try{ if(editing){ const d=await api(`/api/tasks/${editing.id}`,{method:"PATCH",body:JSON.stringify(taskForm)}); setTasks(ts=>ts.map(x=>x.id===editing.id?d.task:x)); notify("Task updated"); }
      else { await api("/api/tasks",{method:"POST",body:JSON.stringify(taskForm)}); notify("Task added"); }
      setTaskForm({title:"",description:"",dueDate:"",priority:"medium"}); setEditing(null); refresh();
    }catch(e2:any){ notify(e2.message); } }
  async function ask(){ if(!selected||!question.trim()) return; const q=question.trim(); setAsking(true); setQuestion("");
    try{ const d=await api(`/api/notices/${selected.id}/ask`,{method:"POST",body:JSON.stringify({question:q})}); setQa(x=>[...x,{q,a:d.answer,sources:d.sources||[]}]); }
    catch(e:any){ setQa(x=>[...x,{q,a:e.message,sources:[]}]); } finally{ setAsking(false); } }
  async function doDeleteNotice(){ if(!confirmDelete) return; try{ await api(`/api/notices/${confirmDelete.id}`,{method:"DELETE"}); notify("Notice deleted"); setConfirmDelete(null); if(selected?.id===confirmDelete.id){ setSelected(null); setView("notices"); } refresh(); }catch(e:any){ notify(e.message); } }

  const stats=dash?.stats||{totalNotices:0,pendingTasks:0,completedTasks:0,upcomingDeadlines:0,overdueTasks:0};
  const engine=dash?.engine||"local";
  const filteredNotices=notices.filter(n=>(ntype==="all"||n.noticeType===ntype)&&(!nq|| (n.title+" "+n.rawText+" "+n.summary).toLowerCase().includes(nq.toLowerCase())));
  const filteredTasks=tasks.filter(t=>(tStatus==="all"||t.status===tStatus)&&(tPri==="all"||t.priority===tPri)&&(!tq||(t.title+" "+t.description).toLowerCase().includes(tq.toLowerCase())));
  const overdue=tasks.filter(t=>t.status==="pending"&&t.dueDate&&t.dueDate<todayISO());
  const pendingNoDate=tasks.filter(t=>t.status==="pending"&&!t.dueDate);

  const NAV=[{id:"overview",label:"Overview",icon:LayoutDashboard},{id:"analyze",label:"Analyze Notice",icon:Sparkles},{id:"notices",label:"My Notices",icon:FileText},{id:"deadlines",label:"Upcoming Deadlines",icon:CalendarClock},{id:"tasks",label:"My Tasks",icon:CheckSquare},{id:"settings",label:"Settings",icon:Settings}] as const;

  const TaskCard=({t,showNotice}:{t:Task;showNotice?:boolean})=>(
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${t.status==="completed"?"border-slate-200 bg-slate-50 opacity-75": t.dueDate&&t.dueDate<todayISO()&&t.status==="pending" ? "border-red-200 bg-red-50/50":"border-slate-200 bg-white"}`}>
      <button aria-label={t.status==="completed"?"Mark pending":"Mark complete"} onClick={()=>toggleTask(t)} className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${t.status==="completed"?"border-emerald-500 bg-emerald-500 text-white":"border-slate-300 text-transparent hover:border-blue-500"}`}><Check className="size-3.5"/></button>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-[#12264d] ${t.status==="completed"?"line-through":""}`}>{t.title}</p>
        {t.description&&<p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{t.description}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={priTone(t.priority)}>{t.priority} priority</Badge>{t.dueDate?<Badge tone={t.dueDate<todayISO()&&t.status==="pending"?"red":"blue"}><Clock className="size-3"/>{fmtDate(t.dueDate)} · {daysLabel(t.dueDate)}</Badge>:<Badge tone="slate">Date not confirmed</Badge>}{showNotice&&t.noticeId&&<Badge tone="violet">{notices.find(n=>n.id===t.noticeId)?.title||"Linked notice"}</Badge>}</div>
      </div>
      <div className="flex gap-1">
        <button aria-label="Edit task" onClick={()=>{setEditing(t); setTaskForm({title:t.title,description:t.description,dueDate:t.dueDate||"",priority:t.priority}); setView("tasks"); window.scrollTo({top:0,behavior:"smooth"});}} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil className="size-4"/></button>
        <button aria-label="Delete task" onClick={()=>deleteTask(t.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4"/></button>
      </div>
    </div>
  );

  return (
  <div className="min-h-screen bg-[#f4f7fc] text-[#12264d]">
    {/* Sidebar */}
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex items-center gap-3 px-6 py-6"><div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200"><BellRing className="size-6"/></div><div><p className="text-lg font-extrabold tracking-tight">NoticePilot</p><p className="text-xs text-slate-500">Your college life, organized.</p></div></div>
      <nav className="space-y-1 px-3" aria-label="Main">
        {NAV.map(n=>(<button key={n.id} onClick={()=>setView(n.id as View)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${(view===n.id||(view==="detail"&&n.id==="notices"))?"bg-blue-600 text-white shadow-md shadow-blue-200":"text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}><n.icon className="size-5"/>{n.label}{n.id==="tasks"&&stats.pendingTasks>0&&<span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${view==="tasks"?"bg-white/25 text-white":"bg-blue-100 text-blue-700"}`}>{stats.pendingTasks}</span>}</button>))}
      </nav>
      <div className="mx-4 mt-auto mb-4 rounded-2xl bg-gradient-to-br from-[#12264d] to-blue-800 p-4 text-white">
        <Sparkles className="size-5 text-blue-300"/><p className="mt-2 text-sm font-bold">Never miss a deadline</p><p className="mt-1 text-xs leading-relaxed text-blue-200">Turn any notice into clear tasks in seconds.</p>
        <button onClick={()=>setView("analyze")} className="mt-3 w-full rounded-lg bg-white py-2 text-xs font-bold text-blue-800 hover:bg-blue-50">Analyze a notice</button>
      </div>
      <p className="px-6 pb-5 text-[11px] text-slate-400">Engine: {engine==="gemini"?"Gemini AI":"Smart local extractor"} · Always verify against the official notice.</p>
    </aside>

    {/* Mobile header */}
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
      <div className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white"><BellRing className="size-5"/></div>
      <div className="flex-1"><p className="font-extrabold leading-none">NoticePilot</p><p className="text-[11px] text-slate-500">Your college life, organized.</p></div>
      <button onClick={()=>setView("analyze")} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">+ Analyze</button>
      <button aria-label="Menu" onClick={()=>setMobileNav(v=>!v)} className="rounded-lg border border-slate-200 p-2">{mobileNav?<X className="size-5"/>:<Filter className="size-5"/>}</button>
    </header>
    {mobileNav&&<div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden"><div className="grid grid-cols-3 gap-2">{NAV.map(n=>(<button key={n.id} onClick={()=>{setView(n.id as View); setMobileNav(false);}} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px] font-semibold ${view===n.id?"bg-blue-600 text-white":"bg-slate-50 text-slate-600"}`}><n.icon className="size-5"/>{n.label}</button>))}</div></div>}

    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:ml-64 lg:max-w-none lg:px-10 lg:py-8">
      {loading ? <div className="grid place-items-center py-32 text-slate-500"><Loader2 className="size-8 animate-spin text-blue-600"/><p className="mt-3 text-sm font-medium">Loading your dashboard…</p></div> : (<>

      {/* ---------- OVERVIEW ---------- */}
      {view==="overview"&&(<div className="space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#12264d] via-blue-900 to-blue-700 p-6 text-white shadow-xl shadow-blue-200 sm:p-8">
          <Badge tone="blue"><Sparkles className="size-3"/> AI notice assistant</Badge>
          <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">{greeting}! Let&apos;s stay ahead of your deadlines.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100 sm:text-base">Upload a college notice or paste its text — NoticePilot extracts deadlines, eligibility, documents and action items, each backed by evidence from the original notice.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={()=>setView("analyze")} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-800 shadow hover:bg-blue-50"><Sparkles className="size-4"/> Analyze a Notice</button>
            <button onClick={()=>setView("tasks")} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/40 hover:bg-white/25"><CheckSquare className="size-4"/> View My Tasks</button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[{label:"Notices analyzed",value:stats.totalNotices,icon:FileText,tone:"bg-blue-50 text-blue-600"},{label:"Pending tasks",value:stats.pendingTasks,icon:ListTodo,tone:"bg-amber-50 text-amber-600"},{label:"Upcoming deadlines (30d)",value:stats.upcomingDeadlines,icon:CalendarClock,tone:"bg-violet-50 text-violet-600"},{label:"Completed tasks",value:stats.completedTasks,icon:CircleCheck,tone:"bg-emerald-50 text-emerald-600"}].map(c=>(
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`grid size-10 place-items-center rounded-xl ${c.tone}`}><c.icon className="size-5"/></div><p className="mt-3 text-3xl font-extrabold">{c.value}</p><p className="text-sm text-slate-500">{c.label}</p></div>
          ))}
        </section>
        {stats.overdueTasks>0&&<button onClick={()=>setView("tasks")} className="flex w-full items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm font-semibold text-red-800"><AlertTriangle className="size-5 shrink-0"/> You have {stats.overdueTasks} overdue task{stats.overdueTasks>1?"s":""} — review them now <ArrowRight className="ml-auto size-4"/></button>}

        <div className="grid gap-6 xl:grid-cols-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
            <div className="flex items-center justify-between"><h2 className="font-bold">Upcoming deadlines</h2><button onClick={()=>setView("deadlines")} className="text-sm font-semibold text-blue-600 hover:underline">View all</button></div>
            <div className="mt-4 space-y-3">
              {(dash?.upcoming||[]).length===0 ? <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500"><CalendarClock className="mx-auto size-8 text-slate-300"/><p className="mt-2 font-medium">No upcoming deadlines yet.</p><p>Analyze a notice and add its actions as tasks.</p></div> : dash.upcoming.map((t:Task)=><TaskCard key={t.id} t={t} showNotice/>)}
            </div>
            <h3 className="mt-6 font-bold">Quick actions</h3>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <button onClick={()=>{setMode("pdf"); setView("analyze");}} className="rounded-2xl border border-slate-200 p-4 text-center text-sm font-semibold hover:border-blue-300 hover:bg-blue-50"><Upload className="mx-auto size-5 text-blue-600"/><span className="mt-1 block">Upload PDF</span></button>
              <button onClick={()=>{setMode("paste"); setView("analyze");}} className="rounded-2xl border border-slate-200 p-4 text-center text-sm font-semibold hover:border-blue-300 hover:bg-blue-50"><ClipboardPaste className="mx-auto size-5 text-blue-600"/><span className="mt-1 block">Paste notice</span></button>
              <button onClick={()=>setView("tasks")} className="rounded-2xl border border-slate-200 p-4 text-center text-sm font-semibold hover:border-blue-300 hover:bg-blue-50"><CheckSquare className="mx-auto size-5 text-blue-600"/><span className="mt-1 block">Pending tasks</span></button>
            </div>
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between"><h2 className="font-bold">Recent notices</h2><button onClick={()=>setView("notices")} className="text-sm font-semibold text-blue-600 hover:underline">All notices</button></div>
            <div className="mt-4 space-y-3">
              {(dash?.recentNotices||[]).length===0 ? <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">No notices yet. Your analysed notices will appear here.</p> : dash.recentNotices.map((n:Notice)=>(
                <button key={n.id} onClick={()=>openNotice(n)} className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold leading-snug">{n.title}</p><ChevronRight className="size-4 shrink-0 text-slate-400"/></div>
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge>{TYPE_LABEL[n.noticeType]||"General"}</Badge><Badge tone="slate">{fmtShort(n.createdAt)}</Badge><Badge tone="green">{n.actionCount||n.analysis.action_items.length} actions</Badge></div>
                </button>))}
            </div>
          </section>
        </div>
      </div>)}

      {/* ---------- ANALYZE ---------- */}
      {view==="analyze"&&(<div className="mx-auto max-w-3xl space-y-5">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">Analyze a notice</h1><p className="mt-1 text-slate-500">Upload a text-based PDF or paste the notice text. We extract only what the notice actually states — with evidence.</p></div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5" role="tablist">
          <button role="tab" aria-selected={mode==="pdf"} onClick={()=>setMode("pdf")} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold ${mode==="pdf"?"bg-blue-600 text-white":"text-slate-600 hover:bg-slate-50"}`}><Upload className="size-4"/> Upload PDF</button>
          <button role="tab" aria-selected={mode==="paste"} onClick={()=>setMode("paste")} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold ${mode==="paste"?"bg-blue-600 text-white":"text-slate-600 hover:bg-slate-50"}`}><ClipboardPaste className="size-4"/> Paste notice</button>
        </div>

        {mode==="pdf" ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) setFile(f);}} className="cursor-pointer rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-8 text-center transition hover:border-blue-400" role="button" aria-label="Upload PDF" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")fileRef.current?.click();}}>
              <FileUp className="mx-auto size-10 text-blue-500"/>
              {file ? <><p className="mt-3 font-bold">{file.name}</p><p className="text-sm text-slate-500">{(file.size/1024).toFixed(1)} KB · PDF</p><p className="mt-1 text-xs font-semibold text-blue-600">Tap to choose a different file</p></> : <><p className="mt-3 font-bold">Drop your notice PDF here, or tap to browse</p><p className="mt-1 text-sm text-slate-500">Text-based PDFs up to 8 MB. Scanned/image PDFs need OCR (not yet supported) — paste the text instead.</p></>}
            </div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f){ if(!/\.pdf$/i.test(f.name)){ setAnalyzeError("That file isn't a PDF. Please choose a .pdf file."); return;} if(f.size>8*1024*1024){ setAnalyzeError("That PDF is over 8 MB. Compress it or paste the text instead."); return;} setFile(f); setAnalyzeError(""); }}}/>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <label htmlFor="notice-text" className="text-sm font-bold">Notice text</label>
            <textarea id="notice-text" value={text} onChange={e=>setText(e.target.value)} rows={11} placeholder={"Paste the full college notice here…\n\ne.g. EXAMINATION DEPARTMENT — All students must submit… by 15 October 2026…"} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"/>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{text.length} characters {text.length>0&&text.length<30?"· a bit short — paste the full notice":""}</span>
              <button onClick={()=>{setText(SAMPLE); setAnalyzeError(""); notify("Sample loaded — it's a fictional demo notice, not an official announcement.");}} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"><BookOpenCheck className="size-3.5"/> Load sample demo notice</button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400"><Info className="mt-0.5 size-3.5 shrink-0"/> The sample is a <b>fictional demonstration</b> (“Trinity College”) so you can try NoticePilot instantly.</p>
          </div>
        )}

        {analyzeError&&<div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"><AlertTriangle className="mt-0.5 size-5 shrink-0"/>{analyzeError}</div>}
        <button onClick={runAnalyze} disabled={analyzing} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-70">
          {analyzing ? <><Loader2 className="size-5 animate-spin"/> {PROGRESS[progressIdx]}</> : <><Sparkles className="size-5"/> Analyze Notice</>}
        </button>
        {analyzing&&<div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full animate-pulse rounded-full bg-blue-600 transition-all" style={{width:`${(progressIdx+1)*25}%`}}/></div>}
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500"/> Your notice is analysed as data only — instructions inside a notice are never followed. Extracted details should always be checked against the original official notice.</p>
      </div>)}

      {/* ---------- DETAIL ---------- */}
      {view==="detail"&&selected&&(<div className="space-y-5">
        <button onClick={()=>setView("notices")} className="text-sm font-semibold text-blue-600 hover:underline">← Back to My Notices</button>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl"><div className="flex flex-wrap gap-1.5"><Badge>{TYPE_LABEL[selected.noticeType]||"General"}</Badge><Badge tone="slate">{selected.source==="pdf"?`PDF · ${selected.sourceName||""}`:"Pasted text"}</Badge><Badge tone={selected.engine==="gemini"?"violet":"slate"}><Bot className="size-3"/>{selected.engine==="gemini"?"Gemini AI":"Local extractor"}</Badge></div>
            <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{selected.title}</h1>
            {selected.issuer&&<p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-500"><Landmark className="size-4"/>{selected.issuer}</p>}</div>
            <span className="text-sm text-slate-400">Analysed {fmtShort(selected.createdAt)}</span>
          </div>
          <p className="mt-4 leading-relaxed text-slate-600">{selected.summary}</p>
        </section>

        <div className="grid gap-5 xl:grid-cols-5">
          <div className="space-y-5 xl:col-span-3">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="size-5 text-blue-600"/> Important dates</h2>
              {selected.analysis.important_dates.length===0 ? <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">No identifiable deadlines in this notice. Read the original carefully — and don&apos;t assume a date that isn&apos;t stated.</p> :
              <ol className="relative mt-5 space-y-5 border-l-2 border-blue-100 pl-6">{selected.analysis.important_dates.map((d,i)=>(
                <li key={i} className="relative"><span className={`absolute -left-[31px] top-1 size-3 rounded-full ring-4 ring-white ${d.date?"bg-blue-600":"bg-amber-400"}`}/>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{d.date?fmtDate(d.date):"Date not confirmed"}</p><Badge tone={urgTone(d.urgency)}>{d.urgency} urgency</Badge>{d.time&&<Badge tone="slate"><Clock className="size-3"/>{d.time}</Badge>}{d.date&&<Badge tone="blue">{daysLabel(d.date)}</Badge>}</div>
                  <p className="mt-0.5 text-sm font-medium text-slate-700">{d.event}</p>
                  {!d.date&&<p className="mt-1 text-xs font-semibold text-amber-700">Stated as “{d.date_text}” — the year/date isn&apos;t confirmed. Verify in the official notice; we won&apos;t invent one.</p>}
                  <blockquote className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs italic leading-relaxed text-slate-500">“{d.evidence}”</blockquote>
                </li>))}</ol>}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold"><ListTodo className="size-5 text-blue-600"/> What you need to do</h2>
              <div className="mt-4 space-y-3">
                {selected.analysis.action_items.length===0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No clear action items were extracted from this notice.</p> : selected.analysis.action_items.map((a,i)=>{
                  const added=addedTitles.has(a.title); const linked=selectedTasks.find(t=>t.title===a.title);
                  return <div key={i} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold">{a.title}</p><Badge tone={priTone(a.priority)}>{a.priority}</Badge></div>
                    <p className="mt-1 text-sm text-slate-500">{a.description}</p>
                    <p className="mt-1.5 text-xs font-semibold text-slate-500">{a.due_date?`Due ${fmtDate(a.due_date)}`:"No confirmed due date — not added as a deadline"}</p>
                    <blockquote className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-500">“{a.evidence}”</blockquote>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {added ? <><Badge tone="green"><Check className="size-3"/> In My Tasks</Badge>{linked&&<button onClick={()=>toggleTask(linked)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${linked.status==="completed"?"bg-slate-100 text-slate-600":"bg-emerald-600 text-white hover:bg-emerald-700"}`}>{linked.status==="completed"?"Completed ✓ — undo":"Mark complete"}</button>}</>
                      : <button onClick={()=>addTaskFromAction(selected,a)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700"><Plus className="size-3.5"/> Add to My Tasks</button>}
                    </div>
                  </div>;})}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-bold"><MessageCircleQuestion className="size-5 text-blue-600"/> Questions about this notice</h2>
              <p className="mt-1 text-sm text-slate-500">Answers come only from this notice. If it isn&apos;t stated, we&apos;ll say so.</p>
              <div className="mt-3 flex flex-wrap gap-2">{["What is the last date to submit the form?","Which documents do I need?","Am I eligible according to the stated criteria?","What should I do first?"].map(q=><button key={q} onClick={()=>setQuestion(q)} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100">{q}</button>)}</div>
              <div className="mt-4 space-y-3">
                {qa.map((x,i)=><div key={i} className="space-y-2"><div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white">{x.q}</div><div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700"><p>{x.a}</p>{x.sources.length>0&&<p className="mt-2 border-t border-slate-200 pt-2 text-xs italic text-slate-500">Source: “{x.sources[0]}”</p>}</div></div>)}
                {asking&&<p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin"/> Checking the notice…</p>}
              </div>
              <form onSubmit={e=>{e.preventDefault(); ask();}} className="mt-4 flex gap-2">
                <label htmlFor="qa-input" className="sr-only">Ask a question about this notice</label>
                <input id="qa-input" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask about dates, documents, eligibility…" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"/>
                <button disabled={asking||!question.trim()} className="grid size-11 place-items-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" aria-label="Send question"><Send className="size-5"/></button>
              </form>
            </section>
          </div>

          <div className="space-y-5 xl:col-span-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold">Eligibility</h2>
              {selected.analysis.eligibility.length? <ul className="mt-3 space-y-2">{selected.analysis.eligibility.map((e,i)=><li key={i} className="flex gap-2 text-sm text-slate-600"><CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500"/>{e}</li>)}</ul> : <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-500">Not specified in this notice.</p>}
              <h2 className="mt-6 font-bold">Required documents</h2>
              {selected.analysis.required_documents.length? <ul className="mt-3 space-y-2">{selected.analysis.required_documents.map((e,i)=><li key={i} className="flex gap-2 text-sm text-slate-600"><FileText className="mt-0.5 size-4 shrink-0 text-blue-500"/>{e}</li>)}</ul> : <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-500">The notice does not specify additional documents.</p>}
            </section>
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="flex items-center gap-2 font-bold text-amber-900"><CircleHelp className="size-5"/> Not stated in this notice</h2>
              <ul className="mt-3 space-y-2">{selected.analysis.missing_information.map((m,i)=><li key={i} className="flex gap-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0"/>{m}</li>)}</ul>
              <p className="mt-3 text-xs text-amber-700">Missing details are flagged — never invented. Confirm them on the official portal.</p>
            </section>
            {selectedTasks.length>0&&<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Tasks from this notice</h2><div className="mt-3 space-y-3">{selectedTasks.map(t=><TaskCard key={t.id} t={t}/>)}</div></section>}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <button onClick={()=>setShowRaw(v=>!v)} className="flex w-full items-center justify-between font-bold">Original notice text <ChevronRight className={`size-4 transition ${showRaw?"rotate-90":""}`}/></button>
              {showRaw&&<pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">{selected.rawText}</pre>}
              <button onClick={()=>setConfirmDelete(selected)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline"><Trash2 className="size-4"/> Delete this notice</button>
            </section>
          </div>
        </div>
      </div>)}

      {/* ---------- NOTICES ---------- */}
      {view==="notices"&&(<div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold sm:text-3xl">My Notices</h1><p className="mt-1 text-slate-500">{notices.length} notice{notices.length!==1?"s":""} analysed and saved.</p></div><button onClick={()=>setView("analyze")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><Plus className="size-4"/> Analyze new</button></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={nq} onChange={e=>setNq(e.target.value)} placeholder="Search by title or content…" aria-label="Search notices" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/></div>
          <select value={ntype} onChange={e=>setNtype(e.target.value)} aria-label="Filter by category" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium outline-none focus:border-blue-400"><option value="all">All categories</option>{Object.entries(TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        </div>
        {filteredNotices.length===0 ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center"><FileText className="mx-auto size-10 text-slate-300"/><p className="mt-3 font-bold">No notices found</p><p className="text-sm text-slate-500">{notices.length? "Try a different search or category." : "Analyze your first notice to see it here."}</p>{!notices.length&&<button onClick={()=>setView("analyze")} className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Analyze a Notice</button>}</div>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredNotices.map(n=>(
          <article key={n.id} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex flex-wrap gap-1.5"><Badge>{TYPE_LABEL[n.noticeType]||"General"}</Badge><Badge tone="slate">{n.source==="pdf"?"PDF":"Pasted"}</Badge></div>
            <h2 className="mt-3 font-bold leading-snug">{n.title}</h2><p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{n.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs"><Badge tone="green">{n.analysis.action_items.length} actions</Badge><Badge tone={n.analysis.important_dates.some(d=>d.date)?"blue":"amber"}>{n.analysis.important_dates.length? `${n.analysis.important_dates.length} date${n.analysis.important_dates.length>1?"s":""}` : "No dates"}</Badge><Badge tone="slate">{fmtShort(n.createdAt)}</Badge></div>
            <div className="mt-4 flex gap-2"><button onClick={()=>openNotice(n)} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700">View details</button><button aria-label={`Delete ${n.title}`} onClick={()=>setConfirmDelete(n)} className="rounded-xl border border-slate-200 px-3 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4"/></button></div>
          </article>))}</div>}
      </div>)}

      {/* ---------- DEADLINES ---------- */}
      {view==="deadlines"&&(<div className="space-y-5">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">Upcoming Deadlines</h1><p className="mt-1 text-slate-500">Only confirmed dates from your tasks become deadlines — ambiguous dates are never guessed.</p></div>
        {overdue.length>0&&<section><h2 className="mb-3 flex items-center gap-2 font-bold text-red-700"><AlertTriangle className="size-5"/> Overdue ({overdue.length})</h2><div className="space-y-3">{overdue.map(t=><TaskCard key={t.id} t={t} showNotice/>)}</div></section>}
        <section><h2 className="mb-3 font-bold">Coming up</h2><div className="space-y-3">
          {tasks.filter(t=>t.status==="pending"&&t.dueDate&&t.dueDate>=todayISO()).sort((a,b)=>(a.dueDate||"").localeCompare(b.dueDate||"")).map(t=><TaskCard key={t.id} t={t} showNotice/>)}
          {tasks.filter(t=>t.status==="pending"&&t.dueDate&&t.dueDate>=todayISO()).length===0&&<p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No upcoming deadlines. Add tasks from a notice analysis.</p>}
        </div></section>
        {pendingNoDate.length>0&&<section><h2 className="mb-3 font-bold text-slate-600">Pending · date not confirmed ({pendingNoDate.length})</h2><div className="space-y-3">{pendingNoDate.map(t=><TaskCard key={t.id} t={t} showNotice/>)}</div></section>}
      </div>)}

      {/* ---------- TASKS ---------- */}
      {view==="tasks"&&(<div className="space-y-5">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">My Tasks</h1><p className="mt-1 text-slate-500">{stats.pendingTasks} pending · {stats.completedTasks} completed · sorted by due date.</p></div>
        <form onSubmit={saveTask} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">{editing?"Edit task":"Add a custom task"}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="Task title *" aria-label="Task title" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white"/>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm,dueDate:e.target.value})} aria-label="Due date (optional)" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white"/>
              <select value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})} aria-label="Priority" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-400"><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select>
            </div>
            <input value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})} placeholder="Description (optional)" aria-label="Description" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white sm:col-span-2"/>
          </div>
          <div className="mt-3 flex gap-2"><button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">{editing?"Save changes":"Add task"}</button>{editing&&<button type="button" onClick={()=>{setEditing(null); setTaskForm({title:"",description:"",dueDate:"",priority:"medium"});}} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancel</button>}</div>
          <p className="mt-2 text-xs text-slate-400">Leave the date empty if it isn&apos;t confirmed — NoticePilot never invents deadlines.</p>
        </form>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={tq} onChange={e=>setTq(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/></div>
          <select value={tStatus} onChange={e=>setTStatus(e.target.value)} aria-label="Filter by status" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium"><option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option></select>
          <select value={tPri} onChange={e=>setTPri(e.target.value)} aria-label="Filter by priority" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium"><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        </div>
        {overdue.length>0&&tStatus!=="completed"&&<section><h2 className="mb-3 flex items-center gap-2 font-bold text-red-700"><AlertTriangle className="size-5"/> Overdue</h2><div className="space-y-3">{overdue.filter(t=>(tPri==="all"||t.priority===tPri)&&(!tq||t.title.toLowerCase().includes(tq.toLowerCase()))).map(t=><TaskCard key={t.id} t={t} showNotice/>)}</div></section>}
        <div className="space-y-3">
          {filteredTasks.filter(t=>!(t.dueDate&&t.dueDate<todayISO()&&t.status==="pending")).map(t=><TaskCard key={t.id} t={t} showNotice/>)}
          {filteredTasks.length===0&&<div className="rounded-3xl border border-slate-200 bg-white p-10 text-center"><CheckSquare className="mx-auto size-10 text-slate-300"/><p className="mt-3 font-bold">No tasks match</p><p className="text-sm text-slate-500">Add a custom task above, or create tasks from a notice analysis.</p></div>}
        </div>
      </div>)}

      {/* ---------- SETTINGS ---------- */}
      {view==="settings"&&(<div className="mx-auto max-w-2xl space-y-5">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">Settings</h1><p className="mt-1 text-slate-500">How NoticePilot handles your notices.</p></div>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-bold"><Bot className="size-5 text-blue-600"/> Analysis engine</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Current engine: <b>{engine==="gemini"?"Gemini AI (configured)":"Built-in smart extractor"}</b>. {engine==="gemini" ? "Notices are sent to Google Gemini for structured extraction, validated before saving." : "No GEMINI_API_KEY is configured on the server, so notices are processed locally with an evidence-based extractor. Add a Gemini key in the server environment to enable AI mode — the key never reaches your browser."}</p>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-emerald-600"/> Privacy & trust</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
            <li>· Notices and tasks are stored only in this app&apos;s database.</li>
            <li>· Notice text is treated as untrusted data — instructions inside a notice are never followed.</li>
            <li>· Ambiguous dates are shown as “Date not confirmed”, never guessed.</li>
            <li>· Always verify extracted details against the original official notice before acting.</li>
          </ul>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold">Try the demo</h2><p className="mt-2 text-sm text-slate-600">Load the fictional Trinity College sample notice in the analyzer to see deadlines, actions and missing-information flags.</p>
          <button onClick={()=>{setMode("paste"); setText(SAMPLE); setView("analyze");}} className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Open analyzer with sample</button>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-600">
          <h2 className="font-bold text-[#12264d]">Your data</h2><p className="mt-2">{stats.totalNotices} notices · {stats.pendingTasks+stats.completedTasks} tasks stored. Delete any notice from its detail page (its tasks stay, unlinked).</p>
        </section>
      </div>)}
      </>)}
    </main>

    {confirmDelete&&<div className="fixed inset-0 z-50 grid place-items-center bg-[#12264d]/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"><AlertTriangle className="size-8 text-red-500"/><h2 className="mt-3 font-extrabold">Delete this notice?</h2><p className="mt-1 text-sm text-slate-500">“{confirmDelete.title}” and its analysis will be removed. Tasks created from it will be kept.</p>
      <div className="mt-5 flex gap-2"><button onClick={()=>setConfirmDelete(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold">Cancel</button><button onClick={doDeleteNotice} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700">Delete</button></div></div>
    </div>}

    {toast&&<div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#12264d] px-5 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>}
  </div>);
}
