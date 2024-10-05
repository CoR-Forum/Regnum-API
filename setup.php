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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);

    // Add activation_token column if it doesn't exist
    $result = $pdo->query("SHOW COLUMNS FROM users LIKE 'activation_token'");
    $exists = $result->rowCount() > 0;
    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD activation_token VARCHAR(100) DEFAULT NULL");
        echo "Column 'activation_token' added to table 'users'.";
    } else {
        echo "Column 'activation_token' already exists in table 'users'.";
    }

    // Create license_activation_keys table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS license_activation_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL UNIQUE,
        activation_key VARCHAR(255) NOT NULL UNIQUE,
        activated_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT NULL,
        features TEXT,
        FOREIGN KEY (activated_by) REFERENCES users(id)
    )";
    $pdo->exec($sql);

    // insert default license activation key
    try {
        $stmt = $pdo->prepare('INSERT INTO license_activation_keys (license_key, activation_key, features) VALUES (?, ?, ?)');
        $stmt->execute(['igh4ieg6eigahX0oe7vo1fuaz9ic2f', 'po9Hohthohsheith4Cohbodiel7rae', '["zoom", "speedhack"]']);
    } catch (\PDOException $e) {
        echo "Error inserting default license activation key: " . $e->getMessage();
    }

    // Create licenses table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS licenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        license_key VARCHAR(255) NOT NULL,
        licensed_features TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (license_key) REFERENCES license_activation_keys(license_key)
    )";
    $pdo->exec($sql);

    // create table for storing memory addresses and offsets
    $sql = "
    CREATE TABLE IF NOT EXISTS memory_pointers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        feature VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        offsets TEXT
    )";
    $pdo->exec($sql);

    echo "Database and tables 'users', 'licenses', and 'license_activation_keys' created/updated successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>