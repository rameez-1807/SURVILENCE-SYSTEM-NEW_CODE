#!/usr/bin/env python3
"""
Feed HRMS Attendance Data into AI Surveillance System
Fetches real personnel & biometric manual attendance logs from:
  - https://hrmsapi.leanxpert.in/api/EmpPersDtls
  - https://hrmsapi.leanxpert.in/api/Supervisor
  - https://hrmsapi.leanxpert.in/api/ManualAttendance

Inserts/Upserts in high-performance batches into:
  - `employees` (Personnel Directory)
  - `attendance_records` (Daily first_seen / last_seen)
  - `recognition_history` (Individual punch events)
"""

import os
import sys
import json
import uuid
import re
import urllib.request
from datetime import datetime, time, timezone
from collections import defaultdict
import pymysql

sys.stdout.reconfigure(line_buffering=True)

DB_HOST = os.getenv("MYSQL_HOST", "srv1100.hstgr.io")
DB_USER = os.getenv("MYSQL_USER", "u963801592_AISURVILENCEU")
DB_PASS = os.getenv("MYSQL_PASSWORD", "AiSURV!LENCE3026")
DB_NAME = os.getenv("MYSQL_DATABASE", "u963801592_AISURVILENCE")
DB_PORT = int(os.getenv("MYSQL_PORT", "3306"))

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

def fetch_json(url, timeout=20):
    print(f" -> Fetching {url} ...", flush=True)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

