"""Seed the local SQLite database with admin user and default tenant."""
import sqlite3
import uuid
import bcrypt
from datetime import datetime

db_path = 'ai_surveillance.db'
conn = sqlite3.connect(db_path)

# Check if admin already exists
cursor = conn.execute("SELECT id FROM users WHERE email = ?", ('admin@example.com',))
if cursor.fetchone():
    print("Admin user already exists.")
    conn.close()
    exit()

# Create hashed password
password = 'admin123'
salt = bcrypt.gensalt()
hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

tenant_id = 'bb398bec-8429-44db-b9ec-b04c3ac81c36'
user_id = str(uuid.uuid4())
now = datetime.utcnow().isoformat()

# Check if tenant exists
cursor = conn.execute("SELECT id FROM tenants WHERE id = ?", (tenant_id,))
if not cursor.fetchone():
    print("Creating default tenant...")
    conn.execute(
        "INSERT INTO tenants (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (tenant_id, 'Default Organization', 'active', now, now)
    )

print("Creating admin user...")
conn.execute(
    "INSERT INTO users (id, email, hashed_password, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    (user_id, 'admin@example.com', hashed, 1, now, now)
)

print("Creating membership...")
membership_id = str(uuid.uuid4())
conn.execute(
    "INSERT INTO memberships (id, user_id, tenant_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    (membership_id, user_id, tenant_id, 'platform_admin', now, now)
)

conn.commit()
conn.close()
print("SQLite database seeded successfully!")
print(f"  Email: admin@example.com")
print(f"  Password: admin123")
