<?php

class License {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function checkLicense($licenseKey) {
        $stmt = $this->pdo->prepare('SELECT licensed_features, expires_at FROM licenses WHERE license_key = ?');
        $stmt->execute([$licenseKey]);
        return $stmt->fetch();
    }

    public function activateLicense($userId, $licenseActivationToken) {
        // Check the activation_key column for the licenseActivationToken
        $stmt = $this->pdo->prepare('SELECT * FROM license_activation_keys WHERE activation_key = ?');
        $stmt->execute([$licenseActivationToken]);
        $license = $stmt->fetch();
        if (!$license) {
            return ['status' => 'error', 'message' => 'Invalid activation key'];
        }
        if ($license['activated_by']) {
            return ['status' => 'error', 'message' => 'Activation key already used'];
        }

        // Insert a new record into the licenses table
        $stmt = $this->pdo->prepare('INSERT INTO licenses (user_id, license_key, licensed_features) VALUES (?, ?, ?)');
        $stmt->execute([$userId, $license['license_key'], $license['features']]);

        // Update the license_activation_keys table to mark the activation key as used
        $stmt = $this->pdo->prepare('UPDATE license_activation_keys SET activated_by = ? WHERE activation_key = ?');
        $stmt->execute([$userId, $licenseActivationToken]);

        return ['status' => 'success', 'message' => 'Activation key used successfully'];
    }

    public function fetchLicenseDetails($userId) {
        $stmt = $this->pdo->prepare('SELECT license_key, licensed_features, expires_at FROM licenses WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
}
?>