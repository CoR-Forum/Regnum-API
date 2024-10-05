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
    public function activateLicense($userId, $licenseKey) {
        // Check the license_key column for the licenseKey
        $stmt = $this->pdo->prepare('SELECT * FROM licenses WHERE license_key = ?');
        $stmt->execute([$licenseKey]);
        $license = $stmt->fetch();
        if (!$license) {
            return ['status' => 'error', 'message' => 'Invalid license key'];
        }
        if ($license['activated_by']) {
            return ['status' => 'error', 'message' => 'License key already used'];
        }
        // Check if the license is expired
        if (new DateTime() > new DateTime($license['expires_at'])) {
            return ['status' => 'error', 'message' => 'License key is expired'];
        }
        // Update the licenses table to mark the activation key as used and associate it with the user
        $stmt = $this->pdo->prepare('UPDATE licenses SET activated_by = ? WHERE license_key = ?');
        $stmt->execute([$userId, $licenseKey]);
        return ['status' => 'success', 'message' => 'Activation key used successfully'];
    }
    public function fetchLicenseDetails($userId) {
        $stmt = $this->pdo->prepare('SELECT license_key, licensed_features, expires_at FROM licenses WHERE activated_by = ?');
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
}
?>