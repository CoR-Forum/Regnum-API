<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';
require_once __DIR__ . '/../src/License.php';
require_once __DIR__ . '/../src/Memory.php';
require_once __DIR__ . '/../src/Shoutbox.php';
require_once __DIR__ . '/../src/Admin.php';

$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;

// get the action from the request
$action = $_GET['action'] ?? null;

// check if the username or password is missing
if (!$username || !$password) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required username or password']);
    exit;
}

$user = new User($pdo);
$loggedInUser = $user->login($username, $password);

if ($loggedInUser) {
    if ($action === 'allUsers') {
        $admin = new Admin($pdo, $loggedInUser['is_admin']);
        $allUsers = $admin->getAllUsers();
        echo json_encode(['status' => 'success', 'users' => $allUsers]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
}
?>