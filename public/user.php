<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Magnat.php';
require_once __DIR__ . '/../src/Global.php'; // Include Global.php for fetching system status

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
            echo json_encode(['status' => 'error', 'message' => $user['error']]);
        } elseif ($user) {
            $licenseObj = new License($pdo);
            $license = $licenseObj->getLastActivatedLicense($user['id']);
            
            if ($license) {
                $licensed_features = json_decode($license['licensed_features'], true);
                if (is_null($licensed_features)) {
                    $licensed_features = ['zoom', 'posx', 'posy', 'posz'];
                }
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
            
            // Fetch system status from settings table
            $globalFunctions = new GlobalFunctions($pdo); // Pass $pdo to the constructor
            $systemStatus = $globalFunctions->getCurrentStatus();

            $response = [
                'status' => 'success',
                'message' => 'Login successful',
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
                'system_status' => $systemStatus // Include system status in the response
            ];
            if ($user['is_admin'] == 1) {
                $response['role'] = "admin";
            } else {
                $response['role'] = "user";
            }
            echo json_encode($response);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Login failed']);
        }
        break;
        
    case 'register':
        if (!$username || !$password || !$email) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required ' . (!$username ? 'username, ' : '') . (!$password ? 'password, ' : '') . (!$email ? 'email' : '')]);
            exit;
        }
        if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid username. It should be 3-20 characters long and can contain letters, numbers, and underscores.']);
            exit;
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid email address']);
            exit;
        }
        if (strlen($password) < 8) {
            echo json_encode(['status' => 'error', 'message' => 'Password should be at least 8 characters long']);
            exit;
        }
        if ($user->userExists($username, $email)) {
            echo json_encode(['status' => 'error', 'message' => 'Username or email already exists']);
            exit;
        }
        if ($user->register($username, $password, $email)) {
            echo json_encode(['status' => 'success', 'message' => 'User registered successfully. Please check your email to activate your account.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'User registration failed']);
        }
        break;

    case 'reset':
        $resetAction = $_GET['resetAction'] ?? null;
        if ($resetAction === 'init') {
            if (!$email) {
                echo json_encode(['status' => 'error', 'message' => 'Missing required email']);
                exit;
            }
            if ($user->initiatePasswordReset($email)) {
                echo json_encode(['status' => 'success', 'message' => 'Password reset initiated successfully. Check your email for the reset code']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Password reset initiation failed']);
            }
        } elseif ($resetAction === 'reset') {
            if (!$token || !$password) {
                echo json_encode(['status' => 'error', 'message' => 'Missing required ' . (!$token ? 'token, ' : '') . (!$password ? 'password' : '')]);
                exit;
            }
            if (strlen($password) < 8) {
                echo json_encode(['status' => 'error', 'message' => 'Password should be at least 8 characters long']);
                exit;
            }
            if ($user->resetPassword($token, $password)) {
                echo json_encode(['status' => 'success', 'message' => 'Password reset successfully']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Password reset failed']);
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid reset action']);
        }
        break;

    case 'activate':
        if (!$token) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid activation token']);
            exit;
        }
        if ($user->activate($token)) {
            echo json_encode(['status' => 'success', 'message' => 'Account activated successfully']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Account activation failed']);
        }
        break;

    case 'getStatus':
        $globalFunctions = new GlobalFunctions($pdo); // Pass $pdo to the constructor
        $systemStatus = $globalFunctions->getCurrentStatus();
        echo json_encode(['status' => 'success', 'system_status' => $systemStatus]);
        break;

    case 'saveSettings':
        if (!$username || !$password || !$settings) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required username, password, or settings']);
            exit;
        }
        
        $loggedInUser = $user->login($username, $password);
        if ($loggedInUser) {
            if ($user->saveSettings($loggedInUser['id'], $settings)) {
                echo json_encode(['status' => 'success', 'message' => 'Settings saved successfully']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Settings save failed']);
            }
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid username or password']);
        }
        break;

    case 'loadSettings';
        if (!$username || !$password) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required username or password']);
            exit;
        }
        
        $loggedInUser = $user->login($username, $password);
        if ($loggedInUser) {
            $settings = $user->loadSettings($loggedInUser['id']);
            $settingsArray = json_decode($settings, true); // Decode the settings JSON string
            echo json_encode(['status' => 'success', 'settings' => $settingsArray]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid username or password']);
        }
        break;

    default:
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
        break;
}
?>