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
        is_banned TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);

    // Add is_banned column if it doesn't exist
    $result = $pdo->query("SHOW COLUMNS FROM users LIKE 'is_banned'");
    $exists = $result->rowCount() > 0;

    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD is_banned TINYINT(1) DEFAULT 0");
        echo "Column 'is_banned' added to table 'users'.";
    } else {
        echo "Column 'is_banned' already exists in table 'users'.";
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

    // create activated_at column if it doesn't exist
    $result = $pdo->query("SHOW COLUMNS FROM licenses LIKE 'activated_at'");
    $exists = $result->rowCount() > 0;

    if (!$exists) {
        $pdo->exec("ALTER TABLE licenses ADD activated_at TIMESTAMP DEFAULT NULL");
        echo "Column 'activated_at' added to table 'licenses'.";
    } else {
        echo "Column 'activated_at' already exists in table 'licenses'.";
    }

    // insert default license activation key
    try {
        $stmt = $pdo->prepare('INSERT INTO licenses (license_key, activation_key, features) VALUES (?, ?, ?)');
        $stmt->execute(['igh4ieg6eigahX0oe7vo1fuaz9ic2f', 'po9Hohthohsheith4Cohbodiel7rae', '["zoom", "speedhack"]']);
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

    echo "Database and tables initialized successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>