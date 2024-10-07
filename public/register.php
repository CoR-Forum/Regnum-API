<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

// Get username, password, and email from the request
$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;
$email = $_GET['email'] ?? null;

// Check if all required fields are provided
if (!$username || !$password || !$email) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required ' . (!$username ? 'username, ' : '') . (!$password ? 'password, ' : '') . (!$email ? 'email' : '')]);
    exit;
}

// Validate username (alphanumeric and underscores, 3-20 characters)
if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid username. It should be 3-20 characters long and can contain letters, numbers, and underscores.']);
    exit;
}

// Validate email address
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid email address']);
    exit;
}

// Validate password (minimum 8 characters)
if (strlen($password) < 8) {
    echo json_encode(['status' => 'error', 'message' => 'Password should be at least 8 characters long']);
    exit;
}

// Check if username or email already exists
$user = new User($pdo);
if ($user->userExists($username, $email)) {
    echo json_encode(['status' => 'error', 'message' => 'Username or email already exists']);
    exit;
}

// Register user
if ($user->register($username, $password, $email)) {
    echo json_encode(['status' => 'success', 'message' => 'User registered successfully. Please check your email to activate your account.']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'User registration failed']);
}
?>