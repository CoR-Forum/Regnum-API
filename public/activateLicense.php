<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';

// Get the username and license key from the URL
$username = $_GET['username'] ?? null;
$licenseKey = $_GET['key'] ?? null;

// Check if the username or license key is missing
if (!$username || !$licenseKey) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required ' . (!$username ? 'username, ' : '') . (!$licenseKey ? 'license_key' : '')]);
    exit;
}

// Check if the username exists and is activated
$user = new User($pdo);
$userId = $user->getUserId($username);
if (!$userId) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid username']);
    exit;
}

// Check if the user is activated
if (!$user->isActivated($userId)) {
    echo json_encode(['status' => 'error', 'message' => 'User is not activated']);
    exit;
}

// Activate the license
$license = new License($pdo);
$result = $license->activateLicense($userId, $licenseKey);
echo json_encode($result);
?>