def parse_time_str(t_str):
    if not t_str or not isinstance(t_str, str):
        return None
    t_str = t_str.strip()
    if not t_str:
        return None
    
    formats = [
        "%H:%M:%S",
        "%H:%M",
        "%I:%M %p",
        "%I:%M:%S %p",
        "%I:%M%p",
        "%H:%M:%S.%f",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(t_str, fmt).time()
        except ValueError:
            pass
            
    m = re.match(r'(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?', t_str, re.IGNORECASE)
    if m:
        hh = int(m.group(1))
        mm = int(m.group(2))
        ss = int(m.group(3)) if m.group(3) else 0
        ampm = m.group(4)
        if ampm:
            if ampm.upper() == 'PM' and hh < 12:
                hh += 12
            elif ampm.upper() == 'AM' and hh == 12:
                hh = 0
        return time(hh, mm, ss)
    return None

def parse_date_str(d_str):
    if not d_str or not isinstance(d_str, str):
        return None
    d_str = d_str.strip()
    if not d_str:
        return None
    try:
        clean = d_str.split("Z")[0].split("T")[0]
        return datetime.strptime(clean, "%Y-%m-%d").date()
    except Exception:
        return None

def sync_hrms_data():
    print("=" * 70, flush=True)
    print(" HRMS ATTENDANCE & PERSONNEL INGESTION PIPELINE", flush=True)
    print("=" * 70, flush=True)

    # 1. Fetch HRMS Datasets
    print("\n[1/5] Fetching personnel data from HRMS APIs...", flush=True)
    emp_pers_raw = fetch_json('https://hrmsapi.leanxpert.in/api/EmpPersDtls')
    print(f"    Loaded {len(emp_pers_raw)} profiles from /api/EmpPersDtls", flush=True)
    
    supervisors_raw = fetch_json('https://hrmsapi.leanxpert.in/api/Supervisor')
    print(f"    Loaded {len(supervisors_raw)} roles from /api/Supervisor", flush=True)
    
    attendance_raw = fetch_json('https://hrmsapi.leanxpert.in/api/ManualAttendance')
    print(f"    Loaded {len(attendance_raw)} attendance punches from /api/ManualAttendance", flush=True)

    if not attendance_raw:
        print("[ERROR] No attendance records returned from HRMS.", flush=True)
        return {"error": "No attendance records returned from HRMS"}

    # 2. Build Personnel Catalog
    print("\n[2/5] Compiling and resolving employee profiles...", flush=True)
    employees_catalog = {}  # key: empRegId (int/str)
    
    for p in emp_pers_raw:
        eid = p.get("empPersDtlId")
        name = (p.get("fullName") or "").strip()
        if eid and name and name.lower() not in ["string", "emp_name"]:
            employees_catalog[eid] = {
                "name": name,
                "employee_id": f"EMP-{eid:03d}" if isinstance(eid, int) else f"EMP-{eid}",
                "department": "Engineering" if eid in [5, 6, 10, 36, 42, 43, 58] else "General",
                "designation": "Staff",
            }
            
    for s in supervisors_raw:
        eid = s.get("empRegId")
        if eid in employees_catalog:
            dept = s.get("departmentName")
            desig = s.get("designationName")
            if dept:
                employees_catalog[eid]["department"] = dept.strip()
            if desig:
                employees_catalog[eid]["designation"] = desig.strip()
                
    for punch in attendance_raw:
        eid = punch.get("empRegId")
        if not eid or eid == 0:
            continue
        pname = (punch.get("empRegName") or "").strip()
        if pname and pname.lower() not in ["string", "emp_name"]:
            if eid not in employees_catalog:
                employees_catalog[eid] = {
                    "name": pname,
                    "employee_id": f"EMP-{eid:03d}" if isinstance(eid, int) else f"EMP-{eid}",
                    "department": "Operations",
                    "designation": "Staff",
                }
            elif employees_catalog[eid]["name"].lower() in ["string", "emp_name"]:
                employees_catalog[eid]["name"] = pname

    print(f"    Resolved {len(employees_catalog)} distinct active employees.", flush=True)

    # 3. Connect to Database
    print(f"\n[3/5] Connecting to MySQL database at {DB_HOST}...", flush=True)
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=False,
        charset='utf8mb4'
    )
    cursor = conn.cursor()

    # 4. Upsert Employees
    print("\n[4/5] Upserting employees into database...", flush=True)
    cursor.execute("SELECT id, employee_id, name, department, designation FROM employees")
    existing_db_employees = {row[1]: {"uuid": row[0], "name": row[2], "dept": row[3], "desig": row[4]} for row in cursor.fetchall()}
    
    emp_id_to_uuid = {}
    emp_inserts = []
    emp_updates = []
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    for eid, emp_data in employees_catalog.items():
        emp_code = emp_data["employee_id"]
        emp_name = emp_data["name"]
        emp_dept = emp_data["department"]
        emp_desig = emp_data["designation"]

        if emp_code in existing_db_employees:
            existing = existing_db_employees[emp_code]
            emp_uuid = existing["uuid"]
            emp_id_to_uuid[eid] = emp_uuid
            # Only update if fields actually changed
            if existing["name"] != emp_name or existing["dept"] != emp_dept or existing["desig"] != emp_desig:
                emp_updates.append((emp_name, emp_dept, emp_desig, emp_uuid))
        else:
            new_uuid = str(uuid.uuid4())
            emp_inserts.append((new_uuid, emp_name, emp_code, emp_dept, emp_desig, now_utc))
            emp_id_to_uuid[eid] = new_uuid
            existing_db_employees[emp_code] = {"uuid": new_uuid, "name": emp_name, "dept": emp_dept, "desig": emp_desig}

    if emp_updates:
        cursor.executemany(
            "UPDATE employees SET name=%s, department=%s, designation=%s WHERE id=%s",
            emp_updates
        )
    if emp_inserts:
        cursor.executemany(
            """INSERT INTO employees (id, name, employee_id, department, designation, face_encoding, created_at)
               VALUES (%s, %s, %s, %s, %s, NULL, %s)""",
            emp_inserts
        )
    conn.commit()
    print(f"    Employees: {len(emp_inserts)} inserted, {len(emp_updates)} updated.", flush=True)

    # 5. Process and Upsert Attendance Records
    print("\n[5/5] Processing attendance punches and inserting daily records...", flush=True)
    daily_attendance = defaultdict(lambda: {"times": [], "camera": "HRMS-Biometric"})
    raw_punches = []

    for r in attendance_raw:
        eid = r.get("empRegId")
        if not eid or eid not in emp_id_to_uuid:
            continue
            
        emp_uuid = emp_id_to_uuid[eid]
        date_obj = parse_date_str(r.get("date"))
        if not date_obj:
            continue
            
        punch_times = []
        for tf in [r.get("time"), r.get("inTime"), r.get("outTime")]:
            pt = parse_time_str(tf)
            if pt:
                punch_times.append(pt)
                
        if not punch_times:
            raw_dt = r.get("date", "")
            if "T" in raw_dt and raw_dt.split("T")[1] != "00:00:00":
                pt = parse_time_str(raw_dt.split("T")[1])
                if pt:
                    punch_times.append(pt)
            if not punch_times:
                punch_times.append(time(9, 0, 0))

        cam = (r.get("locationIn") or r.get("locationOut") or "unified_system").strip()
        if not cam or cam == "None":
            cam = "HRMS-Biometric"

        for pt in punch_times:
            daily_attendance[(emp_uuid, date_obj)]["times"].append(pt)
            daily_attendance[(emp_uuid, date_obj)]["camera"] = cam
            
            combined_dt = datetime.combine(date_obj, pt).strftime("%Y-%m-%d %H:%M:%S")
            raw_punches.append((
                str(uuid.uuid4()),
                emp_uuid,
                employees_catalog[eid]["employee_id"],
                employees_catalog[eid]["name"],
                99.0,
                cam,
                r.get("type") or "Present",
                combined_dt
            ))

    cursor.execute("SELECT id, employee_uuid, date, first_seen, last_seen FROM attendance_records")
    existing_attendance = {}
    for row in cursor.fetchall():
        fs_str = str(row[3]) if row[3] else ""
        ls_str = str(row[4]) if row[4] else ""
        existing_attendance[(row[1], row[2])] = {"id": row[0], "first_seen": fs_str, "last_seen": ls_str}

    att_inserts = []
    att_updates = []

    for (emp_uuid, att_date), att_info in daily_attendance.items():
        times = att_info["times"]
        first_seen = min(times).strftime("%H:%M:%S")
        last_seen = max(times).strftime("%H:%M:%S")
        camera_name = att_info["camera"]
        confidence = 98.5

        key = (emp_uuid, att_date)
        if key in existing_attendance:
            existing = existing_attendance[key]
            rec_id = existing["id"]
            # Only update if first_seen is earlier or last_seen is later
            if first_seen < existing["first_seen"] or last_seen > existing["last_seen"]:
                att_updates.append((first_seen, last_seen, camera_name, confidence, rec_id))
        else:
            new_att_id = str(uuid.uuid4())
            att_inserts.append((new_att_id, emp_uuid, att_date, first_seen, last_seen, camera_name, confidence))
            existing_attendance[key] = {"id": new_att_id, "first_seen": first_seen, "last_seen": last_seen}

    if att_updates:
        cursor.executemany(
            """UPDATE attendance_records
               SET first_seen = LEAST(first_seen, %s),
                   last_seen = GREATEST(last_seen, %s),
                   camera_name = %s,
                   confidence = %s
               WHERE id = %s""",
            att_updates
        )
    if att_inserts:
        cursor.executemany(
            """INSERT INTO attendance_records (id, employee_uuid, date, first_seen, last_seen, camera_name, confidence)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            att_inserts
        )
    conn.commit()
    print(f"    Attendance records: {len(att_inserts)} inserted, {len(att_updates)} updated.", flush=True)

    # 6. Recognition History
    cursor.execute("SELECT COUNT(*) FROM recognition_history")
    existing_rec_count = cursor.fetchone()[0]
    
    if existing_rec_count < 100 and raw_punches:
        cursor.executemany(
            """INSERT INTO recognition_history 
               (id, employee_uuid, employee_id, employee_name, confidence, camera_name, status, timestamp)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            raw_punches
        )
        conn.commit()
        print(f"    Inserted {len(raw_punches)} recognition event history logs.", flush=True)
    else:
        print(f"    Recognition history already has {existing_rec_count} entries.", flush=True)

    # Final summary check
    cursor.execute("SELECT COUNT(*) FROM employees")
    total_emp = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM attendance_records")
    total_att = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM recognition_history")
    total_rec = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    print("\n" + "=" * 70, flush=True)
    print(" HRMS DATA INGESTION COMPLETED SUCCESSFULLY!", flush=True)
    print(f" Total Employees in DB:          {total_emp}", flush=True)
    print(f" Total Attendance Records in DB: {total_att}", flush=True)
    print(f" Total Recognition Logs in DB:   {total_rec}", flush=True)
    print("=" * 70, flush=True)

    return {
        "status": "success",
        "employees_total": total_emp,
        "employees_synced": len(employees_catalog),
        "attendance_records_total": total_att,
        "attendance_synced": len(daily_attendance),
        "recognition_logs_total": total_rec,
    }

if __name__ == "__main__":
    result = sync_hrms_data()
    sys.exit(0 if result.get("status") == "success" else 1)
