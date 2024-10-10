<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/License.php';
$licenseKey = $_GET['key'] ?? null;
if (!$licenseKey) {
    echo json_encode(['status' => 'error', 'message' => 'Missing license key']);
    exit;
}
$license = new License($pdo);
$licenseDetails = $license->checkLicense($licenseKey);
if (!$licenseDetails) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid license key']);
    exit;
}
// Check if the license is expired
$currentDate = new DateTime();
if ($licenseDetails['runtime_end'] !== null) {
    $expiresAt = new DateTime($licenseDetails['runtime_end']);
    if ($expiresAt < $currentDate) {
        echo json_encode(['status' => 'error', 'message' => 'License key expired']);
        exit;
    }
}
// Decode licensed_features
$licensedFeatures = json_decode($licenseDetails['licensed_features'], true);
echo json_encode([
    'status' => 'success',
    'licensed_features' => $licensedFeatures,
    'runtime_end' => $licenseDetails['runtime_end']
]);
?>