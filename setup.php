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
        activated_at TIMESTAMP DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 0,
        is_admin TINYINT(1) DEFAULT 0,
        shoutbox_banned TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT NULL,
        is_banned TINYINT(1) DEFAULT 0,
        last_activity TIMESTAMP DEFAULT NULL
    )";
    $pdo->exec($sql);

    // Create table for password reset tokens
    $sql = "
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP DEFAULT NULL,
        disabled_at TIMESTAMP DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )";
    $pdo->exec($sql);

    // Create licenses table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS licenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        license_key VARCHAR(255) NOT NULL UNIQUE,
        activated_by INT DEFAULT NULL,
        activated_at TIMESTAMP DEFAULT NULL,
        runtime VARCHAR(10) DEFAULT NULL,
        runtime_end TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT NULL,
        licensed_features TEXT,
        FOREIGN KEY (activated_by) REFERENCES users(id)
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

    // sylent-x user settings table
    $sql = "
    CREATE TABLE IF NOT EXISTS user_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        settings TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
    )";
    $pdo->exec($sql);

    // magnat currency
    // create table for storing magnat amounts, every user_id can only have one entry
    $sql = "
    CREATE TABLE IF NOT EXISTS magnat (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount INT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT magnat_currency_user_id_unique UNIQUE (user_id)
    )";
    $pdo->exec($sql);

    // magnat transactions
    // create table for storing magnat currency transactions
    $sql = "
    CREATE TABLE IF NOT EXISTS magnat_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        magnat_id INT NOT NULL,
        amount INT NOT NULL,
        type VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (magnat_id) REFERENCES magnat(id)
    )";
    $pdo->exec($sql);

    echo "Database and tables initialized successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>