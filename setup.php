<?php
require_once __DIR__ . '/config/config.php';

try {
    // Create users table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100) NOT NULL,
        activation_token VARCHAR(255) DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 0,
        shoutbox_banned TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);

    // Add updated_at column if it doesn't exist
    $result = $pdo->query("SHOW COLUMNS FROM users LIKE 'updated_at'");
    $exists = $result->rowCount() > 0;

    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        echo "Column 'updated_at' added to table 'users'.";
    } else {
        echo "Column 'updated_at' already exists in table 'users'.";
    }

    // add shoutbox_banned column if it doesn't exist
    $result = $pdo->query("SHOW COLUMNS FROM users LIKE 'shoutbox_banned'");
    $exists = $result->rowCount() > 0;

    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD shoutbox_banned TINYINT(1) DEFAULT 0");
        echo "Column 'shoutbox_banned' added to table 'users'.";
    } else {
        echo "Column 'shoutbox_banned' already exists in table 'users'.";
    }

    // Create licenses table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS licenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL UNIQUE,
        activated_by INT DEFAULT NULL,
        activated_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT NULL,
        licensed_features TEXT,
        FOREIGN KEY (activated_by) REFERENCES users(id)
    )";
    $pdo->exec($sql);

    // insert default license activation key
    try {
        $stmt = $pdo->prepare('INSERT INTO licenses (license_key, features) VALUES (?, ?, ?)');
        $stmt->execute(['igh4ieg6eigahX0oe7vo1fuaz9ic2f', '["zoom", "speedhack"]']);
    } catch (\PDOException $e) {
        echo "Error inserting default license activation key: " . $e->getMessage();
    }

    // create table for storing memory addresses and offsets
    $sql = "
    CREATE TABLE IF NOT EXISTS memory_pointers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        feature VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        offsets TEXT
    )";
    $pdo->exec($sql);

    // shoutbox messages table
    $sql = "
    CREATE TABLE IF NOT EXISTS shoutbox_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP DEFAULT NULL,
        deleted_by INT DEFAULT NULL,
        seen_by TEXT DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )";
    $pdo->exec($sql);

    echo "Database and tables initialized successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>