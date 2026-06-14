<?php
/**
 * BlueReferral crypto cron
 * Engine: manual wallets + TXID verification + Nobitex cached rates
 *
 * This file intentionally does NOT run migrations.
 * It is the only place that contacts Nobitex / TronScan / Toncenter so the
 * Mini App and bot webhook stay fast.
 */
require_once __DIR__ . '/../app/bootstrap.php';

$startedAt = microtime(true);

if (PHP_SAPI !== 'cli') {
    $secret = (string)($_GET['secret'] ?? '');
    if ($secret === '' || $secret !== (string)app_config('WEBHOOK_SECRET','')) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'engine'=>'manual_crypto','error'=>'FORBIDDEN'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        exit;
    }
}
header('Content-Type: application/json; charset=utf-8');

try {
    $limit = (int)($_GET['limit'] ?? 25);
    if ($limit < 1) $limit = 25;
    if ($limit > 100) $limit = 100;

    $rateResult = ['skipped'=>true];
    if (setting('crypto_rate_source','nobitex') === 'nobitex') {
        $rateResult = crypto_refresh_rates_from_nobitex(true);
    }

    $checked = 0; $confirmed = 0; $errors = 0;
    if (table_exists('crypto_payment_checks')) {
        $q = db()->prepare('SELECT order_id FROM crypto_payment_checks WHERE status="pending" AND tx_hash IS NOT NULL AND tx_hash<>"" ORDER BY COALESCE(last_checked_at, created_at) ASC LIMIT ?');
        $q->bindValue(1, $limit, PDO::PARAM_INT);
        $q->execute();
        foreach ($q->fetchAll() as $row) {
            $checked++;
            try {
                $before = get_crypto_check_by_order((int)$row['order_id']);
                $after = crypto_verify_order((int)$row['order_id']);
                if ($after && ($after['status'] ?? '') === 'confirmed' && (!$before || ($before['status'] ?? '') !== 'confirmed')) $confirmed++;
            } catch (Throwable $e) { $errors++; error_log('[BlueReferral Crypto Cron] order '.$row['order_id'].' '.$e->getMessage()); }
        }
    }

    echo json_encode([
        'ok'=>true,
        'engine'=>'manual_crypto_txid',
        'nobitex_rates'=>$rateResult,
        'checked'=>$checked,
        'confirmed'=>$confirmed,
        'errors'=>$errors,
        'duration_ms'=>(int)round((microtime(true)-$startedAt)*1000),
    ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[BlueReferral Crypto Cron] '.$e->getMessage());
    echo json_encode(['ok'=>false,'engine'=>'manual_crypto_txid','error'=>$e->getMessage(),'duration_ms'=>(int)round((microtime(true)-$startedAt)*1000)], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}
