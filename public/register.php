<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;
$email = $_GET['email'] ?? null;

if (!$username || !$password || !$email) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required ' . (!$username ? 'username, ' : '') . (!$password ? 'password, ' : '') . (!$email ? 'email' : '')]);
    exit;
}

$user = new User($pdo);
if ($user->userExists($username, $email)) {
    echo json_encode(['status' => 'error', 'message' => 'Username or email already exists']);
    exit;
}

if ($user->register($username, $password, $email)) {
    echo json_encode(['status' => 'success', 'message' => 'User registered successfully. Please check your email to activate your account.']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'User registration failed']);
}
?>