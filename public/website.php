<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../src/Global.php';

class BetaRegistration {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function registerBetaUser($email, $ipAddress, $name = null, $discordTag = null) {
        try {
            // Check if email already exists
            $checkStmt = $this->pdo->prepare("SELECT COUNT(*) FROM beta_registrations WHERE email = :email");
            $checkStmt->execute(['email' => $email]);
            $emailExists = $checkStmt->fetchColumn();

            if ($emailExists) {
                throw new \Exception("Email already registered.");
            }

            // Check if IP address has registered in the last 24 hours
            $ipCheckStmt = $this->pdo->prepare("SELECT COUNT(*) FROM beta_registrations WHERE ip_address = :ip_address AND created_at >= NOW() - INTERVAL 1 DAY");
            $ipCheckStmt->execute(['ip_address' => $ipAddress]);
            $ipExists = $ipCheckStmt->fetchColumn();

            if ($ipExists) {
                throw new \Exception("IP address has already registered in the last 24 hours.");
            }

            // Generate email confirmation token
            $token = bin2hex(random_bytes(16));

            // Insert new beta user
            $stmt = $this->pdo->prepare("INSERT INTO beta_registrations (name, email, discord_tag, email_verification_token, ip_address) VALUES (:name, :email, :discord_tag, :token, :ip_address)");
            $stmt->execute([
                'name' => $name,
                'email' => $email,
                'discord_tag' => $discordTag,
                'token' => $token,
                'ip_address' => $ipAddress
            ]);

            // Send confirmation email
            $subject = 'Confirm your beta registration';
            $body = "Hi!\n\nThank you for signing up for the Beta Phase of Sylent-X.\n\nClick the link to confirm your registration: {$GLOBALS['emailLinkDomain']}website.php?action=confirmBetaRegistration&token=$token";
            GF::sendEmailToAddress($email, $subject, $body);

            return true;
        } catch (\PDOException $e) {
            throw new \Exception($e->getMessage());
        }
    }

    public function confirmBetaRegistration($token) {
        try {
            // Check if token exists
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM beta_registrations WHERE email_verification_token = :token");
            $stmt->execute(['token' => $token]);
            $tokenExists = $stmt->fetchColumn();

            if (!$tokenExists) {
                throw new \Exception("Invalid or expired token.");
            }

            // Confirm registration
            $stmt = $this->pdo->prepare("UPDATE beta_registrations SET email_verified = 1, email_verification_token = NULL WHERE email_verification_token = :token");
            $stmt->execute(['token' => $token]);

            // Send confirmation email
            $stmt = $this->pdo->prepare("SELECT email FROM beta_registrations WHERE email_verification_token = :token");
            $stmt->execute(['token' => $token]);
            $email = $stmt->fetchColumn();

            $subject = 'Beta registration confirmed';
            $body = "Hi!\n\nYour registration for the Beta Phase of Sylent-X has been successfully confirmed.\n\nWe will get in touch with you soon.\n\nThank you for joining us!";
            GF::sendEmailToAddress($email, $subject, $body);

            return true;
        } catch (\PDOException $e) {
            throw new \Exception($e->getMessage());
        }
    }
}

$betaRegistration = new BetaRegistration($pdo);

function validateInput($input, $pattern, $errorMessage) {
    if ($input !== null && !preg_match($pattern, $input)) {
        GF::sendJsonResponse('error', $errorMessage);
    }
}

try {
    $action = $_GET['action'] ?? null;
    $name = $_GET['name'] ?? null;
    $email = $_GET['email'] ?? null;
    $discord_tag = $_GET['discord_tag'] ?? null;
    $token = $_GET['token'] ?? null;
    $ipAddress = $_SERVER['REMOTE_ADDR'];

    switch ($action) {
        case 'registerForBeta':
            validateInput($name, '/^[a-zA-Z0-9_]{0,32}$/', 'Invalid name');
            validateInput($email, '/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', 'Invalid email');
            validateInput($discord_tag, '/^[a-zA-Z0-9_]{0,32}$/', 'Invalid discord tag');

            $result = $betaRegistration->registerBetaUser($email, $ipAddress, $name, $discord_tag);

            if ($result) {
                GF::sendJsonResponse('success', 'Successfully registered! Please check your email for further instructions.');
            }
            break;

        case 'confirmBetaRegistration':
            if (empty($token)) {
                GF::sendJsonResponse('error', 'Token is required.');
            }

            $result = $betaRegistration->confirmBetaRegistration($token);

            if ($result) {
                GF::sendJsonResponse('success', 'Beta registration confirmed successfully!');
            }
            break;

        default:
            GF::sendJsonResponse('error', 'Invalid action');
            break;
    }
} catch (\Throwable $e) {
    GF::sendJsonResponse('error', 'An error occurred: ' . $e->getMessage());
}