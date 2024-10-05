<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

$user = new User($pdo);
if ($user = $user->login($username, $password)) {
    // Fetch the license details for the user
    $stmt = $pdo->prepare('SELECT license_key, licensed_features, expires_at FROM active_licenses WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $license = $stmt->fetch();
    
    // Decode the licensed_features JSON string
    $licensed_features = json_decode($license['licensed_features'], true);

    echo json_encode([
        'status' => 'success',
        'message' => 'Login successful',
        'user' => $user['username'],
        'email' => $user['email'],
        'license_key' => $license['license_key'] ?? null,
        'licensed_features' => $licensed_features ?? null,
        'expires_at' => $license['expires_at'] ?? null
    ]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
}
?>