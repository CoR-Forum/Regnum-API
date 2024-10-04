<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$token = $_GET['token'] ?? null;

if (!$token) {
    echo json_encode(['message' => 'Invalid activation token']);
    exit;
}

$user = new User($pdo);
if ($user->activate($token)) {
    echo json_encode(['message' => 'Account activated successfully']);
} else {
    echo json_encode(['message' => 'Account activation failed']);
}
?>