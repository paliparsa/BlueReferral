<?php
require_once __DIR__ . '/../app/bot_logic.php';
header('Content-Type: application/json; charset=utf-8');

function api_out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function request_json(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}
function webapp_auth_user(string $initData): array {
    $validated = verify_webapp_init_data($initData);
    if (!$validated || empty($validated['user'])) api_out(['ok'=>false, 'error'=>'INVALID_TELEGRAM_WEBAPP_DATA'], 401);
    $tgUser = json_decode($validated['user'], true);
    if (!$tgUser || empty($tgUser['id'])) api_out(['ok'=>false, 'error'=>'INVALID_TELEGRAM_USER'], 401);
    $user = create_or_update_user($tgUser, null);
    if (is_joined_channel((int)$tgUser['id'])) try_reward_referrer($user);
    return get_user_by_tid((int)$tgUser['id']);
}
function user_payload(array $user): array {
    $vip = vip_info((int)$user['referrals_count']);
    $today = today_referrals((int)$user['id']);
    return [
        'telegram_id'=>(int)$user['telegram_id'],
        'username'=>$user['username'],
        'first_name'=>$user['first_name'],
        'ref_code'=>$user['ref_code'],
        'referral_link'=>referral_link($user),
        'balance'=>(int)$user['balance'],
        'total_earned'=>(int)$user['total_earned'],
        'total_withdrawn'=>(int)$user['total_withdrawn'],
        'referrals_count'=>(int)$user['referrals_count'],
        'today_referrals'=>$today,
        'spin_balance'=>(int)$user['spin_balance'],
        'vip'=>$vip,
    ];
}
function dashboard_payload(array $user): array {
    $missions = [];
    $today = date('Y-m-d');
    $todayCount = today_referrals((int)$user['id']);
    foreach (mission_rows() as $m) {
        $missions[] = [
            'target'=>(int)$m['target'],
            'reward'=>(int)$m['reward'],
            'done'=>$todayCount >= (int)$m['target'],
            'claimed'=>is_mission_claimed((int)$user['id'], $today, (int)$m['target']),
        ];
    }
    $tx = db()->prepare('SELECT type, amount, description, created_at FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 15');
    $tx->execute([$user['id']]);
    $wd = db()->prepare('SELECT amount, status, created_at FROM withdrawals WHERE user_id=? ORDER BY id DESC LIMIT 10');
    $wd->execute([$user['id']]);
    return [
        'ok'=>true,
        'brand'=>setting('brand_name', app_config('BRAND_NAME', 'BlueGate')),
        'theme_color'=>setting('theme_color', app_config('DEFAULT_THEME_COLOR', '#1d9bf0')),
        'start_reward'=>setting_int('start_reward', 2000),
        'min_withdraw'=>setting_int('min_withdraw', 50000),
        'spin_every'=>setting_int('spin_referrals_per_chance', 5),
        'support_username'=>app_config('SUPPORT_USERNAME', 'BlueGateSupport'),
        'custom_code_min'=>setting_int('custom_code_min_referrals', 3),
        'user'=>user_payload($user),
        'missions'=>$missions,
        'leaderboard'=>array_map(function($r){ return ['name'=>strip_tags(display_name($r)), 'referrals'=>(int)$r['referrals_count'], 'earned'=>(int)$r['total_earned']]; }, top_users(10)),
        'transactions'=>$tx->fetchAll(),
        'withdrawals'=>$wd->fetchAll(),
        'shop_categories'=>array_map(function($c){ return ['id'=>(int)$c['id'], 'title'=>$c['title'], 'emoji'=>$c['emoji']]; }, shop_categories(true)),
        'shop_products'=>array_map(function($p){ return ['id'=>(int)$p['id'], 'category_id'=>(int)$p['category_id'], 'name'=>$p['name'], 'price'=>(int)$p['price'], 'short_description'=>$p['short_description'], 'full_description'=>$p['full_description'], 'delivery_type'=>$p['delivery_type'], 'delivery_type_fa'=>delivery_type_fa($p['delivery_type']), 'commission'=>product_commission_text($p)]; }, shop_products(null, true)),
        'orders'=>array_map('order_public_payload', user_orders((int)$user['id'], 12)),
        'payment_instructions'=>setting('payment_instructions', 'لطفاً پرداخت را انجام دهید و رسید را ارسال کنید.'),
    ];
}

