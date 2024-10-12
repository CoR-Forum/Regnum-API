<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Memory.php';
require_once __DIR__ . '/../src/Shoutbox.php';
require_once __DIR__ . '/../src/Admin.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

// get the action from the request
$action = $_GET['action'] ?? null;

// check if the username or password is missing
if (!$username || !$password) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required username or password']);
    exit;
}

$user = new User($pdo);
$loggedInUser = $user->login($username, $password);

if ($loggedInUser) {
    if ($action === 'getUsers') {
        $admin = new Admin($pdo, $loggedInUser['is_admin']);
        $allUsers = $admin->getAllUsers();
        echo json_encode(['status' => 'success', 'users' => $allUsers]);
    } else if ($action === 'toggleUserBan') {
        $userId = $_GET['userId'] ?? null;
        if (!$userId) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required user ID']);
            exit;
        }

        $admin = new Admin($pdo, $loggedInUser['is_admin']);
        $result = $admin->toggleUserBan($userId);
        echo json_encode($result);
    } else if ($action === 'toggleUserAdmin') {
        $userId = $_GET['userId'] ?? null;
        if (!$userId) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required user ID']);
            exit;
        }

        $admin = new Admin($pdo, $loggedInUser['is_admin']);
        $result = $admin->toggleUserAdmin($userId);
        echo json_encode($result);
    } else if ($action === 'toggleUserActivation') {
        $userId = $_GET['userId'] ?? null;
        if (!$userId) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required user ID']);
            exit;
        }

        $admin = new Admin($pdo, $loggedInUser['is_admin']);
        $result = $admin->toggleUserActivation($userId);
        echo json_encode($result);
    } else if ($action === 'generateLicenseKey') {
        if (!$loggedInUser['is_admin']) {
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
            exit;
        }

        $licensedFeatures = $_GET['licensedFeatures'] ?? null;
        if (!$licensedFeatures) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required licensed features']);
            exit;
        }

        // Validate licensedFeatures as a JSON array
        $licensedFeaturesArray = json_decode($licensedFeatures, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($licensedFeaturesArray)) {
            echo json_encode(['status' => 'error', 'message' => 'Invalid licensed features format']);
            exit;
        }

        $license = new License($pdo);
        $newLicenseKey = $license->generateNewLicense($licensedFeatures, $_GET['runtime'] ?? null);
        echo json_encode(['status' => 'success', 'licenseKey' => $newLicenseKey]);
    } else if ($action === 'getLicenses') {
        $admin = new Admin($pdo, $loggedInUser['is_admin']);
        $allLicenses = $admin->getAllLicenses();
        echo json_encode(['status' => 'success', 'licenses' => $allLicenses]);
    } else if ($action === 'disableLicense') {
        if (!$loggedInUser['is_admin']) {
            echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
            exit;
        }

        $licenseId = $_GET['licenseId'] ?? null;
        if (!$licenseId) {
            echo json_encode(['status' => 'error', 'message' => 'Missing required license ID']);
            exit;
        }

        $admin = new Admin($pdo, $loggedInUser['is_admin']);
        $result = $admin->disableLicense($licenseId);
        echo json_encode($result);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid username or password']);
}
?>