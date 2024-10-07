<?php
class Memory {
    private $pdo;
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    public function getMemoryPointers($userId) {
        $stmt = $this->pdo->prepare('SELECT licensed_features, expires_at FROM licenses WHERE activated_by = ? ORDER BY activated_at DESC LIMIT 1');
        $stmt->execute([$userId]);
        $license = $stmt->fetch();
        if (!$license) {
            return $this->getZoomPointer();
        }
        if (!is_null($license['expires_at'])) {
            $currentDate = new DateTime();
            try {
                $expiresAt = new DateTime($license['expires_at']);
            } catch (Exception $e) {
                return ['status' => 'error', 'message' => 'License expiration date is invalid'];
            }
            if ($currentDate > $expiresAt) {
                return $this->getZoomPointer();
            }
        }
        $licensedFeatures = json_decode($license['licensed_features'], true);
        $memoryPointers = [];
        foreach ($licensedFeatures as $feature) {
            // Assuming you have a table `memory_pointers` with columns `feature`, `address`, and `offsets`
            $stmt = $this->pdo->prepare('SELECT address, offsets FROM memory_pointers WHERE feature = ?');
            $stmt->execute([$feature]);
            $pointer = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($pointer) {
                $memoryPointers[$feature] = $pointer;
            }
        }
        return ['status' => 'success', 'memory_pointers' => $memoryPointers];
    }

    private function getZoomPointer() {
        $stmt = $this->pdo->prepare('SELECT address, offsets FROM memory_pointers WHERE feature = ?');
        $stmt->execute(['zoom']);
        $pointer = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($pointer) {
            return ['status' => 'success', 'memory_pointers' => ['zoom' => $pointer]];
        }
        return ['status' => 'error', 'message' => 'Zoom pointer not found'];
    }
}
?>
