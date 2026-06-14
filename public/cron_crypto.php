<?php
/**
 * BlueReferral crypto cron
 * Engine: SwapWallet V2 temporary-wallet invoice status checker
 *
 * This file intentionally does NOT run migrations and does NOT check legacy
 * raw TXID / Nobitex / Tron / TON flows. It only refreshes pending
 * SwapWallet invoices so Mini App and bot requests stay fast.
 */
require_once __DIR__ . '/../app/bootstrap.php';

$startedAt = microtime(true);

if (PHP_SAPI !== 'cli') {
    $secret = (string)($_GET['secret'] ?? '');
    if ($secret === '' || $secret !== (string)app_config('WEBHOOK_SECRET','')) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'engine' => 'swapwallet_v2',
            'error' => 'FORBIDDEN',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

header('Content-Type: application/json; charset=utf-8');

try {
    if (isset($_GET['health'])) {
        echo json_encode([
            'ok' => true,
            'engine' => 'swapwallet_v2',
            'configured' => function_exists('swapwallet_configured') ? swapwallet_configured() : false,
            'time' => date('c'),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $limit = (int)($_GET['limit'] ?? 25);
    if ($limit < 1) $limit = 25;
    if ($limit > 100) $limit = 100;

    $result = swapwallet_check_pending_all($limit);

    echo json_encode([
        'ok' => true,
        'engine' => 'swapwallet_v2',
        'legacy_txid_checks' => false,
        'nobitex_checks' => false,
        'duration_ms' => (int)round((microtime(true) - $startedAt) * 1000),
    ] + $result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[BlueReferral SwapWallet Cron] '.$e->getMessage());
    echo json_encode([
        'ok' => false,
        'engine' => 'swapwallet_v2',
        'error' => $e->getMessage(),
        'duration_ms' => (int)round((microtime(true) - $startedAt) * 1000),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
