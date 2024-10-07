<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/Shoutbox.php';

$action = $_GET['action'] ?? null;
$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;
$message = $_GET['message'] ?? null;

if (!$username || !$password) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required username or password']);
    exit;
}

$user = new User($pdo);
if ($user = $user->login($username, $password)) {
    $shoutbox = new Shoutbox($pdo);

    if ($action === 'add' && $message) {
        $result = $shoutbox->addMessage($user['id'], $message);
        echo json_encode($result);
    } elseif ($action === 'get') {
        $messages = $shoutbox->getMessages();
        echo json_encode(['status' => 'success', 'messages' => $messages]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid action or missing message']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
}
?>