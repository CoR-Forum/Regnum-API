<?php
class Shoutbox {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function addMessage($userId, $message) {
        $stmt = $this->pdo->prepare('INSERT INTO shoutbox_messages (user_id, message, created_at) VALUES (?, ?, ?)');
        $stmt->execute([$userId, $message, (new DateTime())->format('Y-m-d H:i:s')]);

        // Fetch the last 50 messages
        $messages = $this->getLastMessages(50);

        return ['status' => 'success', 'message' => 'Message added successfully', 'messages' => $messages];
    }

    public function getMessages() {
        $stmt = $this->pdo->query('SELECT s.message, s.created_at, u.username FROM shoutbox_messages s JOIN users u ON s.user_id = u.id ORDER BY s.created_at ASC');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getLastMessages($limit) {
        $stmt = $this->pdo->prepare('SELECT s.message, s.created_at, u.username FROM shoutbox_messages s JOIN users u ON s.user_id = u.id ORDER BY s.created_at ASC LIMIT ?');
        $stmt->bindValue(1, (int)$limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>