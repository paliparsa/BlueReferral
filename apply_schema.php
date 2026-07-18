<?php
require_once __DIR__ . '/app/bootstrap.php';
$pdo = db();
$sql = file_get_contents(__DIR__ . '/schema.sql');
$statements = array_filter(array_map('trim', explode(';', $sql)));
$ok = 0; $fail = 0;
foreach ($statements as $stmt) {
    if (empty($stmt)) continue;
    try {
        $pdo->exec($stmt);
        $ok++;
    } catch (Exception $e) {
        $fail++;
    }
}
echo "OK: $ok, FAIL: $fail\n";
