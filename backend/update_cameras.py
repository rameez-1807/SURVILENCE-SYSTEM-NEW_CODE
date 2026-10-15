import sqlite3
import uuid
import datetime

db_path = 'ai_surveillance.db'
conn = sqlite3.connect(db_path)
now = datetime.datetime.now(datetime.timezone.utc).isoformat()

# Update existing camera to active
conn.execute("UPDATE cameras SET status = 'active' WHERE name = 'Live Camera Scanner'")

# Get tenant_id and site_id
tenant_row = conn.execute("SELECT id FROM tenants LIMIT 1").fetchone()
tenant_id = tenant_row[0] if tenant_row else uuid.uuid4().hex

site_row = conn.execute("SELECT id FROM sites LIMIT 1").fetchone()
if not site_row:
    site_id = uuid.uuid4().hex
    conn.execute(
        "INSERT INTO sites (id, name, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (site_id, "Main Corporate Facility", tenant_id, now, now)
    )
else:
    site_id = site_row[0]

existing_names = [row[0] for row in conn.execute("SELECT name FROM cameras").fetchall()]

cams_to_add = [
    ("Main Entrance & Gate Scanner", "rtsp://192.168.1.101/stream1", "192.168.1.101"),
    ("Corporate Lobby & Reception", "rtsp://192.168.1.102/stream1", "192.168.1.102"),
    ("Perimeter Security & Parking Bay", "rtsp://192.168.1.103/stream1", "192.168.1.103"),
]

for name, stream_path, host in cams_to_add:
    if name not in existing_names:
        cam_id = uuid.uuid4().hex
        conn.execute(
            """INSERT INTO cameras 
               (id, name, protocol, host, stream_path, timezone, tenant_id, site_id, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (cam_id, name, "rtsp", host, stream_path, "UTC", tenant_id, site_id, "active", now, now)
        )
        print(f"Added camera: {name}")

conn.commit()
all_cams = conn.execute("SELECT id, name, status, host FROM cameras").fetchall()
print(f"Total cameras in DB: {len(all_cams)}")
for c in all_cams:
    print(f" - {c[1]} [{c[2]}] ({c[3]})")
conn.close()
