import httpx
import asyncio

async def test_api():
    async with httpx.AsyncClient() as client:
        # 1. Login to get token
        response = await client.post(
            'http://localhost:8000/api/v1/auth/token', 
            data={'username': 'admin@example.com', 'password': 'admin123'}
        )
        token = response.json()['access_token']
        
        headers = {
            'Authorization': f'Bearer {token}',
            'X-Tenant-ID': 'bb398bec-8429-44db-b9ec-b04c3ac81c36'
        }

        # 2. Call /cameras
        response = await client.get('http://localhost:8000/api/v1/cameras', headers=headers)
        print('Cameras Status:', response.status_code)

        # 3. Call /events
        response = await client.get('http://localhost:8000/api/v1/events', headers=headers)
        print('Events Status:', response.status_code)

asyncio.run(test_api())
