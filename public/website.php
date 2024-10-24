<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/Global.php';

function validateInput($input, $pattern, $errorMessage) {
    if (!preg_match($pattern, $input)) {
        GlobalFunctions::sendJsonResponse('error', $errorMessage);
    }
}

try {
    $action = $_GET['action'] ?? null;
    $name = $_GET['name'] ?? null;
    $email = $_GET['email'] ?? null;
    $discord_tag = $_GET['discord_tag'] ?? null;

    switch ($action) {
        case 'registerForBeta':
            validateInput($name, '/^[a-zA-Z0-9_]{3,16}$/', 'Invalid name');
            validateInput($email, '/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', 'Invalid email');
            validateInput($discord_tag, '/^.{2,32}#[0-9]{4}$/', 'Invalid discord tag');

            $globalFunctions = new GlobalFunctions($pdo);
            $result = $globalFunctions->registerBetaUser($name, $email, $discord_tag);

            if ($result) {
                GlobalFunctions::sendJsonResponse('success', 'Successfully registered! Please check your email for further instructions.');
            } else {
                GlobalFunctions::sendJsonResponse('error', 'Failed to register for beta');
            }
            break;

        default:
            GlobalFunctions::sendJsonResponse('error', 'Invalid action');
            break;

    }
} catch (\Throwable $e) {
    GlobalFunctions::sendJsonResponse('error', 'An error occurred');
}