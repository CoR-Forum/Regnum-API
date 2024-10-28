<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/Memory.php';
require_once __DIR__ . '/../src/Global.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

if (!$username || !$password) {
    GF::sendJsonResponse('error', 'Missing required username or password');
    exit;
}

$user = new User($pdo);
$loginResponse = $user->login($username, $password);

if (isset($loginResponse['error'])) {
    GF::sendJsonResponse('error', $loginResponse['error']);
    exit;
}

$memory = new Memory($pdo);
$result = $memory->getMemoryPointers($loginResponse['id']);

if ($result['status'] === 'error') {
    GF::sendJsonResponse('error', $result['message']);
} else {
    GF::sendJsonResponse('success', 'Memory pointers fetched successfully', $result);
}