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

    public function getLastLoginTime($userId) {
        $stmt = $this->pdo->prepare('SELECT last_login FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetchColumn();
    }

    public function updateLastLoginTime($userId) {
        $stmt = $this->pdo->prepare('UPDATE users SET last_login = NOW() WHERE id = ?');
        $stmt->execute([$userId]);
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
    // check if user is an admin
    public function isAdmin($userId) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ? AND is_admin = 1');
        $stmt->execute([$userId]);
        return $stmt->fetch() !== false;
    }

      // Check if the user is banned
    public function isBanned($userId) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = ? AND is_banned = 1');
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
            $subject = 'Activate your account';
            $body = "Click the link to activate your account: {$this->emailLinkDomain}activate.php?token=$token";
            $this->sendEmailToUser($email, $subject, $body);
            return true;
        }
        return false;
    }

    // General function to send an email to the user
    // using the PHPMailer library
    // The email host, username, name, password, and port are set in the constructor
    // The email is sent in HTML format with the given subject and body
    private function sendEmailToUser($email, $subject, $body) {
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
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $body;

            $mail->send();
        } catch (Exception $e) {
            // Handle error
        }
    }

    // Activate the user account with the given activation token.
    public function activate($token) {
        if (empty($token)) {
            return false;
        }

        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE activation_token = ?');
        $stmt->execute([$token]);
        $user = $stmt->fetch();
        if ($user) {
            $now = (new DateTime())->format('Y-m-d H:i:s');
            $stmt = $this->pdo->prepare('UPDATE users SET is_active = 1, activation_token = NULL, activated_at = ? WHERE activation_token = ?');
            return $stmt->execute([$now, $token]);
        }
        return false;
    }

    // Re-send the activation email to the user with the given email address
    public function resendActivationEmail($email) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user) {
            $subject = 'Activate your account';
            $body = "Click the link to activate your account: {$this->emailLinkDomain}activate.php?token={$user['activation_token']}";
            $this->sendEmailToUser($email, $subject, $body);
            return true;
        }
        return false;
    }

    public function initiatePasswordReset($email) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user) {
            // Disable existing tokens
            $stmt = $this->pdo->prepare('UPDATE password_reset_tokens SET disabled_at = ? WHERE user_id = ? AND disabled_at IS NULL');
            $now = (new DateTime())->format('Y-m-d H:i:s');
            $stmt->execute([$now, $user['id']]);

            // Create a new token
            $token = bin2hex(random_bytes(16));
            $stmt = $this->pdo->prepare('INSERT INTO password_reset_tokens (user_id, token, created_at) VALUES (?, ?, ?)');
            if ($stmt->execute([$user['id'], $token, $now])) {
                $subject = 'Reset your password';
                $body = "Use this token to reset your password: $token";
                $this->sendEmailToUser($email, $subject, $body);
                return true;
            }
        }
        return false;
    }

    // Reset the user's password with the given token and new password
    public function resetPassword($token, $password) {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $this->pdo->prepare('SELECT user_id, created_at, disabled_at FROM password_reset_tokens WHERE token = ? AND used_at IS NULL');
        $stmt->execute([$token]);
        $result = $stmt->fetch();
        if ($result) {
            if ($result['disabled_at'] !== null) {
                return false;
            }
            $createdAt = new DateTime($result['created_at']);
            $now = new DateTime();
            $interval = $now->diff($createdAt);
            if ($interval->h < 1) {
                $stmt = $this->pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
                if ($stmt->execute([$hash, $result['user_id']])) {
                    $stmt = $this->pdo->prepare('UPDATE password_reset_tokens SET used_at = ? WHERE token = ?');
                    $stmt->execute([$now->format('Y-m-d H:i:s'), $token]);
                    return true;
                }
            } else {
                // Token expired, initiate password reset again
                $stmt = $this->pdo->prepare('SELECT email FROM users WHERE id = ?');
                $stmt->execute([$result['user_id']]);
                $user = $stmt->fetch();
                if ($user) {
                    $this->initiatePasswordReset($user['email']);
                }
            }
        }
        return false;
    }

    // Login the user with the given username and password
    public function login($username, $password) {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['password']) && $this->isActivated($user['id']) && !$this->isBanned($user['id'])) {
            $lastLoginTime = $this->getLastLoginTime($user['id']);
            $currentTime = new DateTime();
    
            if ($lastLoginTime) {
                $lastLoginDateTime = new DateTime($lastLoginTime);
                $interval = $currentTime->diff($lastLoginDateTime);
    
                if ($interval->days >= 1) {
                    $magnat = new Magnat($this->pdo);
                    $magnat->giveMagnat($user['id'], 100, 'daily_login');
                }
            } else {
                // If last_login is null, initialize it with the current time
                $this->updateLastLoginTime($user['id']);
                $magnat = new Magnat($this->pdo);
                $magnat->giveMagnat($user['id'], 300, 'first_login');
            }
    
            $this->updateLastLoginTime($user['id']);
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

    // public API function to save the sylent-x settings in user_settings
    // a user can only have one entry in the user_settings table
    public function saveSettings($userId, $settings) {
        $stmt = $this->pdo->prepare('INSERT INTO user_settings (user_id, settings) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings = ?');
        $stmt->execute([$userId, $settings, $settings]);
        return true;
    }

    public function loadSettings($userId) {
        $stmt = $this->pdo->prepare('SELECT settings FROM user_settings WHERE user_id = ?');
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        return $result ? $result['settings'] : null;
    }
}
?>