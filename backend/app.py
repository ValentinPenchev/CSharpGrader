
import os, uuid, json, re, zipfile, tempfile, subprocess, shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client

app=Flask(__name__)
CORS(app)
SUPABASE_URL=os.environ.get("SUPABASE_URL","")
SUPABASE_SERVICE_KEY=os.environ.get("SUPABASE_SERVICE_KEY","")
BUCKET=os.environ.get("SUPABASE_BUCKET","submissions")
ADMIN_KEY=os.environ.get("ADMIN_KEY","change-me")
sb=create_client(SUPABASE_URL,SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

def admin():
    return request.headers.get("X-Admin-Key")==ADMIN_KEY

def grade(total,maxp):
    if maxp<=0:return 2
    return round(min(6,2+(total/maxp)*4),2)

def read_code(root):
    out=[]
    for p in root.rglob("*.cs"):
        try: out.append(p.read_text(encoding="utf-8",errors="ignore"))
        except: pass
    return "\n".join(out)

def run_build(root):
    projects=list(root.rglob("*.csproj"))
    if not projects:return False,"Не е намерен .csproj."
    try:
        p=subprocess.run(["dotnet","build",str(projects[0]),"--nologo","-v","minimal"],cwd=root,capture_output=True,text=True,timeout=90)
        return p.returncode==0,(p.stdout+"\n"+p.stderr)[-6000:]
    except Exception as e:return False,str(e)

def check_file(path,rules):
    with tempfile.TemporaryDirectory() as td:
        root=os.path.join(td,"project");os.makedirs(root)
        if path.lower().endswith(".zip"):
            with zipfile.ZipFile(path) as z:z.extractall(root)
        else:
            shutil.copy(path,os.path.join(root,os.path.basename(path)))
        code=read_code(__import__("pathlib").Path(root))
        total=0; results=[]; maxp=0
        for r in rules:
            pts=float(r.get("points",0));maxp+=pts;ok=False;msg=""
            typ=r.get("type")
            if typ=="contains":ok=r.get("pattern","") in code
            elif typ=="regex":ok=bool(re.search(r.get("pattern",""),code,re.I|re.M))
            elif typ=="forbidden":ok=not bool(re.search(r.get("pattern",""),code,re.I|re.M))
            elif typ=="build":ok,_=run_build(__import__("pathlib").Path(root))
            if ok:total+=pts
            results.append({"name":r.get("name","Eлемент"),"passed":ok,"points":pts if ok else 0,"max_points":pts})
        buildout=""
        return total,maxp,results

@app.get("/api/health")
def health():return jsonify({"ok":True})

@app.get("/api/tasks/<token>")
def get_task(token):
    if not sb:return jsonify({"error":"Supabase is not configured"}),500
    r=sb.table("assignments").select("id,title,description,max_points,deadline,public_token,status").eq("public_token",token).eq("status","published").single().execute()
    if not r.data:return jsonify({"error":"not found"}),404
    return jsonify(r.data)

@app.get("/api/admin/tasks")
def tasks():
    if not admin():return jsonify({"error":"Unauthorized"}),401
    r=sb.table("assignments").select("*").order("created_at",desc=True).execute()
    tasks=r.data or []
    for t in tasks:
        ss=sb.table("submissions").select("id,student_name,points,grade,status,created_at").eq("assignment_id",t["id"]).order("created_at",desc=True).execute()
        t["submissions"]=ss.data or [];t["submissions_count"]=len(t["submissions"])
    return jsonify(tasks)

@app.post("/api/admin/tasks")
def create_task():
    if not admin():return jsonify({"error":"Unauthorized"}),401
    d=request.get_json()
    token=uuid.uuid4().hex[:12]
    row={"title":d["title"],"description":d.get("description",""),"max_points":d.get("max_points",20),"deadline":d.get("deadline"),"rules":d.get("rules",[]),"public_token":token,"status":"published"}
    r=sb.table("assignments").insert(row).execute()
    return jsonify(r.data[0])

@app.post("/api/submit/<token>")
def submit(token):
    if not sb:return jsonify({"error":"Supabase is not configured"}),500
    task=sb.table("assignments").select("*").eq("public_token",token).eq("status","published").single().execute().data
    if not task:return jsonify({"error":"Заданието не съществува"}),404
    name=request.form.get("student_name","").strip()
    f=request.files.get("file")
    if not name or not f:return jsonify({"error":"Име и файл са задължителни"}),400
    if len(f.read())>50*1024*1024:return jsonify({"error":"Файлът е прекалено голям"}),400
    f.seek(0)
    ext=os.path.splitext(f.filename)[1].lower()
    if ext not in [".zip",".cs",".csproj",".sln"]:return jsonify({"error":"Разрешени са ZIP/C#/csproj/sln"}),400
    uid=uuid.uuid4().hex
    path=f"{task['id']}/{uid}_{f.filename}"
    data=f.read();f.seek(0)
    sb.storage.from_(BUCKET).upload(path,data,{"content-type":f.content_type or "application/octet-stream"})
    row={"assignment_id":task["id"],"student_name":name,"file_path":path,"status":"queued"}
    sub=sb.table("submissions").insert(row).execute().data[0]
    # MVP: code checks can run immediately on Render for console/.NET projects.
    tmp=tempfile.NamedTemporaryFile(delete=False,suffix=ext);tmp.write(data);tmp.close()
    try:
        total,maxp,details=check_file(tmp.name,task.get("rules") or [])
        g=grade(total,float(task["max_points"]))
        sb.table("submissions").update({"points":total,"grade":g,"status":"checked","details":details}).eq("id",sub["id"]).execute()
        return jsonify({"submission_id":sub["id"],"points":total,"max_points":task["max_points"],"grade":g,"details":details})
    except Exception as e:
        sb.table("submissions").update({"status":"error","error":str(e)}).eq("id",sub["id"]).execute()
        return jsonify({"error":"Проверката не успя: "+str(e)}),500
    finally: os.unlink(tmp.name)
