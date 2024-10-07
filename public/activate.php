<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

// Get the activation token from the URL
$token = $_GET['token'] ?? null;

// Check if the token is missing
if (!$token) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid activation token']);
    exit;
}

// Activate the account
$user = new User($pdo);
if ($user->activate($token)) {
    echo json_encode(['status' => 'success', 'message' => 'Account activated successfully']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Account activation failed']);
}
?>