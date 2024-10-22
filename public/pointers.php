<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/Memory.php';
require_once __DIR__ . '/../src/Global.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

if (!$username || !$password) {
    GlobalFunctions::sendJsonResponse('error', 'Missing required username or password');
}

$user = new User($pdo);
$loginResponse = $user->login($username, $password);

if (isset($loginResponse['error'])) {
    GlobalFunctions::sendJsonResponse('error', $loginResponse['error']);
}

$memory = new Memory($pdo);
$result = $memory->getMemoryPointers($loginResponse['id']);
GlobalFunctions::sendJsonResponse('success', 'Memory pointers fetched successfully', $result);
?>