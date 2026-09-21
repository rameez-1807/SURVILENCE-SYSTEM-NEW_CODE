import sys
import sqlite3
from sqlalchemy import create_engine, MetaData, text
import json
import uuid

SQLITE_DB_PATH = "./ai_surveillance.db"
SUPABASE_URL = "postgresql+psycopg://postgres:suHH6zklTgKZoqS8@db.ofknpvaxynvokuzfkwds.supabase.co:5432/postgres"

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def migrate_data():
    print("Starting data migration from SQLite to Supabase PostgreSQL...")
    
    # Connect to SQLite natively
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = dict_factory
    cursor = sqlite_conn.cursor()

    pg_engine = create_engine(SUPABASE_URL)
    metadata = MetaData()
    metadata.reflect(bind=pg_engine)
    
    with pg_engine.connect() as pg_conn:
        with pg_conn.begin():
            # Disable triggers/FK checks temporarily
            pg_conn.execute(text("SET session_replication_role = 'replica';"))
            
            for table in metadata.sorted_tables:
                print(f"Migrating table: {table.name}...")
                
                cursor.execute(f"SELECT * FROM {table.name}")
                rows = cursor.fetchall()
                
                if not rows:
                    print(f"  -> No data in {table.name}, skipping.")
                    continue
                    
                # Clean data before insert
                for row in rows:
                    for col in table.columns:
                        col_name = col.name
                        val = row.get(col_name)
                        
                        if val is None:
                            continue
                            
                        # Handle booleans
                        if str(col.type) == 'BOOLEAN':
                            row[col_name] = True if val in (1, '1', 'true', 'True', True) else False
                            
                        # Handle UUIDs (SQLite sometimes stores hex without hyphens)
                        if 'UUID' in str(col.type):
                            if isinstance(val, str) and len(val) == 32:
                                row[col_name] = str(uuid.UUID(val))
                            elif isinstance(val, bytes):
                                row[col_name] = str(uuid.UUID(bytes=val))
                                
                        # Handle JSON
                        if 'JSON' in str(col.type):
                            if isinstance(val, str):
                                try:
                                    row[col_name] = json.loads(val)
                                except:
                                    pass

                # Insert into PG
                pg_conn.execute(table.insert(), rows)
                print(f"  -> Migrated {len(rows)} rows.")

            pg_conn.execute(text("SET session_replication_role = 'origin';"))
            print("Migration completed successfully!")

if __name__ == "__main__":
    migrate_data()
