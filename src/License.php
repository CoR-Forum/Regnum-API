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
        $stmt = $this->pdo->prepare('SELECT * FROM licenses WHERE activation_key = ?');
        $stmt->execute([$licenseActivationToken]);
        $license = $stmt->fetch();
        if (!$license) {
            return ['status' => 'error', 'message' => 'Invalid activation key'];
        }
        if ($license['activated_by']) {
            return ['status' => 'error', 'message' => 'Activation key already used'];
        }
        // Update the licenses table to mark the activation key as used and associate it with the user
        $stmt = $this->pdo->prepare('UPDATE licenses SET activated_by = ?, license_key = ?, licensed_features = ? WHERE activation_key = ?');
        $stmt->execute([$userId, $license['license_key'], $license['features'], $licenseActivationToken]);
        return ['status' => 'success', 'message' => 'Activation key used successfully'];
    }
    public function fetchLicenseDetails($userId) {
        $stmt = $this->pdo->prepare('SELECT license_key, licensed_features, expires_at FROM licenses WHERE activated_by = ?');
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
}
?>