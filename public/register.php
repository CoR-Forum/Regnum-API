<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$data = json_decode(file_get_contents('php://input'), true);
$username = $data['username'];
$password = $data['password'];

$user = new User($pdo);
if ($user->register($username, $password)) {
    echo json_encode(['message' => 'User registered successfully']);
} else {
    echo json_encode(['message' => 'User registration failed']);
}
?>