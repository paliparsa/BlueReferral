<?php
require __DIR__ . '/app/bootstrap.php';
try {
    db()->exec("ALTER TABLE users ADD COLUMN checkin_streak INT NOT NULL DEFAULT 0");
    db()->exec("ALTER TABLE users ADD COLUMN last_checkin_date DATE NULL");
    echo "Users table updated successfully.\n";
} catch (Exception $e) {
    echo "Error updating users table (might already exist): " . $e->getMessage() . "\n";
}
