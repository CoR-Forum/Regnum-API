<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Magnat.php';
require_once __DIR__ . '/../src/Global.php';

function sendJsonResponse($status, $message, $data = []) {
    echo json_encode(array_merge(['status' => $status, 'message' => $message], $data));
    exit;
}

function validateInput($input, $pattern, $errorMessage) {
    if (!preg_match($pattern, $input)) {
        sendJsonResponse('error', $errorMessage);
    }
}

try {
    $action = $_GET['action'] ?? null;
    $username = $_GET['username'] ?? null;
    $password = $_GET['password'] ?? null;
    $settings = $_GET['settings'] ?? null;
    $email = $_GET['email'] ?? null;
    $token = $_GET['token'] ?? null;

    $user = new User($pdo);

    switch ($action) {
        case 'login':
            $user = $user->login($username, $password);
            if (is_array($user) && isset($user['error'])) {
                sendJsonResponse('error', $user['error']);
            } elseif ($user) {
                $licenseObj = new License($pdo);
                $license = $licenseObj->getLastActivatedLicense($user['id']);
                
                if ($license) {
                    $licensed_features = json_decode($license['licensed_features'], true) ?? ['zoom', 'posx', 'posy', 'posz'];
                    $runtime_end = new DateTime($license['runtime_end']);
                    $current_date = new DateTime();
                    $is_license_expired = $runtime_end < $current_date;
                } else {
                    $licensed_features = ['zoom', 'posx', 'posy', 'posz'];
                    $is_license_expired = true;
                    $license = ['license_key' => 'null', 'runtime_end' => 'null'];
                }
        
                $magnat = new Magnat($pdo);
                $wallet = $magnat->getWallet($user['id']);
                
                $globalFunctions = new GlobalFunctions($pdo);
                $systemStatus = $globalFunctions->getCurrentStatus();

                $response = [
                    'username' => $user['username'],
                    'id' => $user['id'],
                    'created_at' => $user['created_at'],
                    'is_active' => $user['is_active'],
                    'email' => $user['email'],
                    'license_key' => $license['license_key'],
                    'licensed_features' => $licensed_features,
                    'runtime_end' => $license['runtime_end'],
                    'is_license_expired' => $is_license_expired,
                    'magnat' => $wallet['amount'] ?? 0,
                    'system_status' => $systemStatus,
                    'role' => $user['is_admin'] == 1 ? 'admin' : 'user'
                ];
                sendJsonResponse('success', 'Login successful', $response);
            } else {
                sendJsonResponse('error', 'Login failed');
            }
            break;
            
        case 'register':
            if (!$username || !$password || !$email) {
                sendJsonResponse('error', 'Missing required fields');
            }
            validateInput($username, '/^[a-zA-Z0-9_]{3,20}$/', 'Invalid username');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                sendJsonResponse('error', 'Invalid email address');
            }
            if (strlen($password) < 8) {
                sendJsonResponse('error', 'Password should be at least 8 characters long');
            }
            if ($user->userExists($username, $email)) {
                sendJsonResponse('error', 'Username or email already exists');
            }
            if ($user->register($username, $password, $email)) {
                sendJsonResponse('success', 'User registered successfully. Please check your email to activate your account.');
            } else {
                sendJsonResponse('error', 'User registration failed');
            }
            break;

        case 'reset':
            $resetAction = $_GET['resetAction'] ?? null;
            if ($resetAction === 'init') {
                if (!$email) {
                    sendJsonResponse('error', 'Missing required email');
                }
                if ($user->initiatePasswordReset($email)) {
                    sendJsonResponse('success', 'Password reset initiated successfully. Check your email for the reset code');
                } else {
                    sendJsonResponse('error', 'Password reset initiation failed');
                }
            } elseif ($resetAction === 'reset') {
                if (!$token || !$password) {
                    sendJsonResponse('error', 'Missing required fields');
                }
                if (strlen($password) < 8) {
                    sendJsonResponse('error', 'Password should be at least 8 characters long');
                }
                if ($user->resetPassword($token, $password)) {
                    sendJsonResponse('success', 'Password reset successfully');
                } else {
                    sendJsonResponse('error', 'Password reset failed');
                }
            } else {
                sendJsonResponse('error', 'Invalid reset action');
            }
            break;

        case 'activate':
            if (!$token) {
                sendJsonResponse('error', 'Invalid activation token');
            }
            if ($user->activate($token)) {
                sendJsonResponse('success', 'Account activated successfully');
            } else {
                sendJsonResponse('error', 'Account activation failed');
            }
            break;

        case 'getStatus':
            $globalFunctions = new GlobalFunctions($pdo);
            $systemStatus = $globalFunctions->getCurrentStatus();
            sendJsonResponse('success', 'System status fetched successfully', ['system_status' => $systemStatus]);
            break;

        case 'saveSettings':
            if (!$username || !$password || !$settings) {
                sendJsonResponse('error', 'Missing required fields');
            }
            $loggedInUser = $user->login($username, $password);
            if ($loggedInUser) {
                if ($user->saveSettings($loggedInUser['id'], $settings)) {
                    sendJsonResponse('success', 'Settings saved successfully');
                } else {
                    sendJsonResponse('error', 'Settings save failed');
                }
            } else {
                sendJsonResponse('error', 'Invalid username or password');
            }
            break;

        case 'loadSettings':
            if (!$username || !$password) {
                sendJsonResponse('error', 'Missing required fields');
            }
            $loggedInUser = $user->login($username, $password);
            if ($loggedInUser) {
                $settings = $user->loadSettings($loggedInUser['id']);
                $settingsArray = json_decode($settings, true);
                sendJsonResponse('success', 'Settings loaded successfully', ['settings' => $settingsArray]);
            } else {
                sendJsonResponse('error', 'Invalid username or password');
            }
            break;

        default:
            sendJsonResponse('error', 'Invalid action');
            break;
    }
} catch (Exception $e) {
    sendJsonResponse('error', 'An error occurred: ' . $e->getMessage());
}
?>