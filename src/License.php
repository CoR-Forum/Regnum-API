<?php
class License {
    private $pdo;
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    public function checkLicense($licenseKey) {
        $stmt = $this->pdo->prepare('SELECT licensed_features, runtime_end FROM licenses WHERE license_key = ?');
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
    
        // Calculate runtime_end based on the runtime
        $runtime = $license['runtime'];
        $runtimeEnd = new DateTime();
        if (preg_match('/(\d+)([hdmy])/', $runtime, $matches)) {
            $value = (int)$matches[1];
            $unit = $matches[2];
            switch ($unit) {
                case 'h':
                    $runtimeEnd->modify("+{$value} hours");
                    break;
                case 'd':
                    $runtimeEnd->modify("+{$value} days");
                    break;
                case 'm':
                    $runtimeEnd->modify("+{$value} months");
                    break;
                case 'y':
                    $runtimeEnd->modify("+{$value} years");
                    break;
            }
        } else {
            return ['status' => 'error', 'message' => 'Invalid runtime format'];
        }
    
        // Update the licenses table to mark the activation key as used and associate it with the user
        $stmt = $this->pdo->prepare('UPDATE licenses SET activated_by = ?, activated_at = ?, runtime_end = ? WHERE license_key = ?');
        $stmt->execute([$userId, (new DateTime())->format('Y-m-d H:i:s'), $runtimeEnd->format('Y-m-d H:i:s'), $licenseKey]);
        return ['status' => 'success', 'message' => 'Activation key used successfully'];
    }
    public function fetchLicenseDetails($userId) {
        $stmt = $this->pdo->prepare('SELECT license_key, licensed_features, runtime_end FROM licenses WHERE activated_by = ?');
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }

    // function to get the last activated license for a user
    public function getLastActivatedLicense($userId) {
        $stmt = $this->pdo->prepare('SELECT * FROM licenses WHERE activated_by = ? ORDER BY activated_at DESC LIMIT 1');
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }
}
?>