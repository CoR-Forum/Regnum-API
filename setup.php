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
        shoutbox_banned_at TIMESTAMP DEFAULT NULL,
        shoutbox_banned_by INT DEFAULT NULL,
        shoutbox_banned_reason TEXT DEFAULT NULL,
        shoutbox_banned_until TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT NULL,
        banned TINYINT(1) DEFAULT 0,
        banned_at TIMESTAMP DEFAULT NULL,
        banned_by INT DEFAULT NULL,
        banned_reason TEXT DEFAULT NULL,
        banned_until TIMESTAMP DEFAULT NULL,
        last_activity TIMESTAMP DEFAULT NULL,
        deleted TINYINT(1) DEFAULT 0
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

    // shoutbox private messages table
    $sql = "
    CREATE TABLE IF NOT EXISTS shoutbox_private_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        recipient_id INT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (recipient_id) REFERENCES users(id)
    )";

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

    // table for storing user feedback
    $sql = "
    CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        user_id int NOT NULL,
        feedback TEXT NOT NULL,
        log TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )";
    $pdo->exec($sql);

    // table for beta_registrations
    $sql = "
    CREATE TABLE IF NOT EXISTS beta_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50),
        email VARCHAR(100) NOT NULL UNIQUE,
        discord_tag VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);

    // table for global settings
    $sql = "
    CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name ENUM('status', 'latest_version') NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);

    // crate settings table if it doesn't exist yet
    $stmt = $pdo->prepare('SELECT * FROM settings');
    $stmt->execute();
    $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (empty($settings)) {
        $sql = "
        INSERT INTO settings (name, value) VALUES
        ('status', 'active'),
        ('latest_version', '1.0.0')
        ";
        $pdo->exec($sql);
    } else {
        // add missing settings if they don't exist
        $stmt = $pdo->prepare('SELECT * FROM settings WHERE name = "latest_version"');
        $stmt->execute();
        $latestVersion = $stmt->fetch();
        if (!$latestVersion) {
            $sql = "
            INSERT INTO settings (name, value) VALUES
            ('latest_version', '1.0.0')
            ";
            $pdo->exec($sql);
        }
    }

    echo "Database and tables initialized successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>