$input = request_json();
$action = $input['action'] ?? ($_GET['action'] ?? 'me');
$initData = $input['initData'] ?? ($_GET['initData'] ?? '');
$user = webapp_auth_user((string)$initData);

if ($action === 'me') api_out(dashboard_payload($user));

if ($action === 'claim_missions') {
    [$count, $claimed] = claim_available_missions($user);
    $fresh = get_user_by_tid((int)$user['telegram_id']);
    api_out(dashboard_payload($fresh) + ['claimed'=>$claimed, 'today_count'=>$count]);
}

if ($action === 'spin') {
    $user = get_user_by_tid((int)$user['telegram_id']);
    if ((int)$user['spin_balance'] <= 0) api_out(['ok'=>false, 'error'=>'NO_SPIN_BALANCE', 'message'=>'فعلاً شانس گردونه نداری.'], 400);
    $reward = weighted_spin_reward();
    $title = $reward['title'] ?? 'جایزه گردونه';
    $amount = (int)($reward['amount'] ?? 0);
    db()->prepare('UPDATE users SET spin_balance=spin_balance-1 WHERE id=? AND spin_balance>0')->execute([$user['id']]);
    db()->prepare('INSERT INTO spin_logs (user_id, prize_title, prize_amount) VALUES (?,?,?)')->execute([$user['id'], $title, $amount]);
    if ($amount > 0) add_balance($user['id'], $amount, 'spin_reward', $title, null);
    if (!empty($reward['notify_admin'])) notify_admins("🎡 جایزه Mini App نیازمند بررسی\nکاربر: <code>{$user['telegram_id']}</code>\nجایزه: <b>".h($title)."</b>");
    $fresh = get_user_by_tid((int)$user['telegram_id']);
    api_out(dashboard_payload($fresh) + ['prize'=>['title'=>$title, 'amount'=>$amount]]);
}

if ($action === 'withdraw') {
    $user = get_user_by_tid((int)$user['telegram_id']);
    $card = trim((string)($input['card_info'] ?? ''));
    if (mb_strlen($card) < 8) api_out(['ok'=>false, 'error'=>'INVALID_CARD_INFO', 'message'=>'اطلاعات کارت/شبا کامل نیست.'], 400);
    $min = setting_int('min_withdraw', 50000);
    if ((int)$user['balance'] < $min) api_out(['ok'=>false, 'error'=>'LOW_BALANCE', 'message'=>'موجودی به حداقل برداشت نمی‌رسد.'], 400);
    $pending = db()->prepare('SELECT COUNT(*) c FROM withdrawals WHERE user_id=? AND status="pending"');
    $pending->execute([$user['id']]);
    if ((int)$pending->fetch()['c'] > 0) api_out(['ok'=>false, 'error'=>'PENDING_WITHDRAWAL', 'message'=>'یک برداشت در انتظار دارید.'], 400);
    $amount = (int)$user['balance'];
    db()->prepare('INSERT INTO withdrawals (user_id, amount, card_info) VALUES (?,?,?)')->execute([$user['id'], $amount, $card]);
    db()->prepare('UPDATE users SET balance=0 WHERE id=?')->execute([$user['id']]);
    notify_admins("🏧 برداشت جدید از Mini App\nکاربر: <code>{$user['telegram_id']}</code>\nمبلغ: <b>".money($amount)."</b>\nاطلاعات:\n".h($card));
    $fresh = get_user_by_tid((int)$user['telegram_id']);
    api_out(dashboard_payload($fresh) + ['withdraw_amount'=>$amount]);
}

