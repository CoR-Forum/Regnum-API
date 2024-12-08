# Sylent-X Node.js API

## Setup

Requires Node 22.x+

```
npm install
nodemon index.js
```

Example .env

```
# MongoDB Configuration
MONGO_URI=mongodb://admin:<password>@cax.treudler.net:27017/

# Application Configuration
NODE_ENV=development
PORT=3000
BASE_PATH=/v1
BASE_URL=http://localhost:3000

# Email Configuration
EMAIL_HOST=mail.sylent-x.com
EMAIL_NAME=Sylent-X Support (DEV)
EMAIL_PASS=<email_password>
EMAIL_PORT=587
EMAIL_SURE=true
EMAIL_USER=support@sylent-x.com

# Discord Webhook Configuration
DISCORD_FEEDBACK_WEBHOOK_URL=<discord_feedback_webhook_url>
DISCORD_LOG_WEBHOOK_URL=<discord_log_webhook_url>
DISCORD_LOGIN_WEBHOOK_URL=<discord_login_webhook_url>

# Discord Bot Configuration
DISCORD_BOT=true
DISCORD_BOT_TOKEN=<discord_bot_token>
DISCORD_ADMINS=188703762167234561,197880680619835392,765232161921433622

# Discord oAuth Configuration
DISCORD_CLIENT_ID=<discord_client_id>
DISCORD_CLIENT_SECRET=<discord_client_secret>

# JWT Configuration
JWT_SECRET=<jwt_secret>
```