<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Global.php';

$licenseKey = $_GET['key'] ?? null;
if (!$licenseKey) {
    GF::sendJsonResponse('error', 'Missing license key');
}

$license = new License($pdo);
$licenseDetails = $license->checkLicense($licenseKey);
if (!$licenseDetails) {
    GF::sendJsonResponse('error', 'Invalid license key');
}

// Check if the license is expired
$currentDate = new DateTime();
if ($licenseDetails['runtime_end'] !== null) {
    $expiresAt = new DateTime($licenseDetails['runtime_end']);
    if ($expiresAt < $currentDate) {
        GF::sendJsonResponse('error', 'License key expired');
    }
}

// Decode licensed_features
$licensedFeatures = json_decode($licenseDetails['licensed_features'], true);
GF::sendJsonResponse('success', 'License key is valid', [
    'licensed_features' => $licensedFeatures,
    'runtime_end' => $licenseDetails['runtime_end']
]);
?>