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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $pdo->exec($sql);

    // Check if the email column exists
    $result = $pdo->query("SHOW COLUMNS FROM users LIKE 'email'");
    $exists = $result->rowCount() > 0;

    // Add email column if it doesn't exist
    if (!$exists) {
        $pdo->exec("ALTER TABLE users ADD email VARCHAR(100) NOT NULL");
        echo "Column 'email' added to table 'users'.";
    } else {
        echo "Column 'email' already exists in table 'users'.";
    }

    echo "Database and table 'users' created/updated successfully.";
} catch (\PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>