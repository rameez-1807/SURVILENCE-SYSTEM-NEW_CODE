"""Quick API test for attendance endpoints."""
import urllib.request, json, urllib.parse, sys

# 1. Login
login_data = urllib.parse.urlencode({'username': 'admin@example.com', 'password': 'admin123'}).encode()
req = urllib.request.Request('http://localhost:8000/api/v1/auth/token', data=login_data, method='POST')
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())['access_token']
print('[1] LOGIN OK')

# 2. Register employee EMP-001
emp_data = json.dumps({'name': 'Ahmed Khan', 'employee_id': 'EMP-001', 'department': 'Engineering', 'designation': 'Developer'}).encode()
req2 = urllib.request.Request('http://localhost:8000/api/v1/employees/register', data=emp_data, headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, method='POST')
try:
    resp2 = urllib.request.urlopen(req2)
    emp = json.loads(resp2.read())
    print('[2] EMPLOYEE REGISTERED:', emp['name'], emp['employee_id'])
except urllib.error.HTTPError as e:
    body = json.loads(e.read().decode())
    print('[2] Employee note:', body.get('detail'))

# 3. Create attendance record
att_data = json.dumps({'employee_id': 'EMP-001', 'attendance_date': '2026-08-19', 'first_seen': '09:00:00', 'last_seen': '17:30:00', 'camera_name': 'Manual Entry', 'confidence': 100.0}).encode()
req3 = urllib.request.Request('http://localhost:8000/api/v1/attendance', data=att_data, headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, method='POST')
resp3 = urllib.request.urlopen(req3)
rec = json.loads(resp3.read())
print('[3] ATTENDANCE CREATED:', rec['employee_name'], '| date:', rec['attendance_date'], '|', rec['first_seen'], '->', rec['last_seen'])

# 4. List attendance
req4 = urllib.request.Request('http://localhost:8000/api/v1/attendance', headers={'Authorization': 'Bearer ' + token})
resp4 = urllib.request.urlopen(req4)
data = json.loads(resp4.read())
print('[4] LIST OK: total =', data['total'])
for item in data['items']:
    print('  ->', item['employee_name'], item['employee_id'], '|', item['attendance_date'], '|', item['first_seen'], '-', item['last_seen'])

print('\nAll tests PASSED!')
