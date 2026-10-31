import asyncio
from init_db import init_db_and_seed

if __name__ == "__main__":
    asyncio.run(init_db_and_seed())
