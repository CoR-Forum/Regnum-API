<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Memory.php';
require_once __DIR__ . '/../src/Shoutbox.php';
require_once __DIR__ . '/../src/Admin.php';
require_once __DIR__ . '/../src/Global.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

// get the action from the request
$action = $_GET['action'] ?? null;

// check if the username or password is missing
if (!$username || !$password) {
    GF::sendJsonResponse('error', 'Missing required username or password');
}

$user = new User($pdo);
$loggedInUser = $user->login($username, $password);

if ($loggedInUser) {
    $admin = new Admin($pdo, $loggedInUser['is_admin'], $loggedInUser['id']);
    
    if ($action === 'getUsers') {
        $allUsers = $admin->getAllUsers();
        GF::sendJsonResponse('success', 'Users fetched successfully', ['users' => $allUsers]);
    } else if ($action === 'toggleUserBan') {
        $userId = $_GET['userId'] ?? null;
        $reason = $_GET['reason'] ?? null;
        $until = $_GET['until'] ?? null;
        
        if (!$userId) {
            GF::sendJsonResponse('error', 'Missing required user ID');
        }
    
        // Validate the until parameter if provided
        if ($until !== null && strtotime($until) === false) {
            GF::sendJsonResponse('error', 'Invalid until timestamp');
        }
    
        $result = $admin->toggleUserBan($userId, $reason, $until);
        GF::sendJsonResponse($result['status'], $result['message'], $result);
    } else if ($action === 'toggleUserAdmin') {
        $userId = $_GET['userId'] ?? null;
        if (!$userId) {
            GF::sendJsonResponse('error', 'Missing required user ID');
        }

        $result = $admin->toggleUserAdmin($userId);
        GF::sendJsonResponse($result['status'], $result['message'], $result);
    } else if ($action === 'toggleUserActivation') {
        $userId = $_GET['userId'] ?? null;
        if (!$userId) {
            GF::sendJsonResponse('error', 'Missing required user ID');
        }

        $result = $admin->toggleUserActivation($userId);
        GF::sendJsonResponse($result['status'], $result['message'], $result);
    } else if ($action === 'generateLicenseKey') {
        if (!$loggedInUser['is_admin']) {
            GF::sendJsonResponse('error', 'Unauthorized');
        }

        $licensedFeatures = $_GET['licensedFeatures'] ?? null;
        if (!$licensedFeatures) {
            GF::sendJsonResponse('error', 'Missing required licensed features');
        }

        // Validate licensedFeatures as a JSON array
        $licensedFeaturesArray = json_decode($licensedFeatures, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($licensedFeaturesArray)) {
            GF::sendJsonResponse('error', 'Invalid licensed features format');
        }

        $license = new License($pdo);
        $newLicenseKey = $license->generateNewLicense($licensedFeatures, $_GET['runtime'] ?? null);
        GF::sendJsonResponse('success', 'License key generated successfully', ['licenseKey' => $newLicenseKey]);
    } else if ($action === 'getLicenses') {
        $allLicenses = $admin->getAllLicenses();
        GF::sendJsonResponse('success', 'Licenses fetched successfully', ['licenses' => $allLicenses]);
    } else if ($action === 'expireLicense') {
        if (!$loggedInUser['is_admin']) {
            GF::sendJsonResponse('error', 'Unauthorized');
        }

        $licenseId = $_GET['licenseId'] ?? null;
        if (!$licenseId) {
            GF::sendJsonResponse('error', 'Missing required license ID');
        }

        $result = $admin->expireLicense($licenseId);
        GF::sendJsonResponse($result['status'], $result['message'], $result);
    } else if ($action === 'modifyGlobalSettings') {
        if (!$loggedInUser['is_admin']) {
            GF::sendJsonResponse('error', 'Unauthorized');
        }

        $setting = $_GET['setting'] ?? null;
        $value = $_GET['value'] ?? null;

        if (!$setting || !$value) {
            GF::sendJsonResponse('error', 'Missing required setting or value');
        } else {
            $result = $admin->modifyGlobalSettings($setting, $value);
            GF::sendJsonResponse($result['status'], $result['message'], $result);
        }

    } else {
        GF::sendJsonResponse('error', 'Invalid action');
    }
} else {
    GF::sendJsonResponse('error', 'Login failed');
}
?>