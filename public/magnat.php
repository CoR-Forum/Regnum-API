<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/Magnat.php';
require_once __DIR__ . '/../src/Global.php';

$action = $_GET['action'] ?? null;
$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;
$amount = $_GET['amount'] ?? null;
$type = $_GET['type'] ?? null;

if (!$username || !$password) {
    GF::sendJsonResponse('error', 'Missing required username or password');
}

$user = new User($pdo);
if ($user = $user->login($username, $password)) {
    $magnat = new Magnat($pdo);

    if ($action === 'getWallet') {
        $wallet = $magnat->getWallet($user['id']);
        GF::sendJsonResponse('success', 'Wallet fetched successfully', ['wallet' => $wallet]);
    } elseif ($action === 'updateWallet' && $amount && $type) {
        $result = $magnat->updateWallet($user['id'], $amount, $type);
        GF::sendJsonResponse('success', 'Wallet updated successfully', $result);
    } elseif ($action === 'getTransactions') {
        $transactions = $magnat->getTransactions($user['id']);
        GF::sendJsonResponse('success', 'Transactions fetched successfully', ['transactions' => $transactions]);
    } else {
        GF::sendJsonResponse('error', 'Invalid action or missing parameters');
    }
} else {
    GF::sendJsonResponse('error', 'Login failed');
}
?>