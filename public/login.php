<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

$user = new User($pdo);
if ($user = $user->login($username, $password)) {
    $licenseObj = new License($pdo);
    $license = $licenseObj->getLastActivatedLicense($user['id']);
    
    if ($license) {
        // Decode the licensed_features JSON string
        $licensed_features = json_decode($license['licensed_features'], true);
        if (is_null($licensed_features)) {
            $licensed_features = ["zoom"];
        }
    } else {
        $licensed_features = ["zoom"];
    }
    
    $response = [
        'status' => 'success',
        'message' => 'Login successful',
        'username' => $user['username'],
        'id' => $user['id'],
        'created_at' => $user['created_at'],
        'is_active' => $user['is_active'],
        'email' => $user['email'],
        'license_key' => $license['license_key'] ?? null,
        'licensed_features' => $licensed_features,
        'expires_at' => $license['expires_at'] ?? null
    ];

    if ($user['is_admin'] == 1) {
        $response['group'] = "admin";
    } else {
        $response['group'] = "user";
    }

    echo json_encode($response);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
}
?>