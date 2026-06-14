<?php
require_once __DIR__ . '/../app/bootstrap.php';
migrate();
if (PHP_SAPI !== 'cli') {
    $secret = (string)($_GET['secret'] ?? '');
    if ($secret === '' || $secret !== (string)app_config('WEBHOOK_SECRET','')) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'error'=>'FORBIDDEN'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
// New preferred crypto flow: SwapWallet invoice checks. Legacy raw TXID checks are intentionally not run here
// to prevent slow external blockchain calls from affecting the bot.
$result = swapwallet_check_pending_all(25);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok'=>true] + $result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
