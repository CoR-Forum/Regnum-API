<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';

$username = $_GET['username'] ?? null;
$licenseActivationToken = $_GET['token'] ?? null;

if (!$username || !$licenseActivationToken) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required ' . (!$username ? 'username, ' : '') . (!$licenseActivationToken ? 'license_key' : '')]);
    exit;
}

// Fetch userId based on username
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid username']);
    exit;
}

$userId = $user['id'];

$user = new User($pdo);
if (!$user->isActivated($userId)) {
    echo json_encode(['status' => 'error', 'message' => 'User is not activated']);
    exit;
}

$license = new License($pdo);
$result = $license->activateLicense($userId, $licenseActivationToken);

echo json_encode($result);
?>