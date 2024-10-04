<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$token = $_GET['token'] ?? null;

if (!$token) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid activation token']);
    exit;
}

$user = new User($pdo);
if ($user->activate($token)) {
    echo json_encode(['status' => 'success', 'message' => 'Account activated successfully']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Account activation failed']);
}
?>