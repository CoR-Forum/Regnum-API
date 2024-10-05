<?php
class Memory {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getMemoryPointers($userId) {
        $stmt = $this->pdo->prepare('SELECT licensed_features, expires_at FROM active_licenses WHERE user_id = ?');
        $stmt->execute([$userId]);
        $license = $stmt->fetch();

        if (!$license) {
            return ['status' => 'error', 'message' => 'No license found for user'];
        }

        $currentDate = new DateTime();
        $expiresAt = new DateTime($license['expires_at']);

        if ($currentDate > $expiresAt) {
            return ['status' => 'error', 'message' => 'License has expired'];
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
}
?>