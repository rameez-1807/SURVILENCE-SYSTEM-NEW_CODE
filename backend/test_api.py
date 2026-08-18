import httpx
import asyncio

async def test_api():
    async with httpx.AsyncClient() as client:
        # 1. Login to get token
        response = await client.post(
            'http://localhost:8000/api/v1/auth/token', 
            data={'username': 'admin@example.com', 'password': 'admin123'}
        )
        print('Login Status:', response.status_code)
        if response.status_code != 200:
            print(response.text)
            return
            
        token = response.json()['access_token']
        
        # 2. Call /cameras
        response = await client.get(
            'http://localhost:8000/api/v1/cameras',
            headers={'Authorization': f'Bearer {token}'}
        )
        print('Cameras Status:', response.status_code)
        print('Cameras Response:', response.text)

        # 3. Call /events
        response = await client.get(
            'http://localhost:8000/api/v1/events',
            headers={'Authorization': f'Bearer {token}'}
        )
        print('Events Status:', response.status_code)
        print('Events Response:', response.text)

asyncio.run(test_api())
