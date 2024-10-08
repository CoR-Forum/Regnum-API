<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

// Get the action from the request
$action = $_GET['action'] ?? null;

if ($action === 'init') {
    // Get the email from the request
    $email = $_GET['email'] ?? null;

    // Check if the email is missing
    if (!$email) {
        echo json_encode(['status' => 'error', 'message' => 'Missing required email']);
        exit;
    }

    // Initiate the password reset
    $user = new User($pdo);
    if ($user->initiatePasswordReset($email)) {
        echo json_encode(['status' => 'success', 'message' => 'Password reset initiated successfully']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Password reset initiation failed']);
    }
} elseif ($action === 'reset') {
    // Get the token and new password from the request
    $token = $_GET['token'] ?? null;
    $password = $_GET['password'] ?? null;

    // Check if the token or password is missing
    if (!$token || !$password) {
        echo json_encode(['status' => 'error', 'message' => 'Missing required ' . (!$token ? 'token, ' : '') . (!$password ? 'password' : '')]);
        exit;
    }

    // Validate password (minimum 8 characters)
    if (strlen($password) < 8) {
        echo json_encode(['status' => 'error', 'message' => 'Password should be at least 8 characters long']);
        exit;
    }

    // Reset the password
    $user = new User($pdo);
    if ($user->resetPassword($token, $password)) {
        echo json_encode(['status' => 'success', 'message' => 'Password reset successfully']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Password reset failed']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
}
?>