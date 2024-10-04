<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

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

// Check the activation_key column for the licenseActivationToken
$stmt = $pdo->prepare('SELECT * FROM license_activation_keys WHERE activation_key = ?');
$stmt->execute([$licenseActivationToken]);
$license = $stmt->fetch();

if (!$license) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid activation key']);
    exit;
}

if ($license['activated_by']) {
    echo json_encode(['status' => 'error', 'message' => 'Activation key already used']);
    exit;
}

// Insert a new record into the licenses table
$stmt = $pdo->prepare('INSERT INTO licenses (user_id, license_key, licensed_features) VALUES (?, ?, ?)');
$stmt->execute([$userId, $license['license_key'], $license['features']]);

// Update the license_activation_keys table to mark the activation key as used
$stmt = $pdo->prepare('UPDATE license_activation_keys SET activated_by = ? WHERE activation_key = ?');
$stmt->execute([$userId, $licenseActivationToken]);

echo json_encode(['status' => 'success', 'message' => 'Activation key used successfully']);
?>