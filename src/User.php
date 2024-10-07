<?php
// Path: src/User.php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require '../vendor/autoload.php';

// User class
class User {
    private $pdo;
    private $emailHost;
    private $emailUsername;
    private $emailName;
    private $emailPassword;
    private $emailPort;
    private $emailLinkDomain;

    // Constructor with $pdo parameter
    public function __construct($pdo) {
        $this->pdo = $pdo;
        global $emailHost, $emailUsername, $emailName, $emailPassword, $emailPort, $emailLinkDomain;
        $this->emailHost = $emailHost;
        $this->emailUsername = $emailUsername;
        $this->emailName = $emailName;
        $this->emailPassword = $emailPassword;
        $this->emailPort = $emailPort;
        $this->emailLinkDomain = $emailLinkDomain;
    }

    // Check if the user exists with the given username or email
    public function userExists($username, $email) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = ? OR email = ?');
        $stmt->execute([$username, $email]);
        return $stmt->fetch() !== false;
    }
    
    // Check if the user is activated
    public function isActivated($userId) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ? AND is_active = 1');
        $stmt->execute([$userId]);
        return $stmt->fetch() !== false;
    }

    // Register a new user with the given username, password, and email.
    // The password is hashed before storing it in the database.
    // An activation token is generated and sent to the user's email.
    public function register($username, $password, $email) {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $token = bin2hex(random_bytes(16));
        $stmt = $this->pdo->prepare('INSERT INTO users (username, password, email, activation_token) VALUES (?, ?, ?, ?)');
        if ($stmt->execute([$username, $hash, $email, $token])) {
            $this->sendActivationEmail($email, $token);
            return true;
        }
        return false;
    }

    // Send an activation email to the user with the activation token
    private function sendActivationEmail($email, $token) {
        $mail = new PHPMailer(true);
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = $this->emailHost;
            $mail->SMTPAuth = true;
            $mail->Username = $this->emailUsername;
            $mail->Password = $this->emailPassword;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $this->emailPort;

            // Recipients
            $mail->setFrom($this->emailUsername, $this->emailName);
            $mail->addAddress($email);

            // Content
            $domain = $this->emailLinkDomain;
            $mail->isHTML(true);
            $mail->Subject = 'Activate your account';
            $mail->Body    = "Click the link to activate your account: {$domain}activate.php?token=$token";

            $mail->send();
        } catch (Exception $e) {
            // Handle error
        }
    }

    // Activate the user account with the given activation token
    public function activate($token) {
        if (empty($token)) {
            return false;
        }

        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE activation_token = ?');
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        if ($user) {
            $stmt = $this->pdo->prepare('UPDATE users SET is_active = 1, activation_token = NULL WHERE activation_token = ?');
            return $stmt->execute([$token]);
        }
        return false;
    }

    // Login the user with the given username and password
    public function login($username, $password) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['password']) && $user['is_active']) {
            return $user;
        }
        return false;
    }
    
    // Get the user ID with the given username
    public function getUserId($username) {
        $stmt = $this->pdo->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        return $user['id'] ?? null;
    }
}
?>