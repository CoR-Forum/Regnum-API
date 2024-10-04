<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

$user = new User($pdo);
if ($user = $user->login($username, $password)) {
    echo json_encode(['message' => 'Login successful', 'user' => $user]);
} else {
    echo json_encode(['message' => 'Login failed']);
}
?>