if ($action === 'custom_code') {
    $code = normalize_ref_code((string)($input['code'] ?? ''));
    $min = setting_int('custom_code_min_referrals', 3);
    if ((int)$user['referrals_count'] < $min) api_out(['ok'=>false, 'error'=>'NOT_ENOUGH_REFERRALS', 'message'=>"حداقل {$min} زیرمجموعه لازم است."], 400);
    if (strlen($code) < 4 || strlen($code) > 20) api_out(['ok'=>false, 'error'=>'INVALID_CODE', 'message'=>'کد باید ۴ تا ۲۰ کاراکتر باشد.'], 400);
    $exists = get_user_by_ref($code);
    if ($exists && (int)$exists['id'] !== (int)$user['id']) api_out(['ok'=>false, 'error'=>'CODE_TAKEN', 'message'=>'این کد قبلاً گرفته شده.'], 400);
    db()->prepare('UPDATE users SET ref_code=? WHERE id=?')->execute([$code, $user['id']]);
    $fresh = get_user_by_tid((int)$user['telegram_id']);
    api_out(dashboard_payload($fresh));
}


if ($action === 'create_order') {
    $productId = (int)($input['product_id'] ?? 0);
    try {
        $order = create_shop_order((int)$user['id'], $productId);
        notify_admins("🧾 سفارش جدید از Mini App\nسفارش: <code>#{$order['id']}</code>\nکاربر: <code>{$user['telegram_id']}</code>\nمحصول: <b>".h($order['product_name'])."</b>\nمبلغ: <b>".money($order['final_amount'])."</b>");
        api_out(dashboard_payload(get_user_by_tid((int)$user['telegram_id'])) + ['order'=>order_public_payload($order)]);
    } catch (Throwable $e) { api_out(['ok'=>false, 'error'=>'PRODUCT_NOT_FOUND', 'message'=>'محصول پیدا نشد یا غیرفعال است.'], 404); }
}

if ($action === 'apply_coupon') {
    $orderId = (int)($input['order_id'] ?? 0);
    $code = (string)($input['code'] ?? '');
    try {
        $order = apply_coupon_to_order($orderId, (int)$user['id'], $code);
        api_out(dashboard_payload(get_user_by_tid((int)$user['telegram_id'])) + ['order'=>order_public_payload($order)]);
    } catch (Throwable $e) { api_out(['ok'=>false, 'error'=>'INVALID_COUPON', 'message'=>'کد تخفیف معتبر نیست یا برای این سفارش قابل استفاده نیست.'], 400); }
}

if ($action === 'submit_receipt') {
    $orderId = (int)($input['order_id'] ?? 0);
    $note = trim((string)($input['note'] ?? ''));
    if (mb_strlen($note) < 3) api_out(['ok'=>false, 'error'=>'EMPTY_RECEIPT', 'message'=>'توضیح رسید پرداخت را کامل‌تر بنویس.'], 400);
    try {
        $order = submit_order_receipt($orderId, (int)$user['id'], $note, null);
        notify_admins(order_admin_card($order) . "\n\nرسید/توضیح پرداخت از Mini App:\n" . h($note));
        api_out(dashboard_payload(get_user_by_tid((int)$user['telegram_id'])) + ['order'=>order_public_payload($order)]);
    } catch (Throwable $e) { api_out(['ok'=>false, 'error'=>'ORDER_NOT_FOUND', 'message'=>'سفارش پیدا نشد یا قابل پرداخت نیست.'], 400); }
}

if ($action === 'cancel_order') {
    $orderId = (int)($input['order_id'] ?? 0);
    $order = order_by_id($orderId);
    if (!$order || (int)$order['user_id'] !== (int)$user['id'] || $order['status'] !== 'pending_payment') api_out(['ok'=>false, 'error'=>'ORDER_LOCKED', 'message'=>'امکان لغو این سفارش نیست.'], 400);
    db()->prepare('UPDATE orders SET status="canceled" WHERE id=?')->execute([$orderId]);
    api_out(dashboard_payload(get_user_by_tid((int)$user['telegram_id'])));
}

api_out(['ok'=>false, 'error'=>'UNKNOWN_ACTION'], 404);
