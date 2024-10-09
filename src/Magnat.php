<?php
class Magnat {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getWallet($userId) {
        $stmt = $this->pdo->prepare('SELECT amount FROM magnat WHERE user_id = ?');
        $stmt->execute([$userId]);
        $wallet = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$wallet) {
            // Create a new wallet with 100 Magnat
            $stmt = $this->pdo->prepare('INSERT INTO magnat (user_id, amount) VALUES (?, 100)');
            $stmt->execute([$userId]);

            // Log the creation transaction
            $this->logTransaction($userId, 100, 'wallet_created');

            // Fetch the newly created wallet
            $stmt = $this->pdo->prepare('SELECT amount FROM magnat WHERE user_id = ?');
            $stmt->execute([$userId]);
            $wallet = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        return $wallet;
    }

    private function updateWallet($userId, $amount, $type) {
        $this->pdo->beginTransaction();
        try {
            // Check if wallet exists
            $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM magnat WHERE user_id = ?');
            $stmt->execute([$userId]);
            $walletExists = $stmt->fetchColumn() > 0;

            if (!$walletExists) {
                // Create new wallet if it doesn't exist
                $stmt = $this->pdo->prepare('INSERT INTO magnat (user_id, amount) VALUES (?, 0)');
                $stmt->execute([$userId]);

                // Log the creation transaction
                $this->logTransaction($userId, 0, 'create');
            }

            // Update wallet amount
            $stmt = $this->pdo->prepare('UPDATE magnat SET amount = amount + ? WHERE user_id = ?');
            $stmt->execute([$amount, $userId]);

            // Log the transaction
            $this->logTransaction($userId, $amount, $type);

            $this->pdo->commit();
            return ['status' => 'success', 'message' => 'Wallet updated successfully'];
        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            return ['status' => 'error', 'message' => $e->getMessage()];
        }
    }

    private function logTransaction($userId, $amount, $type) {
        $stmt = $this->pdo->prepare('INSERT INTO magnat_transactions (user_id, magnat_id, amount, type) VALUES (?, (SELECT id FROM magnat WHERE user_id = ?), ?, ?)');
        $stmt->execute([$userId, $userId, $amount, $type]);
    }

    public function getTransactions($userId) {
        $stmt = $this->pdo->prepare('SELECT * FROM magnat_transactions WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function giveMagnat($userId, $amount, $type) {
        return $this->updateWallet($userId, $amount, $type);
    }

    public function takeMagnat($userId, $amount, $type) {
        return $this->updateWallet($userId, -$amount, $type);
    }
}
?>