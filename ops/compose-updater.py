#!/usr/bin/env python3
"""Run from cron as the owner of the Compose project. Requires Python 3 and Docker Compose."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time

IMAGE = "ghcr.io/gmbehappy/garage-admin"
DIGEST = re.compile(r"sha256:[0-9a-f]{64}")


def run(*args, timeout=180):
    return subprocess.run(args, text=True, stdout=subprocess.PIPE, check=True,
                          timeout=timeout).stdout.strip()


def write(path, data, mode=0o600):
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as temp:
        temp.write(data)
        temp.flush()
        os.fsync(temp.fileno())
        os.chmod(temp.name, mode)
    os.replace(temp.name, path)


def jsonfile(path, obj, mode=0o600):
    write(path, json.dumps(obj), mode)


def image_digest(image):
    refs = json.loads(run("docker", "image", "inspect", "-f", "{{json .RepoDigests}}", image))
    for ref in refs or []:
        repo, _, digest = ref.partition("@")
        if repo == IMAGE and DIGEST.fullmatch(digest):
            return digest
    raise ValueError("Installed image is not an official GHCR image")


def change_image(path, service, digest):
    # Permit a literal official image in a normal block-style Compose service.
    # Edit only that one line, leaving other services, env and volume definitions intact.
    lines = path.read_text().splitlines(keepends=True)
    sections = [m for m,l in enumerate(lines) if re.fullmatch(r"services:\s*", l)]
    if len(sections) != 1:
        raise ValueError("Expected one services section")
    in_service = False
    positions = []
    for i in range(sections[0]+1,len(lines)):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            break
        if re.match(r"^  \S",line):
            in_service = line.strip() == service+":"
        if in_service and re.match(r"^    image:\s+",line):
            positions.append(i)
    if len(positions)!=1:
        raise ValueError("Expected exactly one image in the specified service")
    i = positions[0]
    old = lines[i].strip().partition(":")[2].strip().strip("'\042")
    if not (old.startswith(IMAGE+":") or old.startswith(IMAGE+"@sha256:")):
        raise ValueError("Refusing to change a different image")
    lines[i] = "    image: "+IMAGE+"@"+digest+"\n"
    write(path, "".join(lines), stat.S_IMODE(path.stat().st_mode))


def request_target(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    with os.fdopen(fd) as f:
        s=os.fstat(f.fileno())
        if not stat.S_ISREG(s.st_mode) or s.st_size>256:
            raise ValueError("Invalid request file")
        target=json.load(f)["target"]
    if not isinstance(target,str) or not DIGEST.fullmatch(target):
        raise ValueError("Invalid digest")
    return target


def tick(compose, service, root):
    queue,status=root/"queue",root/"status"
    for path in [root,queue,status]:
        path.mkdir(mode=0o755,exist_ok=True)
    lock=(root/"lock").open("a")
    try:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        return
    dc=["docker","compose","-f",str(compose)]
    statefile=status/"worker.json"
    request=queue/"request.json"
    claimed=root/"claimed"
    journal=root/"transaction.json"
    state=json.loads(statefile.read_text()) if statefile.exists() else {
        "phase":"idle","current":None,"target":None,"message":"Host updater ready."}
    def report(phase,message,target=None):
        state.update(phase=phase,message=message,target=target,checkedAt=int(time.time()*1000))
        jsonfile(statefile,state,0o644)
    def installed():
        cid=run(*dc,"ps","-q",service)
        configured=run("docker","inspect","-f","{{.Config.Image}}",cid)
        prefix=IMAGE+"@"
        if configured.startswith(prefix) and DIGEST.fullmatch(configured[len(prefix):]):
            # A running pinned container keeps its digest even when Docker drops
            # the old RepoDigests entry after the mutable latest tag moves.
            return configured[len(prefix):]
        return image_digest(run("docker","inspect","-f","{{.Image}}",cid))
    def start(target):
        change_image(compose,service,target)
        run(*dc,"config","--quiet")
        run(*dc,"up","-d","--no-build","--no-deps",service)
        cid=run(*dc,"ps","-q",service)
        probe='const u="http://127.0.0.1:"+(process.env.PORT||3000);const a=await fetch(u+"/");const b=await fetch(u+"/api/audit");if(!a.ok||!(await a.text()).includes("Storage console")||b.status!==401)process.exit(1)'
        for _ in range(15):
            try:
                run("docker","exec",cid,"bun","-e",probe,timeout=8)
                if installed()==target:
                    return
            except (subprocess.SubprocessError,ValueError):
                pass
            time.sleep(2)
        raise RuntimeError("Replacement service failed startup verification")
    def recover():
        txn=json.loads(journal.read_text())
        start(txn["previous"])
        state["current"]=txn["previous"]
        report("failed","Upgrade interrupted or unhealthy. Previous image restored.",txn["target"])
        journal.unlink()
        claimed.unlink(missing_ok=True)
    if journal.exists():
        recover()
        return
    state["current"]=installed()
    if not claimed.exists() and not request.exists():
        report(state["phase"],state["message"],state["target"])
        return
    if not claimed.exists():
        os.replace(request,claimed)
    target=None
    try:
        target=request_target(claimed)
        if target==state["current"]:
            report("installed","Published image is installed.",target)
            return
        report("installing","Verifying and pulling the official latest image.",target)
        # Keep the exact prior digest available for rollback.
        run("docker","pull",IMAGE+"@"+state["current"],timeout=600)
        run("docker","pull",IMAGE+":latest",timeout=600)
        if image_digest(IMAGE+":latest")!=target:
            raise ValueError("Published release changed; check again")
        previous=state["current"]
        jsonfile(journal,{"previous":previous,"target":target})
        start(target)
        state["current"]=target
        report("installed","Upgrade completed and the console passed its health check.",target)
        journal.unlink()
    except Exception as exc:
        print(type(exc).__name__,str(exc),file=sys.stderr)
        if journal.exists():
            recover()
        else:
            report("failed","Could not verify or pull the requested release. Check again.",target)
    finally:
        if not journal.exists():
            claimed.unlink(missing_ok=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compose",required=True,type=Path)
    parser.add_argument("--service",default="console")
    parser.add_argument("--state",required=True,type=Path)
    args=parser.parse_args()
    tick(args.compose.resolve(),args.service,args.state.resolve())
