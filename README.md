# Sylent-X Node.js API

## Setup

Everything here is mandatory.

1. Host with Node 22.11+
2. Woltlab Burning Board 5.3 with this API file (make sure to fill ``API_KEY``)


    ```php
    <?php
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


3. ``.env`` file in the project directory
    ```
    # MongoDB Configuration
    MONGO_URI=mongodb://<mongodb_user>:<mongodb_password>@cax.treudler.net:27017/

    # Woltlab MySQL Configuration
    MYSQL_HOST=cax.treudler.net
    MYSQL_PORT=3307
    MYSQL_USER=<mysql_user>
    MYSQL_PASSWORD=<mysql_password>
    MYSQL_DATABASE=corforum

    # Woltlab API Configuration
    WOLTLAB_API_URL=<woltlab_api_url>
    WOLTLAB_API_KEY=<woltlab_api_key>

    # Application Configuration
    NODE_ENV=development
    PORT=3000
    BASE_PATH=/v1
    BASE_URL=http://localhost:3000

    # Email Configuration
    EMAIL_HOST=mail.treudler.net
    EMAIL_NAME=CoR-Forum Support (DEV)
    EMAIL_PASS=<email_password>
    EMAIL_PORT=587
    EMAIL_SURE=true
    EMAIL_USER=system@treudler.net

    # Discord Webhook Configuration
    DISCORD_LOG_WEBHOOK_URL=<discord_log_webhook_url>
    DISCORD_LOGIN_WEBHOOK_URL=<discord_login_webhook_url>

    # Discord Bot Configuration
    DISCORD_BOT=true
    DISCORD_BOT_TOKEN=<discord_bot_token>
    DISCORD_ADMINS=188703762167234561,197880680619835392

    # Discord oAuth Configuration
    DISCORD_CLIENT_ID=<discord_client_id>
    DISCORD_CLIENT_SECRET=<discord_client_secret>

    # JWT Configuration
    JWT_SECRET=<jwt_secret>
    ```


5. Install node packages
    ```sh
    npm install
    ```

6. Run the API
    ```
    nodemon index.js
    ```

