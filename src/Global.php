<?php

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config/config.php';

use PHPMailer\PHPMailer\PHPMailer;

class GF {
    private $pdo;
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    public function getCurrentStatus() {
        try {
            $stmt = $this->pdo->prepare("SELECT value FROM settings WHERE name = 'status'");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ? $result['value'] : 'unknown';
        } catch (\PDOException $e) {
            return 'error';
        }
    }
    public static function sendJsonResponse($status, $message, $data = []) {
        echo json_encode(array_merge(['status' => $status, 'message' => $message], $data));
        exit;
    }

    // General function to send an email to the user
    // using the PHPMailer library
    // The email host, username, name, password, and port are set in the constructor
    // The email is sent in HTML format with the given subject and body
    public static function sendEmailToUser($email, $subject, $body) {
        global $emailHost, $emailUsername, $emailName, $emailPassword, $emailPort;
        $mail = new PHPMailer(true);
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = $emailHost;
            $mail->SMTPAuth = true;
            $mail->Username = $emailUsername;
            $mail->Password = $emailPassword;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $emailPort;

            // Recipients
            $mail->setFrom($emailUsername, $emailName);
            $mail->addAddress($email);

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = nl2br($body); // Convert newlines to <br> tags

            $mail->send();
        } catch (Exception $e) {
            // Handle error
        }
    }

    public static function sendEmailToAddress($email, $subject, $body) {
        global $emailHost, $emailUsername, $emailName, $emailPassword, $emailPort;
        $mail = new PHPMailer(true);
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = $emailHost;
            $mail->SMTPAuth = true;
            $mail->Username = $emailUsername;
            $mail->Password = $emailPassword;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $emailPort;

            // Recipients
            $mail->setFrom($emailUsername, $emailName);
            $mail->addAddress($email);

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = nl2br($body); // Convert newlines to <br> tags

            $mail->send();
        } catch (Exception $e) {
            // Handle error
        }
    }
}