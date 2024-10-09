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
        is_banned TINYINT(1) DEFAULT 0
    )";
    $pdo->exec($sql);

    // Add activated_at column if it doesn't exist
    $result = $pdo->query("SHOW COLUMNS FROM users LIKE 'activated_at'");
    $exists = $result->rowCount() > 0;

    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD activated_at TIMESTAMP DEFAULT NULL");
        echo "Column 'activated_at' added to table 'users'.";
    } else {
        echo "Column 'activated_at' already exists in table 'users'.";
    }

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

    // add the constraint to the user_settings table if it doesn't exist
    $result = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = 'sylent_x' AND TABLE_NAME = 'user_settings' AND CONSTRAINT_NAME = 'user_settings_user_id_unique'");
    $exists = $result->fetchColumn() > 0;

    if (!$exists) {
        $pdo->exec("ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)");
        echo "Constraint 'user_settings_user_id_unique' added to table 'user_settings'.";
    } else {
        echo "Constraint 'user_settings_user_id_unique' already exists in table 'user_settings'.";
    }

    echo "Database and tables initialized successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>