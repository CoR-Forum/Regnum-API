<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/Global.php';

class BetaRegistration {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function registerBetaUser($email, $name = null, $discordTag = null) {
        try {
            // Check if email already exists
            $checkStmt = $this->pdo->prepare("SELECT COUNT(*) FROM beta_registrations WHERE email = :email");
            $checkStmt->execute(['email' => $email]);
            $emailExists = $checkStmt->fetchColumn();

            if ($emailExists) {
                throw new \Exception("Email already registered.");
            }

            // Insert new beta user
            $stmt = $this->pdo->prepare("INSERT INTO beta_registrations (name, email, discord_tag) VALUES (:name, :email, :discord_tag)");
            $stmt->execute([
                'name' => $name,
                'email' => $email,
                'discord_tag' => $discordTag
            ]);
            return true;
        } catch (\PDOException $e) {
            throw new \Exception($e->getMessage());
        }
    }
}

$betaRegistration = new BetaRegistration($pdo);

function validateInput($input, $pattern, $errorMessage) {
    if ($input !== null && !preg_match($pattern, $input)) {
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
            validateInput($name, '/^[a-zA-Z0-9_]{0,32}$/', 'Invalid name');
            validateInput($email, '/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', 'Invalid email');
            validateInput($discord_tag, '/^[a-zA-Z0-9_]{0,32}$/', 'Invalid discord tag');

            $result = $betaRegistration->registerBetaUser($email, $name, $discord_tag);

            if ($result) {
                GlobalFunctions::sendJsonResponse('success', 'Successfully registered! Please check your email for further instructions.');
            }
            break;

        default:
            GlobalFunctions::sendJsonResponse('error', 'Invalid action');
            break;

    }
} catch (\Throwable $e) {
    GlobalFunctions::sendJsonResponse('error', 'An error occurred: ' . $e->getMessage());
}