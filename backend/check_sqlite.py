import sqlite3
conn = sqlite3.connect('ai_surveillance.db')

print("=== Users ===")
cursor = conn.execute("SELECT id, email, is_active FROM users")
for row in cursor.fetchall():
    print(f"  id={row[0]} (type={type(row[0]).__name__}), email={row[1]}, active={row[2]}")

print("\n=== Memberships ===")
cursor = conn.execute("SELECT id, user_id, tenant_id, role FROM memberships")
for row in cursor.fetchall():
    print(f"  id={row[0]}, user_id={row[1]}, tenant_id={row[2]}, role={row[3]}")

print("\n=== Tenants ===")
cursor = conn.execute("SELECT id, name, status FROM tenants")
for row in cursor.fetchall():
    print(f"  id={row[0]}, name={row[1]}, status={row[2]}")

conn.close()
