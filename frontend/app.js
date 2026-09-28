
const A=window.APP_CONFIG;
const app=document.getElementById("app");
const qs=new URLSearchParams(location.search);
const taskToken=qs.get("task");

function layout(body,admin=false){
 app.innerHTML=`<header class="top"><div class="brand">C# <span>Grader</span></div><div class="actions">${admin?'<button class="btn secondary" onclick="studentView()">Ученически линк</button>':''}<button class="btn secondary" onclick="adminView()">Администратор</button></div></header><main class="container">${body}</main><div id="toast" class="toast"></div>`;
}
function toast(s){const x=document.getElementById("toast");x.textContent=s;x.style.display="block";setTimeout(()=>x.style.display="none",3000)}
function adminHeaders(){const k=localStorage.getItem("csharp_grader_admin_key");return k?{"X-Admin-Key":k}:{}}
async function api(path,opt={}){opt.headers={...(opt.headers||{}),...adminHeaders()};const r=await fetch(A.API_URL+path,opt);if(!r.ok)throw new Error(await r.text());return r.json()}

function adminView(){
 if(!localStorage.getItem("csharp_grader_admin_key")){
   const k=prompt("Въведете администраторски ключ:");
   if(!k){return studentPage({title:"C# Grader",description:""});}
   localStorage.setItem("csharp_grader_admin_key",k);
 }
 layout(`<div class="hero"><h1>Администратор</h1><p class="muted">Създавайте задания и следете автоматично проверените работи.</p></div>
 <div class="grid"><div class="card"><h2>Ново задание</h2>
 <label>Име</label><input id="title" placeholder="Напр. YouTube Premium – ООП">
 <label>Описание</label><textarea id="desc" placeholder="Условие и изисквания..."></textarea>
 <label>Максимални точки</label><input id="max" type="number" value="20">
 <label>Краен срок</label><input id="deadline" type="datetime-local">
 <label>Проверки (JSON)</label><textarea id="rules">[
  {"name":"Компилация","type":"build","points":2},
  {"name":"Клас Subscription","type":"contains","pattern":"class Subscription","points":2},
  {"name":"Метод CalculatePrice","type":"contains","pattern":"CalculatePrice","points":2}
]</textarea>
 <button class="btn" onclick="createTask()">Създай задание</button></div>
 <div class="card wide"><h2>Задания</h2><div id="tasks">Зареждане...</div></div></div>`,true);
 loadTasks();
}
async function createTask(){
 try{
  const payload={title:title.value,description:desc.value,max_points:Number(max.value),deadline:deadline.value||null,rules:JSON.parse(rules.value)};
  const r=await api("/admin/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  toast("Заданието е създадено"); loadTasks();
 }catch(e){toast("Грешка: "+e.message)}
}
async function loadTasks(){
 try{const data=await api("/admin/tasks");document.getElementById("tasks").innerHTML=data.map(t=>`
 <div class="card" style="margin:10px 0;box-shadow:none">
 <div class="actions"><b>${esc(t.title)}</b><span class="pill">${t.submissions_count||0} предадени</span><span class="pill">${t.max_points} т.</span></div>
 <p class="muted">${esc(t.description||"")}</p>
 <div class="linkbox">${location.origin+location.pathname}?task=${t.public_token}</div>
 <br><button class="btn secondary" onclick="navigator.clipboard.writeText('${location.origin+location.pathname}?task=${t.public_token}');toast('Линкът е копиран')">Копирай линка</button>
 <div style="margin-top:15px">${(t.submissions||[]).map(s=>`<div class="row"><b>${esc(s.student_name)}</b> — ${s.points}/${t.max_points} т. — <b>${s.grade??"..."}</b> <span class="pill">${s.status}</span></div>`).join("")||'<span class="muted">Няма предадени работи.</span>'}</div>
 </div>`).join("")||'<p class="muted">Все още няма задания.</p>'}catch(e){document.getElementById("tasks").textContent="Не може да се зареди."}
}
function studentView(){location.href=location.pathname+(taskToken?("?task="+taskToken):"")}
function adminView2(){adminView()}
window.adminView=adminView; window.studentView=studentView; window.createTask=createTask; window.loadTasks=loadTasks;

function studentPage(task){
 layout(`<div class="hero"><h1>${esc(task.title)}</h1><p class="muted">Предайте вашата C# програма. Системата ще я провери автоматично.</p></div>
 <div class="grid"><div class="card wide"><h2>Задание</h2><p>${esc(task.description||"")}</p>
 <div class="pill">Максимум: ${task.max_points} точки</div>
 ${task.deadline?`<div class="pill">Краен срок: ${new Date(task.deadline).toLocaleString('bg-BG')}</div>`:""}
 </div><div class="card wide"><h2>Предаване</h2>
 <label>Име и фамилия</label><input id="studentName" placeholder="Иван Иванов">
 <label>C# проект</label><div class="drop"><input id="file" type="file" accept=".zip,.cs,.csproj,.sln"></div>
 <p class="muted">Препоръчително: ZIP с .sln/.csproj и всички файлове на проекта.</p>
 <button class="btn" onclick="submitWork('${task.public_token}')">Предай програмата</button>
 <div id="status" style="margin-top:18px"></div>
 </div></div>`);
}
async function submitWork(token){
 const name=document.getElementById("studentName").value.trim(), f=document.getElementById("file").files[0], s=document.getElementById("status");
 if(!name||!f){s.innerHTML='<span class="bad">Попълнете име и изберете файл.</span>';return}
 const fd=new FormData();fd.append("student_name",name);fd.append("file",f);
 s.textContent="Качване и проверка...";
 try{const r=await api("/submit/"+token,{method:"POST",body:fd});s.innerHTML=`<div class="card" style="box-shadow:none;background:#f7fff9"><h3>Предаването е прието ✓</h3><p>Резултат: <b>${r.points}/${r.max_points} точки</b></p><p>Оценка: <b>${r.grade}</b></p></div>`}catch(e){s.innerHTML='<span class="bad">Грешка при предаването: '+esc(e.message)+'</span>'}
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

async function init(){
 if(taskToken){try{studentPage(await api("/tasks/"+taskToken))}catch(e){layout("<div class='card'><h2>Заданието не е намерено</h2><p class='muted'>Проверете линка.</p></div>")}}
 else adminView();
}
init();
