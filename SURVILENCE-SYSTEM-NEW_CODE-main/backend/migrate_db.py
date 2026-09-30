import sqlite3

def migrate():
    conn = sqlite3.connect('ai_surveillance.db')
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(vehicle_records)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Columns before migration:", columns)
    
    if 'location_spot' not in columns:
        cursor.execute("ALTER TABLE vehicle_records ADD COLUMN location_spot TEXT DEFAULT 'Apartment Main Gate'")
        conn.commit()
        print("Successfully added location_spot column to vehicle_records table!")
    else:
        print("Column location_spot already exists.")

    cursor.execute("PRAGMA table_info(vehicle_records)")
    print("Columns after migration:", [row[1] for row in cursor.fetchall()])
    conn.close()

if __name__ == "__main__":
    migrate()
