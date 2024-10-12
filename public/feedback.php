<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/User.php';

$type = $_GET['type'] ?? null;
$username = $_GET['username'] ?? null;
$password = $_GET['password'] ?? null;
$feedback = $_GET['feedback'] ?? null;

$missingParams = [];

if (!$type) {
    $missingParams[] = 'type';
}
if (!$username) {
    $missingParams[] = 'username';
}
if (!$password) {
    $missingParams[] = 'password';
}
if (!$feedback) {
    $missingParams[] = 'feedback';
}

if (!empty($missingParams)) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required parameter(s): ' . implode(', ', $missingParams)]);
    exit;
}

$user = new User($pdo);
$loggedInUser = $user->login($username, $password);

if (!$loggedInUser) {
    echo json_encode(['status' => 'error', 'message' => 'Login failed']);
    exit;
}

$payload = json_encode([
    'embeds' => [
        [
            'title' => 'Feedback',
            'description' => $feedback,
            'color' => 16711680,
            'fields' => [
                [
                    'name' => 'Type',
                    'value' => $type,
                    'inline' => true
                ],
                [
                    'name' => 'From',
                    'value' => $username,
                    'inline' => true
                ]
            ]
        ]
    ]
]);

$options = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n",
        'method'  => 'POST',
        'content' => $payload,
    ],
];

$context  = stream_context_create($options);
$result = file_get_contents($discordFeedbackWebhookUrl, false, $context);

if ($result === FALSE) {
    echo json_encode(['status' => 'error', 'message' => 'Failed to send feedback']);
} else {
    echo json_encode(['status' => 'success', 'message' => 'Feedback submitted successfully']);
}
?>