<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Global.php';

// Get the action, username, and license key from the URL
$action = $_GET['action'] ?? null;
$username = $_GET['username'] ?? null;
$licenseKey = $_GET['key'] ?? null;

// Check if the action is set to 'activate'
if ($action !== 'activate') {
    GlobalFunctions::sendJsonResponse('error', 'Invalid action');
}

// Check if the username or license key is missing
if (!$username || !$licenseKey) {
    GlobalFunctions::sendJsonResponse('error', 'Missing required ' . (!$username ? 'username, ' : '') . (!$licenseKey ? 'license_key' : ''));
}

// Check if the username exists and is activated
$user = new User($pdo);
$userId = $user->getUserId($username);
if (!$userId) {
    GlobalFunctions::sendJsonResponse('error', 'Invalid username');
}

// Check if the user is activated
if (!$user->isActivated($userId)) {
    GlobalFunctions::sendJsonResponse('error', 'User is not activated');
}

// Activate the license
$license = new License($pdo);
$result = $license->activateLicense($userId, $licenseKey);
GlobalFunctions::sendJsonResponse($result['status'], $result['message'], $result);
?>