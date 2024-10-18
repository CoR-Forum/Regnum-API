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
    } elseif ($action === 'delete' && $message) {
        $result = $shoutbox->deleteMessage($user['id'], $message);
        echo json_encode($result);
    } elseif ($action === 'private' && $message && $_GET['recipient']) {
        $recipient = $_GET['recipient'];
        $result = $shoutbox->addPrivateMessage($user['id'], $message, $recipient);
        echo json_encode($result);
    } elseif ($action === 'getprivate' && $_GET['recipient']) {
        $recipient = $_GET['recipient'];
        $messages = $shoutbox->getPrivateMessages($user['id'], $recipient);
        echo json_encode(['status' => 'success', 'messages' => $messages]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid action or missing message']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
}
?>