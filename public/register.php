<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;
$email = $_GET['email'] ?? null;

if (!$username || !$password || !$email) {
    echo json_encode(['message' => 'Missing required ' . (!$username ? 'username, ' : '') . (!$password ? 'password, ' : '') . (!$email ? 'email' : '')]);
    exit;
}

$user = new User($pdo);
if ($user->register($username, $password, $email)) {
    echo json_encode(['message' => 'User registered successfully. Please check your email to activate your account.']);
} else {
    echo json_encode(['message' => 'User registration failed']);
}
?>