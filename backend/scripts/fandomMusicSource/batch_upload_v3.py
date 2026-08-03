#!/usr/bin/env python3
import sys,json,subprocess,os,glob

TOKEN = json.loads(subprocess.check_output([
    "curl","-s","-X","POST","http://127.0.0.1:3002/api/auth/login",
    "-H","Content-Type: application/json",
    "-d",'{"identifier":"admin","password":"kWMD3SWMRBS7cuSx"}'
], text=True)).get("data",{}).get("token","")

if not TOKEN:
    print("Token failed")
    sys.exit(1)
print("Token OK")

files = sorted(glob.glob("/tmp/batch_upload/补充/*/*.flac"))
SKIP = 112

for i, f in enumerate(files, 1):
    if i <= SKIP:
        continue
    d = os.path.dirname(f)
    adir = os.path.basename(d)
    gid = 3
    if adir.startswith("崩坏星穹铁道"):
        gid = 2
    elif adir.startswith("珍珠之歌"):
        gid = 1

    try:
        tags = subprocess.check_output(["metaflac","--export-tags-to=-",f], text=True, stderr=subprocess.DEVNULL)
        tdict = {}
        for l in tags.split("\n"):
            if "=" in l:
                k, v = l.split("=", 1)
                tdict[k.upper()] = v.strip()
    except:
        tdict = {}

    title = tdict.get("TITLE", os.path.splitext(os.path.basename(f))[0])
    tnum = tdict.get("TRACKNUMBER", "1")
    album = tdict.get("ALBUM", adir)

    cmd = [
        "curl","-s","--max-time","600","-X","POST",
        "http://127.0.0.1:3002/api/tracks/upload?auto_credits=false",
        "-H", f"Authorization: Bearer {TOKEN}",
        "-F", f"tracks=@{f}",
        "-F", f"title_override={title}",
        "-F", f"album_override={album}",
        "-F", f"game_id={gid}",
        "-F", f"track_number_override={tnum}"
    ]
    try:
        r = subprocess.check_output(cmd, text=True, timeout=600)
        d = json.loads(r)
        if d.get("success"):
            ts = d.get("data", {}).get("tracks", [])
            tid = ts[0]["id"] if ts else "?"
            print(f"[{i}] OK #{tid} {title}")
        else:
            err = d.get("error", {}).get("message", "?")
            print(f"[{i}] FAIL {title}: {err}")
    except Exception as e:
        print(f"[{i}] ERR {title}: {e}")
        import traceback
        traceback.print_exc()

print("DONE")
