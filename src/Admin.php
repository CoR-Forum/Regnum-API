<?php

class Admin {

    private $pdo;
    private $isAdmin;
    private $adminId;

    public function __construct($pdo, $isAdmin, $adminId) {
        $this->pdo = $pdo;
        $this->isAdmin = $isAdmin;
        $this->adminId = $adminId;
    }

    private function checkAdmin() {
        if (!$this->isAdmin) {
            throw new Exception('Access denied. User is not an admin.');
        }
        return $this->adminId;
    }

    public function getAllUsers() {
        $this->checkAdmin();
        $stmt = $this->pdo->prepare('SELECT id, username, email, is_active, is_admin, shoutbox_banned, created_at, updated_at, banned , last_login, last_activity FROM users');
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function toggleUserBan($userId, $reason = null, $until = null) {
        $adminId = $this->checkAdmin();
        
        // Get the current ban status
        $stmt = $this->pdo->prepare('SELECT banned FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $currentStatus = $stmt->fetchColumn();
        
        // Toggle the ban status
        $newStatus = !$currentStatus;
        
        if ($newStatus) {
            // Banning the user
            $stmt = $this->pdo->prepare('
                UPDATE users 
                SET 
                    banned = 1, 
                    banned_by = ?, 
                    banned_at = NOW(), 
                    banned_reason = ?, 
                    banned_until = ?, 
                    updated_at = NOW() 
                WHERE id = ?
            ');
            $stmt->execute([$adminId, $reason, $until, $userId]);
        } else {
            // Unbanning the user
            $stmt = $this->pdo->prepare('
                UPDATE users 
                SET 
                    banned = 0, 
                    banned_by = NULL, 
                    banned_at = NULL, 
                    banned_reason = NULL, 
                    banned_until = NULL, 
                    updated_at = NOW() 
                WHERE id = ?
            ');
            $stmt->execute([$userId]);
        }
        
        return ['status' => 'success', 'message' => 'User ' . ($newStatus ? 'banned' : 'unbanned') . ' successfully.'];
    }

    public function toggleUserAdmin($userId) {
        $this->checkAdmin();
        $stmt = $this->pdo->prepare('UPDATE users SET is_admin = NOT is_admin, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$userId]);
        return ['status' => 'success', 'message' => 'User ' . ($stmt->rowCount() ? 'promoted' : 'demoted ') . 'successfully.'];
    }

    public function toggleUserActivation($userId) {
        $this->checkAdmin();
        $stmt = $this->pdo->prepare('UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$userId]);
        return ['status' => 'success', 'message' => 'User ' . ($stmt->rowCount() ? 'activated' : 'deactivated ') . 'successfully.'];
    }

    public function getAllLicenses() {
        $this->checkAdmin();
        $stmt = $this->pdo->prepare('
            SELECT 
                licenses.id, 
                licenses.license_key, 
                licenses.licensed_features, 
                licenses.activated_by, 
                users.username AS activated_by_username, 
                licenses.activated_at, 
                licenses.runtime_end, 
                licenses.runtime, 
                licenses.expires_at 
            FROM licenses
            LEFT JOIN users ON licenses.activated_by = users.id
        ');
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function expireLicense($licenseId) {
        $this->checkAdmin();
        $stmt = $this->pdo->prepare('UPDATE licenses SET runtime_end = NOW() WHERE id = ?');
        $stmt->execute([$licenseId]);
        return ['status' => 'success', 'message' => 'License disabled successfully.'];
    }

    // function to modify global settings
    public function modifyGlobalSettings($setting, $value) {
        $this->checkAdmin();
        $stmt = $this->pdo->prepare('UPDATE settings SET value = :value WHERE name = :name');
        $stmt->execute([':value' => $value, ':name' => $setting]);
        return ['status' => 'success', 'message' => 'Setting updated successfully.'];
    }
}