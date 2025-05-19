# regnumstarter Node.js API

API for the new [RegnumStarter v6](https://github.com/CoR-Forum/RegnumStarter)

## API Documentation

- ``/v1`` - System Status
- ``/v1/warstatus`` - Regnum Warstatus
- ``/v1/bosses/respawns`` - Boss Respawns

There are way more API endpoints, but they are not documentated.

# Getting started

## Option 1: Docker Quickstart

1. Create ``docker-compose.yml``:

```docker
services:
  regnum-api:
    image: ghcr.io/cor-forum/regnum-api:latest
    ports:
      - "3333:3333"
    volumes:
      - ./.env:/app/.env
    restart: unless-stopped
    depends_on:
      - mongodb
    networks:
      - backend-network

  mongodb:
    image: mongo:latest
    container_name: mongodb
    restart: always
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=changeme
      - MONGO_INITDB_DATABASE=admin
    volumes:
      - ./mongodb:/data/db
    networks:
      - backend-network

networks:
  backend-network:
    name: ${COMPOSE_PROJECT_NAME}_backend-network
    driver: bridge
```

2. Create ``.env`` file:

```env
    # MongoDB Configuration
    MONGO_URI=mongodb://<mongodb_user>:<mongodb_password>@mongodb:27017/

    # Woltlab MySQL Configuration
    MYSQL_HOST=<mysql_host>
    MYSQL_PORT=<mysql_port>
    MYSQL_USER=<mysql_user>
    MYSQL_PASSWORD=<mysql_password>
    MYSQL_DATABASE=<mysql_database>

    # Woltlab API Configuration
    WOLTLAB_API_URL=<woltlab_api_url>
    WOLTLAB_API_KEY=<woltlab_api_key>

    # Application Configuration
    NODE_ENV=development
    PORT=3000
    BASE_PATH=/v1
    BASE_URL=http://localhost:3333

    # Email Configuration
    EMAIL_HOST=mail.treudler.net
    EMAIL_NAME=CoR-Forum Support
    EMAIL_PASS=<email_password>
    EMAIL_PORT=587
    EMAIL_SURE=true
    EMAIL_USER=system@treudler.net

    # Discord Bot Configuration
    DISCORD_BOT=true
    DISCORD_BOT_TOKEN=<discord_bot_token>
    # the following tokens belong to joshua and manu
    DISCORD_ADMINS=188703762167234561,197880680619835392
    DISCORD_CHANNEL_ID_WARSTATUS=<discord_channel_id>

    # Discord Channels
    DISCORD_LOG_CHANNEL_ID=<id>
    DISCORD_LOGIN_CHANNEL_ID=<id>
    DISCORD_WARSTATUS_CHANNEL_ID=<id>

    # Discord oAuth Configuration
    DISCORD_CLIENT_ID=<discord_client_id>
    DISCORD_CLIENT_SECRET=<discord_client_secret>

    # JWT Configuration
    JWT_SECRET=<jwt_secret>
    ```

3. Add this API file to your Woltlab Burning Board 5.3 installation (make sure to fill ``API_KEY``)


```php
    <?php
    // Built for WCF 5.3.0

    // Include necessary WCF files
    require_once __DIR__ . '/global.php'; // Adjust the path to your global.php

    use wcf\system\user\authentication\UserAuthenticationFactory;

    // Define the API key (this should be stored securely and kept confidential)
    define('API_KEY', 'supersecretkey');

    // Set the header for JSON responses
    header('Content-Type: application/json');

    // Check if the API key is provided in the request headers
    $apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';

    // Validate the provided API key
    if ($apiKey !== API_KEY) {
        echo json_encode(['success' => false, 'error' => 'Unauthorized access, invalid API key.']);
        exit;
    }

    // Get the request URI to determine the endpoint
    $requestUri = $_SERVER['REQUEST_URI'];

    // Check if the request is directed to the /api.php/login endpoint
    if (preg_match('#^/api\.php/login$#', $requestUri)) {
        // If the request is for the login endpoint, call the login function
        loginEndpoint();
    } else {
        // If the endpoint is invalid, return an error message
        echo json_encode(['success' => false, 'error' => 'Invalid endpoint.']);
    }

    // Function for the login endpoint
    function loginEndpoint()
    {
        // Get the username and password from POST data
        $username = isset($_POST['username']) ? trim($_POST['username']) : '';
        $password = isset($_POST['password']) ? $_POST['password'] : '';

        // Check if both username and password are provided
        if (empty($username) || empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Username and password are required.']);
            exit;
        }

        try {
            // Attempt to log in the user manually using the provided username and password
            $user = UserAuthenticationFactory::getInstance()->getUserAuthentication()->loginManually($username, $password);

            if ($user) {
                // If login is successful, return the user data (userID, username, email)
                echo json_encode([
                    'success' => true,
                    'userID' => $user->userID,
                    'username' => $user->username,
                    'email' => $user->email,
                ]);
            } else {
                // If login fails, return an error message
                echo json_encode(['success' => false, 'error' => 'Invalid username or password.']);
            }
        } catch (\Exception $e) {
            // Catch any exceptions and return the error message
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    ```

4. Manage the docker compose stack:

```
docker compose help
```

## Option 2: Bare Metal Node Setup

Everything

1. Host with Node 22.11+
2. Clone the repository.
3. Create .env file and WoltLab API file as given for Docker setup.
4. Install node packages
    ```sh
    npm install
    ```

5. Run the API
    ```
    nodemon index.js
    ```

