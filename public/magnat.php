<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/Magnat.php';

$action = $_GET['action'] ?? null;
$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;
$amount = $_GET['amount'] ?? null;
$type = $_GET['type'] ?? null;

if (!$username || !$password) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required username or password']);
    exit;
}

$user = new User($pdo);
if ($user = $user->login($username, $password)) {
    $magnat = new Magnat($pdo);

    if ($action === 'getWallet') {
        $wallet = $magnat->getWallet($user['id']);
        echo json_encode(['status' => 'success', 'wallet' => $wallet]);
    } elseif ($action === 'updateWallet' && $amount && $type) {
        $result = $magnat->updateWallet($user['id'], $amount, $type);
        echo json_encode($result);
    } elseif ($action === 'getTransactions') {
        $transactions = $magnat->getTransactions($user['id']);
        echo json_encode(['status' => 'success', 'transactions' => $transactions]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid action or missing parameters']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
}
?>