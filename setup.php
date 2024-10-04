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

    // Add is_active column if it doesn't exist
    $result = $pdo->query("SHOW COLUMNS FROM users LIKE 'is_active'");
    $exists = $result->rowCount() > 0;
    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD is_active TINYINT(1) DEFAULT 0");
        echo "Column 'is_active' added to table 'users'.";
    } else {
        echo "Column 'is_active' already exists in table 'users'.";
    }


    echo "Database and table 'users' created/updated successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>