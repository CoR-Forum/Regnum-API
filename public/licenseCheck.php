<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Global.php';

$licenseKey = $_GET['key'] ?? null;
if (!$licenseKey) {
    GlobalFunctions::sendJsonResponse('error', 'Missing license key');
}

$license = new License($pdo);
$licenseDetails = $license->checkLicense($licenseKey);
if (!$licenseDetails) {
    GlobalFunctions::sendJsonResponse('error', 'Invalid license key');
}

// Check if the license is expired
$currentDate = new DateTime();
if ($licenseDetails['runtime_end'] !== null) {
    $expiresAt = new DateTime($licenseDetails['runtime_end']);
    if ($expiresAt < $currentDate) {
        GlobalFunctions::sendJsonResponse('error', 'License key expired');
    }
}

// Decode licensed_features
$licensedFeatures = json_decode($licenseDetails['licensed_features'], true);
GlobalFunctions::sendJsonResponse('success', 'License key is valid', [
    'licensed_features' => $licensedFeatures,
    'runtime_end' => $licenseDetails['runtime_end']
]);
?>