<?php
class Memory {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getMemoryPointers($userId) {
        $stmt = $this->pdo->prepare('SELECT licensed_features, runtime_end FROM licenses WHERE activated_by = ? ORDER BY activated_at DESC LIMIT 1');
        $stmt->execute([$userId]);
        $license = $stmt->fetch();

        if (!$license) {
            return ['status' => 'error', 'message' => 'License not found'];
        }

        if (!is_null($license['runtime_end'])) {
            $currentDate = new DateTime();
            try {
                $expiresAt = new DateTime($license['runtime_end']);
            } catch (Exception $e) {
                return ['status' => 'error', 'message' => 'License expiration date is invalid'];
            }
            if ($currentDate > $expiresAt) {
                return ['status' => 'error', 'message' => 'License expired'];
            }
        }

        $licensedFeatures = json_decode($license['licensed_features'], true);
        $featuresToInclude = array_merge(['zoom', 'posx', 'posy', 'posz'], $licensedFeatures);

        $placeholders = str_repeat('?,', count($featuresToInclude) - 1) . '?';
        $stmt = $this->pdo->prepare("SELECT feature, address, offsets FROM memory_pointers WHERE feature IN ($placeholders)");
        $stmt->execute($featuresToInclude);
        $pointers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $memoryPointers = [];
        foreach ($pointers as $pointer) {
            $memoryPointers[$pointer['feature']] = $pointer;
        }

        return ['status' => 'success', 'memory_pointers' => $memoryPointers];
    }
}