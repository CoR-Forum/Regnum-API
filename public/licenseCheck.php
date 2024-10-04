<?php
require_once __DIR__ . '/../config/config.php';

$licenseKey = $_GET['key'] ?? null;

if (!$licenseKey) {
    echo json_encode(['status' => 'error', 'message' => 'Missing license key']);
    exit;
}

// Fetch the license details based on the license key
$stmt = $pdo->prepare('SELECT licensed_features, expires_at FROM licenses WHERE license_key = ?');
$stmt->execute([$licenseKey]);
$license = $stmt->fetch();

if (!$license) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid license key']);
    exit;
}

// Check if the license is expired
$currentDate = new DateTime();
$expiresAt = new DateTime($license['expires_at']);

if ($expiresAt < $currentDate) {
    echo json_encode(['status' => 'error', 'message' => 'License key expired']);
    exit;
}

echo json_encode([
    'status' => 'success',
    'licensed_features' => $license['licensed_features'],
    'expires_at' => $license['expires_at']
]);
?>