#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/backend/.env"

python3 -c "
import re
p = '$ENV_FILE'
try:
    with open(p, 'r') as f:
        content = f.read()
except FileNotFoundError:
    content = ''

new_line = 'MONGODB_URL=mongodb+srv://rameezahmad649_db_user:Rameez2056@cluster0.w3jpogu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'

if 'MONGODB_URL=' in content:
    content = re.sub(r'MONGODB_URL=.*', new_line, content)
else:
    content += '\n' + new_line + '\n'

with open(p, 'w') as f:
    f.write(content)
"

sudo systemctl restart surveillance-backend
echo "SUCCESS: MongoDB configured and surveillance-backend restarted!"

