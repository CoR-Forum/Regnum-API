<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/Memory.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

if (!$username || !$password) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required username or password']);
    exit;
}

$user = new User($pdo);
$loginResponse = $user->login($username, $password);

if (isset($loginResponse['error'])) {
    echo json_encode(['status' => 'error', 'message' => $loginResponse['error']]);
    exit;
}

$memory = new Memory($pdo);
$result = $memory->getMemoryPointers($loginResponse['id']);
echo json_encode($result);
?>