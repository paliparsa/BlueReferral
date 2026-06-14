<?php
if (!file_exists(__DIR__ . '/../config.php')) {
    http_response_code(500);
    exit('Missing config.php. Copy config.example.php to config.php first.');
}
require_once __DIR__ . '/../config.php';

if (!empty($TIMEZONE)) date_default_timezone_set($TIMEZONE);

function app_config(string $key, $default = null) {
    return $GLOBALS[$key] ?? $default;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $host = app_config('DB_HOST', 'localhost');
        $name = app_config('DB_NAME');
        $user = app_config('DB_USER');
        $pass = app_config('DB_PASS');
        $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function run_sql_file(string $path): void {
    $sql = file_get_contents($path);
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        if ($stmt !== '') db()->exec($stmt);
    }
}

function table_exists(string $table): bool {
    $dbName = app_config('DB_NAME');
    $q = db()->prepare('SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?');
    $q->execute([$dbName, $table]);
    return (int)$q->fetch()['c'] > 0;
}

function column_exists(string $table, string $column): bool {
    $dbName = app_config('DB_NAME');
    $q = db()->prepare('SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');
    $q->execute([$dbName, $table, $column]);
    return (int)$q->fetch()['c'] > 0;
}

function add_column_if_missing(string $table, string $column, string $definition): void {
    if (table_exists($table) && !column_exists($table, $column)) {
        db()->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
    }
}

function seed_setting(string $key, $value): void {
    $stored = is_string($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE);
    $q = db()->prepare('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)');
    $q->execute([$key, $stored]);
}

function migrate(): void {
    run_sql_file(__DIR__ . '/../schema.sql');

    // Safe upgrade path from older BlueGate ReferralWallet versions.
    add_column_if_missing('users', 'last_name', 'VARCHAR(255) NULL AFTER first_name');
    add_column_if_missing('users', 'ref_rewarded', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER referrer_id');
    add_column_if_missing('users', 'spin_balance', 'INT NOT NULL DEFAULT 0 AFTER referrals_count');
    add_column_if_missing('users', 'step_payload', 'TEXT NULL AFTER step');
    add_column_if_missing('users', 'theme_color', 'VARCHAR(16) NULL AFTER step_payload');
    add_column_if_missing('users', 'phone_number', 'VARCHAR(32) NULL AFTER theme_color');
    add_column_if_missing('users', 'contact_first_name', 'VARCHAR(255) NULL AFTER phone_number');
    add_column_if_missing('users', 'contact_last_name', 'VARCHAR(255) NULL AFTER contact_first_name');
    add_column_if_missing('users', 'contact_shared_at', 'DATETIME NULL AFTER contact_last_name');
    try { db()->exec('ALTER TABLE transactions MODIFY COLUMN type VARCHAR(64) NOT NULL'); } catch (Throwable $e) {}
    try { db()->exec("UPDATE users u SET ref_rewarded=1 WHERE referrer_id IS NOT NULL AND EXISTS (SELECT 1 FROM transactions t WHERE t.type='ref_start' AND t.related_user_id=u.id)"); } catch (Throwable $e) {}
    try { db()->exec('INSERT IGNORE INTO referrals (referrer_id, referred_id, reward_amount, created_at) SELECT referrer_id, id, 0, created_at FROM users WHERE referrer_id IS NOT NULL'); } catch (Throwable $e) {}

    seed_setting('start_reward', app_config('START_REWARD', 2000));
    seed_setting('min_withdraw', app_config('MIN_WITHDRAW', 50000));
    seed_setting('purchase_reward', app_config('PURCHASE_REWARD', 10000));
    seed_setting('mission_1_target', app_config('MISSION_1_TARGET', 1));
    seed_setting('mission_1_reward', app_config('MISSION_1_REWARD', 3000));
    seed_setting('mission_2_target', app_config('MISSION_2_TARGET', 3));
    seed_setting('mission_2_reward', app_config('MISSION_2_REWARD', 10000));
    seed_setting('mission_3_target', app_config('MISSION_3_TARGET', 5));
    seed_setting('mission_3_reward', app_config('MISSION_3_REWARD', 25000));
    seed_setting('spin_referrals_per_chance', app_config('SPIN_REFERRALS_PER_CHANCE', 5));
    seed_setting('spin_rewards', app_config('SPIN_REWARDS', []));
    seed_setting('custom_code_min_referrals', app_config('CUSTOM_CODE_MIN_REFERRALS', 3));
    seed_setting('theme_color', app_config('DEFAULT_THEME_COLOR', '#1d9bf0'));
    seed_setting('button_colors_enabled', '1');
    seed_setting('button_colors', ['primary'=>'#1d9bf0','secondary'=>'#2563eb','danger'=>'#ef4444','success'=>'#22c55e','warning'=>'#f59e0b']);
    seed_setting('auth_contact_required', app_config('AUTH_CONTACT_REQUIRED', '0') ? '1' : '0');
    seed_setting('notify_admin_on_start', '1');
    seed_setting('brand_name', app_config('BRAND_NAME', 'BlueGate'));
    seed_setting('payment_instructions', app_config('PAYMENT_INSTRUCTIONS', 'لطفاً مبلغ فاکتور را کارت‌به‌کارت کنید و سپس رسید پرداخت را از دکمه ارسال رسید بفرستید.'));
    seed_setting('delivery_template_account', "📩 اطلاعات اکانت شما\n\n{delivery}\n\n⚠️ لطفاً رمز را تغییر ندهید مگر ادمین گفته باشد.");
    seed_setting('delivery_template_vpn', "🔐 سرویس VPN شما آماده شد\n\n{delivery}\n\nاگر نیاز به راهنما داشتی، به پشتیبانی پیام بده.");
    seed_setting('delivery_template_code', "🎟 کد/لایسنس شما آماده شد\n\n{delivery}");
    seed_setting('delivery_template_manual', "📦 سفارش شما آماده شد\n\n{delivery}");

    // Safe Commerce Plus upgrade columns. These commands are idempotent and keep older installs intact.
    add_column_if_missing('product_categories', 'image_url', 'VARCHAR(1024) NULL AFTER emoji');
    add_column_if_missing('products', 'image_url', 'VARCHAR(1024) NULL AFTER full_description');
    add_column_if_missing('products', 'is_featured', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
    add_column_if_missing('orders', 'variant_id', 'BIGINT UNSIGNED NULL AFTER product_id');
    add_column_if_missing('orders', 'expires_at', 'DATETIME NULL AFTER delivery_text');
    add_column_if_missing('orders', 'delivered_inventory_id', 'BIGINT UNSIGNED NULL AFTER delivery_text');
    add_column_if_missing('orders', 'customer_note', 'TEXT NULL AFTER payment_note');
    add_column_if_missing('orders', 'review_started_at', 'DATETIME NULL AFTER receipt_file_id');
    add_column_if_missing('orders', 'paid_at', 'DATETIME NULL AFTER review_started_at');
    add_column_if_missing('orders', 'prepared_at', 'DATETIME NULL AFTER paid_at');
    add_column_if_missing('orders', 'delivered_at', 'DATETIME NULL AFTER prepared_at');
    add_column_if_missing('orders', 'rejected_at', 'DATETIME NULL AFTER delivered_at');
    add_column_if_missing('orders', 'canceled_at', 'DATETIME NULL AFTER rejected_at');

    seed_shop_categories();
}

function setting(string $key, $default = null) {
    $q = db()->prepare('SELECT setting_value FROM settings WHERE setting_key=?');
    $q->execute([$key]);
    $row = $q->fetch();
    return $row ? $row['setting_value'] : $default;
}
function setting_int(string $key, int $default = 0): int { return (int)setting($key, $default); }
function setting_json(string $key, array $default = []): array {
    $value = setting($key, null);
    if ($value === null || $value === '') return $default;
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : $default;
}
function set_setting(string $key, $value): void {
    $stored = is_string($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE);
    $q = db()->prepare('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)');
    $q->execute([$key, $stored]);
}

function tg(string $method, array $data = []) {
    $token = app_config('BOT_TOKEN');
    $url = "https://api.telegram.org/bot{$token}/{$method}";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $data,
        CURLOPT_TIMEOUT => 20,
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) return ['ok' => false, 'description' => $err];
    return json_decode($res ?: '{}', true);
}

function h($value): string { return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function money($amount): string { return number_format((int)$amount) . ' تومان'; }
function is_admin($id): bool {
    $admins = app_config('ADMIN_IDS', []);
    return in_array((int)$id, array_map('intval', $admins), true);
}
function display_name(array $u): string {
    if (!empty($u['username'])) return '@' . $u['username'];
    if (!empty($u['first_name'])) return h($u['first_name']);
    return '<code>' . h($u['telegram_id'] ?? '') . '</code>';
}
function normalize_ref_code(string $code): string {
    $code = trim($code);
    $code = preg_replace('/[^A-Za-z0-9_]/', '', $code);
    return strtolower($code);
}
function random_ref(): string {
    do {
        $code = strtolower(substr(bin2hex(random_bytes(5)), 0, 8));
        $q = db()->prepare('SELECT id FROM users WHERE ref_code=?');
        $q->execute([$code]);
    } while ($q->fetch());
    return $code;
}
function get_user_by_tid($telegram_id) {
    $q = db()->prepare('SELECT * FROM users WHERE telegram_id=?');
    $q->execute([(int)$telegram_id]);
    return $q->fetch();
}
function get_user_by_id($id) {
    $q = db()->prepare('SELECT * FROM users WHERE id=?');
    $q->execute([(int)$id]);
    return $q->fetch();
}
function get_user_by_ref($code) {
    $code = normalize_ref_code((string)$code);
    if ($code === '') return false;
    $q = db()->prepare('SELECT * FROM users WHERE LOWER(ref_code)=?');
    $q->execute([$code]);
    return $q->fetch();
}
function create_or_update_user(array $from, ?string $ref = null) {
    $tid = (int)$from['id'];
    $user = get_user_by_tid($tid);
    if ($user) {
        db()->prepare('UPDATE users SET username=?, first_name=?, last_name=? WHERE telegram_id=?')
            ->execute([$from['username'] ?? null, $from['first_name'] ?? null, $from['last_name'] ?? null, $tid]);
        return get_user_by_tid($tid);
    }
    $referrerId = null;
    if ($ref) {
        $referrer = get_user_by_ref($ref);
        if ($referrer && (int)$referrer['telegram_id'] !== $tid) $referrerId = (int)$referrer['id'];
    }
    db()->prepare('INSERT INTO users (telegram_id, username, first_name, last_name, ref_code, referrer_id) VALUES (?,?,?,?,?,?)')
        ->execute([$tid, $from['username'] ?? null, $from['first_name'] ?? null, $from['last_name'] ?? null, random_ref(), $referrerId]);
    return get_user_by_tid($tid);
}
function set_step($telegram_id, ?string $step, ?string $payload = null): void {
    db()->prepare('UPDATE users SET step=?, step_payload=? WHERE telegram_id=?')->execute([$step, $payload, (int)$telegram_id]);
}
function clear_step($telegram_id): void { set_step($telegram_id, null, null); }
function add_balance($user_id, $amount, string $type, string $desc='', $related_user_id=null): void {
    $amount = (int)$amount;
    db()->prepare('UPDATE users SET balance=balance+?, total_earned=total_earned+GREATEST(?,0) WHERE id=?')->execute([$amount, $amount, $user_id]);
    db()->prepare('INSERT INTO transactions (user_id,type,amount,description,related_user_id) VALUES (?,?,?,?,?)')->execute([$user_id, $type, $amount, $desc, $related_user_id]);
}
function referral_link(array $user): string {
    $bot = app_config('BOT_USERNAME', '');
    return "https://t.me/{$bot}?start=ref_{$user['ref_code']}";
}
function vip_info(int $referrals): array {
    if ($referrals >= 100) return ['name'=>'Diamond', 'fa'=>'دایموند', 'emoji'=>'💎', 'next'=>null, 'multiplier'=>1.50];
    if ($referrals >= 50)  return ['name'=>'Gold', 'fa'=>'گلد', 'emoji'=>'🥇', 'next'=>100, 'multiplier'=>1.25];
    if ($referrals >= 10)  return ['name'=>'Silver', 'fa'=>'سیلور', 'emoji'=>'🥈', 'next'=>50, 'multiplier'=>1.10];
    return ['name'=>'Bronze', 'fa'=>'برنز', 'emoji'=>'🥉', 'next'=>10, 'multiplier'=>1.00];
}
function vip_line(array $user): string {
    $vip = vip_info((int)$user['referrals_count']);
    $line = "{$vip['emoji']} سطح: <b>{$vip['fa']}</b> | ضریب خرید: <b>×{$vip['multiplier']}</b>";
    if ($vip['next']) {
        $left = max(0, $vip['next'] - (int)$user['referrals_count']);
        $line .= "\nبرای سطح بعدی: <b>{$left}</b> دعوت دیگر";
    } else {
        $line .= "\nشما بالاترین سطح همکاری را دارید 🔥";
    }
    return $line;
}
function today_referrals(int $user_id): int {
    $today = date('Y-m-d');
    $q = db()->prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id=? AND DATE(created_at)=?');
    $q->execute([$user_id, $today]);
    return (int)($q->fetch()['c'] ?? 0);
}
function mission_rows(): array {
    return [
        ['target'=>setting_int('mission_1_target', 1), 'reward'=>setting_int('mission_1_reward', 3000)],
        ['target'=>setting_int('mission_2_target', 3), 'reward'=>setting_int('mission_2_reward', 10000)],
        ['target'=>setting_int('mission_3_target', 5), 'reward'=>setting_int('mission_3_reward', 25000)],
    ];
}
function is_mission_claimed(int $user_id, string $date, int $target): bool {
    $q = db()->prepare('SELECT id FROM mission_claims WHERE user_id=? AND mission_date=? AND target_count=?');
    $q->execute([$user_id, $date, $target]);
    return (bool)$q->fetch();
}
function claim_available_missions(array $user): array {
    $todayCount = today_referrals((int)$user['id']);
    $date = date('Y-m-d');
    $claimed = [];
    foreach (mission_rows() as $m) {
        $target = (int)$m['target']; $reward = (int)$m['reward'];
        if ($target <= 0 || $reward <= 0 || $todayCount < $target) continue;
        if (is_mission_claimed((int)$user['id'], $date, $target)) continue;
        db()->prepare('INSERT INTO mission_claims (user_id, mission_date, target_count, reward_amount) VALUES (?,?,?,?)')->execute([$user['id'], $date, $target, $reward]);
        add_balance($user['id'], $reward, 'mission_reward', "پاداش مأموریت روزانه {$target} دعوت", null);
        $claimed[] = $m;
    }
    return [$todayCount, $claimed];
}
function top_users(int $limit=10): array {
    $q = db()->prepare('SELECT * FROM users WHERE referrals_count>0 ORDER BY referrals_count DESC, total_earned DESC LIMIT ?');
    $q->bindValue(1, $limit, PDO::PARAM_INT);
    $q->execute();
    return $q->fetchAll();
}
function weighted_spin_reward(): array {
    $rewards = setting_json('spin_rewards', app_config('SPIN_REWARDS', []));
    if (!$rewards) return ['title'=>'💰 ۵,۰۰۰ تومان اعتبار کیف پول', 'amount'=>5000, 'weight'=>1];
    $sum = 0;
    foreach ($rewards as $r) $sum += max(1, (int)($r['weight'] ?? 1));
    $pick = random_int(1, max(1, $sum));
    $cursor = 0;
    foreach ($rewards as $r) {
        $cursor += max(1, (int)($r['weight'] ?? 1));
        if ($pick <= $cursor) return $r;
    }
    return $rewards[0];
}
function is_joined_channel(int $telegram_id): bool {
    $channel = app_config('FORCE_JOIN_CHANNEL', '');
    if (empty($channel)) return true;
    $res = tg('getChatMember', ['chat_id'=>$channel, 'user_id'=>$telegram_id]);
    if (empty($res['ok'])) return false;
    $status = $res['result']['status'] ?? 'left';
    return !in_array($status, ['left', 'kicked'], true);
}
function notify_admins(string $text): void {
    foreach (app_config('ADMIN_IDS', []) as $aid) send_msg($aid, $text);
}
function try_reward_referrer(array $user): void {
    if (empty($user['referrer_id']) || (int)$user['ref_rewarded'] === 1) return;
    if (!is_joined_channel((int)$user['telegram_id'])) return;
    $referrer = get_user_by_id((int)$user['referrer_id']);
    if (!$referrer) return;
    $startReward = setting_int('start_reward', 2000);
    db()->prepare('UPDATE users SET ref_rewarded=1 WHERE id=?')->execute([$user['id']]);
    db()->prepare('INSERT IGNORE INTO referrals (referrer_id, referred_id, reward_amount) VALUES (?,?,?)')->execute([$referrer['id'], $user['id'], $startReward]);
    db()->prepare('UPDATE users SET referrals_count = referrals_count + 1 WHERE id=?')->execute([$referrer['id']]);
    if ($startReward > 0) add_balance($referrer['id'], $startReward, 'ref_start', 'پاداش استارت زیرمجموعه جدید', $user['id']);
    $referrer = get_user_by_id((int)$referrer['id']);
    $spinEvery = max(1, setting_int('spin_referrals_per_chance', 5));
    $spinText = '';
    if (((int)$referrer['referrals_count'] % $spinEvery) === 0) {
        db()->prepare('UPDATE users SET spin_balance=spin_balance+1 WHERE id=?')->execute([$referrer['id']]);
        $spinText = "\n🎡 یک شانس گردونه هم گرفتی!";
    }
    send_msg($referrer['telegram_id'], '🎉 یک کاربر جدید با لینک دعوت شما وارد شد.' . ($startReward > 0 ? "\n💰 پاداش: <b>".money($startReward).'</b>' : '') . $spinText, main_menu_keyboard(is_admin($referrer['telegram_id'])));
}

function send_msg($chat_id, string $text, ?string $replyMarkup = null, array $extra = []): void {
    $data = array_merge([
        'chat_id' => $chat_id,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ], $extra);
    if ($replyMarkup !== null) $data['reply_markup'] = $replyMarkup;
    tg('sendMessage', $data);
}
function edit_msg($chat_id, $message_id, string $text, ?string $replyMarkup = null): void {
    $data = [
        'chat_id' => $chat_id,
        'message_id' => $message_id,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ];
    if ($replyMarkup !== null) $data['reply_markup'] = $replyMarkup;
    tg('editMessageText', $data);
}
function answer_cb($callback_id, string $text = ''): void {
    tg('answerCallbackQuery', ['callback_query_id'=>$callback_id, 'text'=>$text, 'show_alert'=>false]);
}
function json_markup(array $data): string { return json_encode($data, JSON_UNESCAPED_UNICODE); }
function keyboard_markup(array $rows, bool $resize=true, bool $oneTime=false): string {
    return json_markup(['keyboard'=>$rows, 'resize_keyboard'=>$resize, 'one_time_keyboard'=>$oneTime, 'is_persistent'=>true]);
}

function mini_app_inline_keyboard(bool $admin=false): ?string {
    $mini = app_config('MINIAPP_URL', '');
    if (!$mini) return null;
    $url = $admin ? ($mini . (str_contains($mini, '?') ? '&' : '?') . 'admin=1') : $mini;
    $text = $admin ? '🧑‍💼 باز کردن Mini Panel' : '🚀 باز کردن Mini App';
    return json_markup(['inline_keyboard'=>[[['text'=>$text, 'web_app'=>['url'=>$url]]]]]);
}
function contact_request_keyboard(): string {
    return json_markup(['keyboard'=>[[['text'=>'📱 ارسال شماره موبایل', 'request_contact'=>true]]], 'resize_keyboard'=>true, 'one_time_keyboard'=>true, 'is_persistent'=>true]);
}
function is_contact_auth_required(): bool { return setting_bool('auth_contact_required', false); }
function needs_contact_auth(array $user): bool {
    if (!is_contact_auth_required()) return false;
    if (is_admin((int)$user['telegram_id'])) return false;
    return empty($user['phone_number']);
}
function save_user_contact(int $telegramId, array $contact): bool {
    $contactUserId = (int)($contact['user_id'] ?? 0);
    if ($contactUserId !== $telegramId) return false;
    $phone = preg_replace('/[^0-9+]/', '', (string)($contact['phone_number'] ?? ''));
    if ($phone === '') return false;
    db()->prepare('UPDATE users SET phone_number=?, contact_first_name=?, contact_last_name=?, contact_shared_at=NOW() WHERE telegram_id=?')
        ->execute([$phone, $contact['first_name'] ?? null, $contact['last_name'] ?? null, $telegramId]);
    return true;
}
function user_full_admin_card(array $user, string $title='👤 کاربر'): string {
    $ref = !empty($user['referrer_id']) ? get_user_by_id((int)$user['referrer_id']) : null;
    $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) ?: '—';
    $username = !empty($user['username']) ? '@'.$user['username'] : '—';
    $phone = !empty($user['phone_number']) ? $user['phone_number'] : 'ثبت نشده';
    $referrer = $ref ? display_name($ref).' | <code>'.$ref['telegram_id'].'</code>' : 'ندارد';
    return $title."\n".
        "نام: <b>".h($name)."</b>\n".
        "یوزرنیم: <b>".h($username)."</b>\n".
        "آیدی عددی: <code>{$user['telegram_id']}</code>\n".
        "شماره: <code>".h($phone)."</code>\n".
        "کد دعوت: <code>".h($user['ref_code'])."</code>\n".
        "معرف: {$referrer}\n".
        "زیرمجموعه‌ها: <b>{$user['referrals_count']}</b>\n".
        "موجودی: <b>".money($user['balance'])."</b>\n".
        "زمان عضویت: <code>".h($user['created_at'] ?? '')."</code>";
}
function notify_admin_user_start(array $user, string $payload=''): void {
    if (!setting_bool('notify_admin_on_start', true)) return;
    $extra = $payload !== '' ? "\nپیام start: <code>".h($payload)."</code>" : '';
    notify_admins(user_full_admin_card($user, '🚀 استارت جدید ربات') . $extra);
}
function send_welcome(int $chat_id, array $user): void {
    send_msg($chat_id, main_text($user), mini_app_inline_keyboard(is_admin($chat_id)));
    send_msg($chat_id, 'منوی سریع پایین صفحه فعاله؛ هر کاری خواستی از دکمه‌ها انتخاب کن 👇', main_menu_keyboard(is_admin($chat_id)));
}

function main_menu_keyboard(bool $admin=false): string {
    $mini = app_config('MINIAPP_URL', '');
    $rows = [
        [['text'=>'🏠 صفحه اول'], ['text'=>'🛒 فروشگاه']],
        [['text'=>'🧾 سفارش‌های من'], ['text'=>'👤 پروفایل و کیف پول']],
        [['text'=>'👥 دعوت و درآمد'], ['text'=>'🏆 لیدربورد']],
        [['text'=>'🎯 مأموریت‌ها'], ['text'=>'🎡 گردونه شانس']],
        [['text'=>'🏧 برداشت'], ['text'=>'📞 پشتیبانی']],
    ];
    if ($admin) $rows[] = [['text'=>'⚙️ پنل ادمین']];
    return keyboard_markup($rows);
}
function back_main_keyboard(): string { return json_markup(['inline_keyboard'=>[[['text'=>'🔙 بازگشت به منوی اصلی', 'callback_data'=>'main']]]]); }

function shop_back_keyboard(): string {
    return json_markup(['inline_keyboard'=>[[['text'=>'🛒 فروشگاه', 'callback_data'=>'u_shop'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']]]]);
}
function order_user_keyboard(array $order): string {
    $status = normalize_order_status($order['status'] ?? '');
    $rows = [];
    if ($status === 'pending_payment') {
        $rows[] = [['text'=>'📤 ارسال رسید پرداخت', 'callback_data'=>'order_receipt_'.$order['id']]];
        $rows[] = [['text'=>'🎟 ثبت کد تخفیف', 'callback_data'=>'order_coupon_'.$order['id']], ['text'=>'❌ لغو سفارش', 'callback_data'=>'order_cancel_'.$order['id']]];
    } elseif ($status === 'rejected') {
        $rows[] = [['text'=>'📤 ارسال مجدد رسید', 'callback_data'=>'order_receipt_'.$order['id']]];
    }
    $rows[] = [['text'=>'🧾 تایم‌لاین سفارش', 'callback_data'=>'order_timeline_'.$order['id']]];
    $rows[] = [['text'=>'🧾 سفارش‌های من', 'callback_data'=>'u_orders'], ['text'=>'🛒 فروشگاه', 'callback_data'=>'u_shop']];
    $rows[] = [['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    return json_markup(['inline_keyboard'=>$rows]);
}
function admin_shop_keyboard(): string {
    $mini = app_config('MINIAPP_URL', '');
    $rows = [
        [['text'=>'➕ محصول مرحله‌ای', 'callback_data'=>'adm_add_product'], ['text'=>'📦 مدیریت محصولات', 'callback_data'=>'adm_products']],
        [['text'=>'➕ دسته مرحله‌ای', 'callback_data'=>'adm_add_category'], ['text'=>'📂 مدیریت دسته‌بندی‌ها', 'callback_data'=>'adm_categories']],
        [['text'=>'➕ پلن مرحله‌ای', 'callback_data'=>'adm_add_variant_manual'], ['text'=>'🧩 مدیریت پلن‌ها', 'callback_data'=>'adm_variants']],
        [['text'=>'➕ انبار مرحله‌ای', 'callback_data'=>'adm_add_inventory'], ['text'=>'📥 مدیریت انبار دستی', 'callback_data'=>'adm_inventory']],
        [['text'=>'🧾 سفارش‌ها', 'callback_data'=>'adm_orders'], ['text'=>'🔎 جستجوی سفارش', 'callback_data'=>'adm_order_search']],
        [['text'=>'🎟 کدهای تخفیف', 'callback_data'=>'adm_coupons'], ['text'=>'📊 گزارش فروش', 'callback_data'=>'adm_sales_report']],
        [['text'=>'💳 متن پرداخت', 'callback_data'=>'adm_payment']],
    ];
    $rows[] = [['text'=>'🔙 پنل ادمین', 'callback_data'=>'adm_home']];
    return json_markup(['inline_keyboard'=>$rows]);
}
function admin_order_keyboard(int $orderId): string {
    return json_markup(['inline_keyboard'=>[
        [['text'=>'👀 شروع بررسی', 'callback_data'=>'ord_review_'.$orderId], ['text'=>'✅ تایید پرداخت', 'callback_data'=>'ord_paid_'.$orderId]],
        [['text'=>'📦 آماده‌سازی', 'callback_data'=>'ord_prepare_'.$orderId], ['text'=>'⚡️ تحویل از انبار', 'callback_data'=>'ord_auto_deliver_'.$orderId]],
        [['text'=>'📩 تحویل دستی', 'callback_data'=>'ord_deliver_'.$orderId], ['text'=>'📝 یادداشت داخلی', 'callback_data'=>'ord_note_'.$orderId]],
        [['text'=>'🧾 تایم‌لاین', 'callback_data'=>'ord_timeline_'.$orderId], ['text'=>'❌ رد سفارش', 'callback_data'=>'ord_reject_'.$orderId]],
        [['text'=>'🧾 سفارش‌ها', 'callback_data'=>'adm_orders'], ['text'=>'🛒 فروشگاه ادمین', 'callback_data'=>'adm_shop']],
    ]]);
}
function show_shop_home(int $chat_id, $message_id=null): void {
    $cats = shop_categories(true);
    $rows = [];
    foreach ($cats as $c) $rows[] = [['text'=>trim(($c['emoji'] ?: '🛒').' '.$c['title']), 'callback_data'=>'shop_cat_'.$c['id']]];
    $rows[] = [['text'=>'⭐ محصولات ویژه', 'callback_data'=>'shop_featured'], ['text'=>'📦 همه محصولات', 'callback_data'=>'shop_cat_0']];
    $rows[] = [['text'=>'🧾 سفارش‌های من', 'callback_data'=>'u_orders'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    $txt = "🛒 <b>فروشگاه</b>\n\nمحصول را انتخاب کن؛ اگر محصول پلن داشته باشد، قبل از سفارش پلن را انتخاب می‌کنی. وضعیت سفارش هم مرحله‌به‌مرحله نمایش داده می‌شود.";
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$rows]));
}
function show_shop_category(int $chat_id, $message_id, int $categoryId=0, bool $featured=false): void {
    $products = shop_products($categoryId ?: null, true);
    if ($featured) $products = array_values(array_filter($products, fn($p)=>(int)($p['is_featured'] ?? 0) === 1));
    $rows = [];
    foreach ($products as $p) {
        $label = '📦 '.$p['name'].' — '.product_price_label($p);
        if ((int)($p['variant_count'] ?? 0) > 0) $label .= ' | '.(int)$p['variant_count'].' پلن';
        $rows[] = [['text'=>$label, 'callback_data'=>'shop_prod_'.$p['id']]];
    }
    if (!$rows) $rows[] = [['text'=>'فعلاً محصولی نیست', 'callback_data'=>'u_shop']];
    $rows[] = [['text'=>'🔙 دسته‌بندی‌ها', 'callback_data'=>'u_shop'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    $title = $featured ? 'محصولات ویژه' : ($categoryId ? 'محصولات این دسته' : 'همه محصولات');
    send_or_edit($chat_id, $message_id, "🛒 <b>{$title}</b>\n\nبرای دیدن جزئیات روی محصول بزن.", json_markup(['inline_keyboard'=>$rows]));
}
function show_shop_product(int $chat_id, $message_id, int $productId): void {
    $p = shop_product($productId);
    if (!$p || (int)$p['is_active'] !== 1) { send_or_edit($chat_id, $message_id, 'محصول پیدا نشد یا غیرفعال است.', shop_back_keyboard()); return; }
    $variants = product_variants($productId, true);
    $priceLine = count($variants) ? product_price_label($p) : money((int)$p['price']);
    $txt = "📦 <b>".h($p['name'])."</b>\n\n".
        "قیمت: <b>{$priceLine}</b>\n".
        "دسته: ".h(trim(($p['category_emoji'] ?? '').' '.($p['category_title'] ?? 'عمومی')))."\n".
        "نوع تحویل: <b>".delivery_type_fa($p['delivery_type'])."</b>\n".
        "موجودی آماده: <b>".inventory_count((int)$p['id'])."</b>\n".
        "پورسانت معرف: <b>".product_commission_text($p)."</b>\n\n".
        h($p['full_description'] ?: $p['short_description'] ?: '');
    $rows = [];
    if ($variants) {
        foreach ($variants as $v) $rows[] = [['text'=>'🧩 '.$v['title'].' — '.money($v['price']), 'callback_data'=>'shop_buyv_'.$p['id'].'_'.$v['id']]];
    } else {
        $rows[] = [['text'=>'🛒 ثبت سفارش', 'callback_data'=>'shop_buy_'.$p['id']]];
    }
    $rows[] = [['text'=>'🔙 محصولات', 'callback_data'=>'shop_cat_'.(int)($p['category_id'] ?? 0)], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$rows]));
}
function show_user_orders(int $chat_id, $message_id, int $userId): void {
    $orders = user_orders($userId, 15);
    $rows = [];
    $txt = "🧾 <b>سفارش‌های من</b>\n\n";
    if (!$orders) $txt .= "هنوز سفارشی ثبت نکردی.";
    foreach ($orders as $o) {
        $name = $o['product_name'].(!empty($o['variant_title']) ? ' - '.$o['variant_title'] : '');
        $txt .= "#{$o['id']} | ".h($name)." | <b>".money($o['final_amount'])."</b> | ".order_status_emoji($o['status']).' '.order_status_fa($o['status'])."\n";
        $rows[] = [['text'=>'مشاهده سفارش #'.$o['id'], 'callback_data'=>'order_view_'.$o['id']], ['text'=>'تایم‌لاین #'.$o['id'], 'callback_data'=>'order_timeline_'.$o['id']]];
    }
    $rows[] = [['text'=>'🛒 فروشگاه', 'callback_data'=>'u_shop'], ['text'=>'🔙 منوی اصلی', 'callback_data'=>'main']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$rows]));
}
function show_order_invoice(int $chat_id, $message_id, array $order): void {
    $name = $order['product_name'].(!empty($order['variant_title']) ? ' - '.$order['variant_title'] : '');
    $txt = "🧾 <b>فاکتور سفارش #{$order['id']}</b>\n\n".
        "محصول: <b>".h($name)."</b>\n".
        "مبلغ: <b>".money($order['amount'])."</b>\n";
    if ((int)$order['discount_amount'] > 0) $txt .= "تخفیف: <b>".money($order['discount_amount'])."</b>\n";
    $txt .= "مبلغ نهایی: <b>".money($order['final_amount'])."</b>\n".
        "وضعیت: <b>".order_status_emoji($order['status']).' '.order_status_fa($order['status'])."</b>\n".
        "نوع تحویل: <b>".delivery_type_fa($order['delivery_type'])."</b>\n";
    if (!empty($order['expires_at'])) $txt .= "انقضا/مدت: <code>".h($order['expires_at'])."</code>\n";
    if (!empty($order['delivery_text']) && normalize_order_status($order['status']) === 'delivered') $txt .= "\nاطلاعات تحویل:\n<code>".h($order['delivery_text'])."</code>\n";
    $timeline = order_timeline_text((int)$order['id'], true);
    if ($timeline) $txt .= "\n🧾 <b>تایم‌لاین</b>\n{$timeline}\n";
    if (in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) $txt .= "\n💳 <b>راهنمای پرداخت</b>\n".h(setting('payment_instructions', 'لطفاً پرداخت را انجام دهید و رسید را ارسال کنید.'));
    send_or_edit($chat_id, $message_id, $txt, order_user_keyboard($order));
}
function order_admin_card(array $order): string {
    $name = $order['product_name'].(!empty($order['variant_title']) ? ' - '.$order['variant_title'] : '');
    $cust = customer_stats((int)$order['user_id']);
    return "🧾 <b>سفارش #{$order['id']}</b>\n".
        "کاربر: @".h($order['username'] ?: 'بدون یوزرنیم')." | <code>{$order['telegram_id']}</code>\n".
        "سطح مشتری: {$cust['tier']['emoji']} {$cust['tier']['fa']} | خرید موفق: <b>{$cust['orders_count']}</b> | ".money($cust['total_spent'])."\n".
        "محصول: <b>".h($name)."</b>\n".
        "مبلغ نهایی: <b>".money($order['final_amount'])."</b>\n".
        "وضعیت: <b>".order_status_emoji($order['status']).' '.order_status_fa($order['status'])."</b>\n".
        "نوع تحویل: <b>".delivery_type_fa($order['delivery_type'])."</b>";
}
function show_admin_shop_home(int $chat_id, $message_id=null): void {
    $p = db()->query('SELECT COUNT(*) c FROM products')->fetch();
    $active = db()->query('SELECT COUNT(*) c FROM products WHERE is_active=1')->fetch();
    $pending = db()->query('SELECT COUNT(*) c FROM orders WHERE status IN ("pending_payment","receipt_submitted","reviewing")')->fetch();
    $ready = db()->query('SELECT COUNT(*) c FROM orders WHERE status IN ("payment_confirmed","preparing")')->fetch();
    $inv = db()->query('SELECT COUNT(*) c FROM inventory_items WHERE status="available"')->fetch();
    $txt = "🛒 <b>مدیریت فروشگاه</b>\n\n".
        "محصولات: <b>{$p['c']}</b> | فعال: <b>{$active['c']}</b>\n".
        "سفارش‌های در انتظار بررسی: <b>{$pending['c']}</b>\n".
        "آماده تحویل: <b>{$ready['c']}</b>\n".
        "موجودی آماده انبار: <b>{$inv['c']}</b>";
    send_or_edit($chat_id, $message_id, $txt, admin_shop_keyboard());
}
function show_admin_products(int $chat_id, $message_id=null): void {
    $rows = shop_products(null, false);
    if (!$rows) { send_or_edit($chat_id, $message_id, 'هنوز محصولی ثبت نشده.', admin_shop_keyboard()); return; }
    $txt = "📦 <b>مدیریت محصولات</b>\nهر محصول را جدا مدیریت کن؛ می‌توانی غیرفعال، ویرایش یا حذف کامل کنی.\n\n";
    $kb=[];
    foreach ($rows as $p) {
        $status = (int)$p['is_active'] ? '✅' : '⛔️';
        $txt .= "{$status} <code>#{$p['id']}</code> <b>".h($p['name'])."</b> | ".product_price_label($p)."\n";
        $kb[] = [['text'=>$status.' #'.$p['id'].' '.$p['name'], 'callback_data'=>'prod_manage_'.$p['id']]];
    }
    $kb[] = [['text'=>'➕ افزودن محصول مرحله‌ای', 'callback_data'=>'adm_add_product']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_admin_categories(int $chat_id, $message_id=null): void {
    $rows = shop_categories(false);
    $txt = "📂 <b>مدیریت دسته‌بندی‌ها</b>\n\n";
    $kb=[];
    foreach ($rows as $c) {
        $status=(int)$c['is_active']?'✅':'⛔️';
        $txt .= "{$status} <code>#{$c['id']}</code> ".h(($c['emoji']?:'🛒').' '.$c['title'])."\n";
        $kb[] = [['text'=>$status.' #'.$c['id'].' '.trim(($c['emoji']?:'🛒').' '.$c['title']), 'callback_data'=>'cat_manage_'.$c['id']]];
    }
    if (!$rows) $txt .= 'دسته‌ای نداریم.';
    $kb[] = [['text'=>'➕ افزودن دسته مرحله‌ای', 'callback_data'=>'adm_add_category']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_admin_coupons(int $chat_id, $message_id=null): void {
    $rows = db()->query('SELECT * FROM coupons ORDER BY id DESC LIMIT 30')->fetchAll();
    $txt = "🎟 <b>کدهای تخفیف</b>\n\n";
    if (!$rows) $txt .= "هنوز کدی ثبت نشده.";
    foreach ($rows as $c) {
        $value = $c['type'] === 'percent' ? ((int)$c['value']).'٪' : money((int)$c['value']);
        $txt .= "<code>".h($c['code'])."</code> | {$value} | استفاده: {$c['used_count']}/".((int)$c['max_uses'] ?: '∞')." | ".((int)$c['is_active']?'فعال':'غیرفعال')."\n";
    }
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>[
        [['text'=>'➕ افزودن کد تخفیف', 'callback_data'=>'adm_add_coupon']],
        [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']],
    ]]));
}
function show_admin_order_filters(int $chat_id, $message_id=null): void {
    $txt = "🧾 <b>مدیریت سفارش‌ها</b>\n\nکدام سفارش‌ها را می‌خواهی ببینی؟";
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>[
        [['text'=>'⏳ در انتظار پرداخت', 'callback_data'=>'adm_orders_pending_payment'], ['text'=>'📤 رسید ارسال شده', 'callback_data'=>'adm_orders_receipt_submitted']],
        [['text'=>'👀 در حال بررسی', 'callback_data'=>'adm_orders_reviewing'], ['text'=>'✅ تایید پرداخت', 'callback_data'=>'adm_orders_payment_confirmed']],
        [['text'=>'📦 آماده‌سازی', 'callback_data'=>'adm_orders_preparing'], ['text'=>'📩 تحویل‌شده', 'callback_data'=>'adm_orders_delivered']],
        [['text'=>'❌ رد/لغو شده', 'callback_data'=>'adm_orders_rejected'], ['text'=>'📋 همه', 'callback_data'=>'adm_orders_all']],
        [['text'=>'🔎 جستجوی سفارش', 'callback_data'=>'adm_order_search'], ['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']],
    ]]));
}
function show_admin_order(int $chat_id, $message_id, int $orderId): void {
    $order = order_by_id($orderId);
    if (!$order) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', admin_shop_keyboard()); return; }
    $txt = order_admin_card($order);
    if (!empty($order['payment_note'])) $txt .= "\n\nرسید/توضیح پرداخت:\n".h($order['payment_note']);
    if (!empty($order['receipt_file_id'])) $txt .= "\n\n🖼 رسید عکس دارد و قبلاً برای ادمین ارسال شده است.";
    if (!empty($order['admin_note'])) $txt .= "\n\n📝 یادداشت داخلی:\n".h($order['admin_note']);
    if (!empty($order['delivery_text'])) $txt .= "\n\nاطلاعات تحویل:\n<code>".h($order['delivery_text'])."</code>";
    $timeline = order_timeline_text($orderId, false);
    if ($timeline) $txt .= "\n\n🧾 <b>تایم‌لاین</b>\n{$timeline}";
    send_or_edit($chat_id, $message_id, $txt, admin_order_keyboard($orderId));
}
function show_admin_orders(int $chat_id, $message_id, string $filter='all'): void {
    $map = [
        'pending_payment'=>'pending_payment','pending_review'=>'receipt_submitted','receipt_submitted'=>'receipt_submitted','reviewing'=>'reviewing',
        'paid'=>'payment_confirmed','payment_confirmed'=>'payment_confirmed','preparing'=>'preparing','delivered'=>'delivered',
        'rejected'=>['rejected','canceled','refunded'],'canceled'=>'canceled'
    ];
    $status = $filter === 'all' ? null : ($map[$filter] ?? $filter);
    $orders = admin_orders($status, 25);
    $title = is_array($status) ? 'رد/لغو شده' : ($status ? order_status_fa($status) : 'همه سفارش‌ها');
    $txt = "🧾 <b>{$title}</b>\n\n";
    $rows = [];
    if (!$orders) $txt .= "سفارشی پیدا نشد.";
    foreach ($orders as $o) {
        $name = $o['product_name'].(!empty($o['variant_title']) ? ' - '.$o['variant_title'] : '');
        $txt .= "#{$o['id']} | @".h($o['username'] ?: '---')." | <b>".h($name)."</b> | ".money($o['final_amount'])." | ".order_status_emoji($o['status']).' '.order_status_fa($o['status'])."\n";
        $rows[] = [['text'=>'مدیریت #'.$o['id'], 'callback_data'=>'ord_view_'.$o['id']], ['text'=>'تحویل #'.$o['id'], 'callback_data'=>'ord_deliver_'.$o['id']]];
    }
    $rows[] = [['text'=>'🔙 فیلتر سفارش‌ها', 'callback_data'=>'adm_orders'], ['text'=>'🛒 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$rows]));
}
function show_admin_inventory(int $chat_id, $message_id=null): void {
    $rows = inventory_items_for_admin(60);
    $txt = "📥 <b>مدیریت انبار دستی</b>\n\n";
    $kb=[];
    foreach ($rows as $i) {
        $content = mb_substr((string)$i['content'],0,28);
        $txt .= "<code>#{$i['id']}</code> ".h($i['product_name']).(!empty($i['variant_title'])?' / '.h($i['variant_title']):'')." | <b>".h($i['status'])."</b> | ".h($content)."\n";
        $kb[] = [['text'=>'#'.$i['id'].' '.mb_substr($i['product_name'],0,18).' | '.$i['status'], 'callback_data'=>'inv_manage_'.$i['id']]];
    }
    if (!$rows) $txt .= 'انبار خالی است.';
    $kb[] = [['text'=>'➕ افزودن انبار مرحله‌ای', 'callback_data'=>'adm_add_inventory']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_admin_variants(int $chat_id, $message_id=null): void {
    $rows = db()->query('SELECT v.*, p.name product_name FROM product_variants v JOIN products p ON p.id=v.product_id ORDER BY v.id DESC LIMIT 80')->fetchAll();
    $txt = "🧩 <b>مدیریت پلن‌ها</b>\n\n";
    $kb=[];
    foreach ($rows as $v) {
        $status=(int)$v['is_active']?'✅':'⛔️';
        $txt .= "{$status} <code>#{$v['id']}</code> ".h($v['product_name'])." | ".h($v['title'])." | ".money($v['price'])."\n";
        $kb[] = [['text'=>$status.' #'.$v['id'].' '.$v['product_name'].' / '.$v['title'], 'callback_data'=>'variant_manage_'.$v['id']]];
    }
    if (!$rows) $txt .= 'پلنی نداریم.';
    $kb[] = [['text'=>'➕ افزودن پلن مرحله‌ای', 'callback_data'=>'adm_add_variant_manual']];
    $kb[] = [['text'=>'🔙 فروشگاه ادمین', 'callback_data'=>'adm_shop']];
    send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>$kb]));
}
function show_sales_report(int $chat_id, $message_id=null): void {
    $r=sales_report();
    $txt="📊 <b>گزارش فروش</b>\n\n".
        "امروز: <b>{$r['today']['c']}</b> سفارش | ".money($r['today']['s'])."\n".
        "این ماه: <b>{$r['month']['c']}</b> سفارش | ".money($r['month']['s'])."\n".
        "سفارش‌های نیازمند اقدام: <b>{$r['pending']}</b>\n\n".
        "🏆 <b>محصولات پرفروش</b>\n";
    foreach ($r['top'] as $t) $txt .= "• ".h($t['name'])." — {$t['c']} سفارش | ".money($t['s'])."\n";
    if (!$r['top']) $txt .= "هنوز فروش تحویل‌شده‌ای ثبت نشده.";
    send_or_edit($chat_id, $message_id, $txt, admin_shop_keyboard());
}
function admin_keyboard(): string {
    $mini = app_config('MINIAPP_URL', '');
    $rows = [
        [['text'=>'🛒 مدیریت فروشگاه'], ['text'=>'📈 آمار کل']],
        [['text'=>'🏧 برداشت‌ها'], ['text'=>'💸 تغییر موجودی']],
        [['text'=>'🎁 پاداش خرید'], ['text'=>'⚙️ تنظیمات پاداش‌ها']],
        [['text'=>'🎨 تنظیم رنگ‌ها'], ['text'=>'📢 پیام همگانی']],
        [['text'=>'🏆 لیدربورد ادمین'], ['text'=>'🏠 صفحه اول']],
    ];
    return keyboard_markup($rows);
}
function force_join_keyboard(): string {
    $channel = ltrim((string)app_config('FORCE_JOIN_CHANNEL', ''), '@');
    return json_markup(['inline_keyboard'=>[
        [['text'=>'عضویت در کانال', 'url'=>"https://t.me/{$channel}"]],
        [['text'=>'✅ عضو شدم', 'callback_data'=>'check_join']],
    ]]);
}
function main_text(array $user): string {
    $brand = h(setting('brand_name', app_config('BRAND_NAME', 'BlueGate')));
    return "💙 <b>{$brand} Referral Wallet</b>\n\nاز دکمه‌های پایین تلگرام برای کارهای سریع استفاده کن؛ Mini App هم از دکمه زیر همین پیام باز می‌شود. فروشگاه، سفارش‌ها، کیف پول، دعوت دوستان و برداشت همه آماده است.\n\n" . vip_line($user);
}
function validate_theme_color(string $color): ?string {
    $color = trim($color);
    if (preg_match('/^#[0-9a-fA-F]{6}$/', $color)) return strtolower($color);
    $map = ['blue'=>'#1d9bf0','purple'=>'#8b5cf6','green'=>'#22c55e','red'=>'#ef4444','orange'=>'#f97316','pink'=>'#ec4899','cyan'=>'#06b6d4'];
    return $map[strtolower($color)] ?? null;
}



function seed_shop_categories(): void {
    if (!table_exists('product_categories')) return;
    $count = (int)db()->query('SELECT COUNT(*) c FROM product_categories')->fetch()['c'];
    if ($count > 0) return;
    $rows = [
        ['🤖', 'هوش مصنوعی'], ['🎵', 'موزیک'], ['🎬', 'یوتیوب و استریم'],
        ['🎨', 'طراحی'], ['🎮', 'گیم'], ['🔐', 'VPN'], ['⭐', 'تلگرام']
    ];
    $q = db()->prepare('INSERT INTO product_categories (emoji,title,sort_order) VALUES (?,?,?)');
    foreach ($rows as $i => $r) $q->execute([$r[0], $r[1], $i + 1]);
}

function delivery_type_fa(string $type): string {
    return [
        'manual'=>'تحویل دستی', 'account'=>'اکانت / ایمیل و پسورد', 'vpn'=>'لینک ساب VPN',
        'code'=>'کد / گیفت / لایسنس', 'file'=>'فایل یا متن آماده'
    ][$type] ?? 'تحویل دستی';
}
function normalize_delivery_type(string $type): string {
    $t = strtolower(trim($type));
    $map = ['manual'=>'manual','دستی'=>'manual','account'=>'account','اکانت'=>'account','email'=>'account','vpn'=>'vpn','وپن'=>'vpn','sub'=>'vpn','code'=>'code','کد'=>'code','gift'=>'code','file'=>'file','فایل'=>'file'];
    return $map[$t] ?? 'manual';
}
function normalize_order_status(string $status): string {
    $map = [
        'pending_review'=>'receipt_submitted', 'paid'=>'payment_confirmed',
        'pending'=>'pending_payment', 'review'=>'reviewing'
    ];
    return $map[$status] ?? $status;
}
function order_status_fa(string $status): string {
    $status = normalize_order_status($status);
    return [
        'pending_payment'=>'در انتظار پرداخت',
        'receipt_submitted'=>'رسید ارسال شده',
        'reviewing'=>'در حال بررسی',
        'payment_confirmed'=>'پرداخت تایید شد',
        'preparing'=>'در حال آماده‌سازی',
        'delivered'=>'تحویل داده شده',
        'rejected'=>'رد شده',
        'canceled'=>'لغو شده',
        'refunded'=>'مرجوع / برگشت‌خورده'
    ][$status] ?? $status;
}
function order_status_emoji(string $status): string {
    $status = normalize_order_status($status);
    return [
        'pending_payment'=>'🕓','receipt_submitted'=>'📤','reviewing'=>'👀','payment_confirmed'=>'✅','preparing'=>'📦',
        'delivered'=>'📩','rejected'=>'❌','canceled'=>'🚫','refunded'=>'↩️'
    ][$status] ?? '•';
}
function normalize_coupon_code(string $code): string { return strtoupper(preg_replace('/[^A-Za-z0-9_\-]/', '', trim($code))); }

function shop_categories(bool $activeOnly=true): array {
    $sql = 'SELECT * FROM product_categories'.($activeOnly?' WHERE is_active=1':'').' ORDER BY sort_order ASC, id ASC';
    return db()->query($sql)->fetchAll();
}
function shop_products(?int $categoryId=null, bool $activeOnly=true): array {
    $where=[]; $params=[];
    if ($activeOnly) $where[]='p.is_active=1';
    if ($categoryId) { $where[]='p.category_id=?'; $params[]=$categoryId; }
    $sql='SELECT p.*, c.title category_title, c.emoji category_emoji,
        (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) variant_count,
        (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) min_variant_price,
        (SELECT COUNT(*) FROM inventory_items i WHERE i.product_id=p.id AND i.status="available") inventory_available
        FROM products p LEFT JOIN product_categories c ON c.id=p.category_id';
    if ($where) $sql .= ' WHERE '.implode(' AND ', $where);
    $sql .= ' ORDER BY p.is_featured DESC, p.id DESC LIMIT 100';
    $q=db()->prepare($sql); $q->execute($params); return $q->fetchAll();
}
function shop_product(int $id) {
    $q=db()->prepare('SELECT p.*, c.title category_title, c.emoji category_emoji,
        (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) variant_count,
        (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id=p.id AND v.is_active=1) min_variant_price,
        (SELECT COUNT(*) FROM inventory_items i WHERE i.product_id=p.id AND i.status="available") inventory_available
        FROM products p LEFT JOIN product_categories c ON c.id=p.category_id WHERE p.id=?');
    $q->execute([$id]); return $q->fetch();
}
function product_variants(int $productId, bool $activeOnly=true): array {
    $sql='SELECT * FROM product_variants WHERE product_id=?'.($activeOnly?' AND is_active=1':'').' ORDER BY sort_order ASC, id ASC';
    $q=db()->prepare($sql); $q->execute([$productId]); return $q->fetchAll();
}
function product_variant(int $variantId) {
    $q=db()->prepare('SELECT v.*, p.name product_name, p.delivery_type, p.commission_type, p.commission_value FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=?');
    $q->execute([$variantId]); return $q->fetch();
}
function find_or_create_category(string $title, string $emoji='🛒'): int {
    $title=trim($title); if ($title==='') $title='عمومی';
    if (ctype_digit($title)) return (int)$title;
    $q=db()->prepare('SELECT id FROM product_categories WHERE title=? LIMIT 1'); $q->execute([$title]); $row=$q->fetch();
    if ($row) return (int)$row['id'];
    db()->prepare('INSERT INTO product_categories (title,emoji,sort_order) VALUES (?,?,99)')->execute([$title,$emoji]);
    return (int)db()->lastInsertId();
}
function product_price_label(array $p): string {
    $vc=(int)($p['variant_count'] ?? 0);
    if ($vc > 0) return 'از '.money((int)($p['min_variant_price'] ?: $p['price']));
    return money((int)$p['price']);
}
function product_commission_text(array $p): string {
    if (($p['commission_type'] ?? 'none') === 'percent') return ((int)$p['commission_value']).'٪';
    if (($p['commission_type'] ?? 'none') === 'fixed') return money((int)$p['commission_value']);
    return 'بدون پورسانت';
}
function add_order_event(int $orderId, string $status, string $title, string $note='', bool $public=true): void {
    try {
        db()->prepare('INSERT INTO order_events (order_id,status,title,note,is_public) VALUES (?,?,?,?,?)')->execute([$orderId, normalize_order_status($status), $title, $note, $public ? 1 : 0]);
    } catch (Throwable $e) {}
}
function order_timeline(int $orderId, bool $publicOnly=true): array {
    $sql='SELECT * FROM order_events WHERE order_id=?'.($publicOnly?' AND is_public=1':'').' ORDER BY id ASC';
    $q=db()->prepare($sql); $q->execute([$orderId]); return $q->fetchAll();
}
function order_timeline_text(int $orderId, bool $publicOnly=true): string {
    $events = order_timeline($orderId, $publicOnly);
    if (!$events) return '';
    $out = '';
    foreach ($events as $e) {
        $out .= order_status_emoji($e['status']).' '.h($e['title']).' — <code>'.h(date('Y-m-d H:i', strtotime($e['created_at'])))."</code>\n";
        if (!$publicOnly && !empty($e['note'])) $out .= '   '.h($e['note'])."\n";
    }
    return trim($out);
}
function create_shop_order(int $userId, int $productId, ?int $variantId=null): array {
    $p = shop_product($productId);
    if (!$p || (int)$p['is_active'] !== 1) throw new RuntimeException('PRODUCT_NOT_FOUND');
    $variant = null;
    if ($variantId) {
        $variant = product_variant($variantId);
        if (!$variant || (int)$variant['product_id'] !== $productId || (int)$variant['is_active'] !== 1) throw new RuntimeException('VARIANT_NOT_FOUND');
    } else {
        $variants = product_variants($productId, true);
        if (count($variants) > 0) throw new RuntimeException('VARIANT_REQUIRED');
    }
    $amount = $variant ? (int)$variant['price'] : (int)$p['price'];
    $duration = $variant ? (int)$variant['duration_days'] : (int)($p['duration_days'] ?? 0);
    $expiresAt = $duration > 0 ? date('Y-m-d H:i:s', time() + $duration * 86400) : null;
    db()->prepare('INSERT INTO orders (user_id, product_id, variant_id, amount, final_amount, status, expires_at) VALUES (?,?,?,?,?,?,?)')->execute([$userId,$productId,$variantId,$amount,$amount,'pending_payment',$expiresAt]);
    $orderId = (int)db()->lastInsertId();
    add_order_event($orderId, 'pending_payment', 'سفارش ثبت شد', 'در انتظار پرداخت مشتری');
    return order_by_id($orderId);
}
function order_by_id(int $id) {
    $q=db()->prepare('SELECT o.*, p.name product_name, p.delivery_type, p.commission_type, p.commission_value, p.short_description, p.full_description, p.image_url, p.duration_days product_duration_days,
        v.title variant_title, v.price variant_price, v.duration_days variant_duration_days,
        u.telegram_id, u.username, u.first_name, u.referrer_id
        FROM orders o
        JOIN products p ON p.id=o.product_id
        LEFT JOIN product_variants v ON v.id=o.variant_id
        JOIN users u ON u.id=o.user_id
        WHERE o.id=?');
    $q->execute([$id]); return $q->fetch();
}
function user_orders(int $userId, int $limit=10): array {
    $q=db()->prepare('SELECT o.*, p.name product_name, p.delivery_type, p.image_url, v.title variant_title
        FROM orders o JOIN products p ON p.id=o.product_id LEFT JOIN product_variants v ON v.id=o.variant_id
        WHERE o.user_id=? ORDER BY o.id DESC LIMIT ?');
    $q->bindValue(1,$userId,PDO::PARAM_INT); $q->bindValue(2,$limit,PDO::PARAM_INT); $q->execute(); return $q->fetchAll();
}
function admin_orders($status=null, int $limit=20, string $search=''): array {
    $sql='SELECT o.*, p.name product_name, p.delivery_type, v.title variant_title, u.telegram_id, u.username
        FROM orders o JOIN products p ON p.id=o.product_id LEFT JOIN product_variants v ON v.id=o.variant_id JOIN users u ON u.id=o.user_id';
    $where=[]; $params=[];
    if ($status) {
        $statuses = is_array($status) ? $status : [$status];
        $statuses = array_map('normalize_order_status', $statuses);
        $where[] = 'o.status IN ('.implode(',', array_fill(0, count($statuses), '?')).')';
        $params = array_merge($params, $statuses);
    }
    if ($search !== '') {
        if (ctype_digit($search)) { $where[]='(o.id=? OR u.telegram_id=?)'; $params[]=(int)$search; $params[]=(int)$search; }
        else { $where[]='(u.username LIKE ? OR p.name LIKE ? OR v.title LIKE ?)'; $like='%'.$search.'%'; $params[]=$like; $params[]=$like; $params[]=$like; }
    }
    if ($where) $sql.=' WHERE '.implode(' AND ', $where);
    $sql.=' ORDER BY o.id DESC LIMIT '.(int)$limit;
    $q=db()->prepare($sql); $q->execute($params); return $q->fetchAll();
}
function coupon_by_code(string $code) {
    $code=normalize_coupon_code($code); if ($code==='') return false;
    $q=db()->prepare('SELECT * FROM coupons WHERE code=?'); $q->execute([$code]); return $q->fetch();
}
function calculate_coupon_discount(array $coupon, int $amount): int {
    if (!(int)$coupon['is_active']) return 0;
    if ((int)$coupon['max_uses'] > 0 && (int)$coupon['used_count'] >= (int)$coupon['max_uses']) return 0;
    if (!empty($coupon['expires_at']) && strtotime($coupon['expires_at']) < time()) return 0;
    if ($coupon['type'] === 'fixed') return min($amount, max(0, (int)$coupon['value']));
    return min($amount, (int)floor($amount * max(0, (int)$coupon['value']) / 100));
}
function apply_coupon_to_order(int $orderId, int $userId, string $code): array {
    $order=order_by_id($orderId);
    if (!$order || (int)$order['user_id'] !== $userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if (normalize_order_status($order['status']) !== 'pending_payment') throw new RuntimeException('ORDER_LOCKED');
    $coupon=coupon_by_code($code); if (!$coupon) throw new RuntimeException('COUPON_NOT_FOUND');
    $discount=calculate_coupon_discount($coupon, (int)$order['amount']);
    if ($discount <= 0) throw new RuntimeException('COUPON_INVALID');
    $final=max(0, (int)$order['amount'] - $discount);
    db()->prepare('UPDATE orders SET coupon_code=?, discount_amount=?, final_amount=? WHERE id=?')->execute([$coupon['code'],$discount,$final,$orderId]);
    db()->prepare('UPDATE coupons SET used_count=used_count+1 WHERE id=?')->execute([$coupon['id']]);
    add_order_event($orderId, 'pending_payment', 'کد تخفیف اعمال شد', $coupon['code'].' / '.money($discount));
    return order_by_id($orderId);
}
function update_order_status(int $orderId, string $status, string $title='', string $note='', bool $public=true): ?array {
    $status = normalize_order_status($status);
    $timeCol = ['receipt_submitted'=>'review_started_at','reviewing'=>'review_started_at','payment_confirmed'=>'paid_at','preparing'=>'prepared_at','delivered'=>'delivered_at','rejected'=>'rejected_at','canceled'=>'canceled_at'][$status] ?? null;
    $sql='UPDATE orders SET status=?'; $params=[$status];
    if ($timeCol) { $sql .= ", {$timeCol}=NOW()"; }
    $sql .= ' WHERE id=?'; $params[]=$orderId;
    db()->prepare($sql)->execute($params);
    add_order_event($orderId, $status, $title ?: order_status_fa($status), $note, $public);
    return order_by_id($orderId);
}
function submit_order_receipt(int $orderId, int $userId, string $note='', ?string $fileId=null): array {
    $order=order_by_id($orderId);
    if (!$order || (int)$order['user_id'] !== $userId) throw new RuntimeException('ORDER_NOT_FOUND');
    if (!in_array(normalize_order_status($order['status']), ['pending_payment','rejected'], true)) throw new RuntimeException('ORDER_LOCKED');
    db()->prepare('UPDATE orders SET status="receipt_submitted", payment_note=?, receipt_file_id=?, review_started_at=NOW() WHERE id=?')->execute([$note,$fileId,$orderId]);
    add_order_event($orderId, 'receipt_submitted', 'رسید پرداخت ارسال شد', $note ?: 'عکس رسید ارسال شد');
    return order_by_id($orderId);
}
function reject_order(int $orderId, string $note=''): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    db()->prepare('UPDATE orders SET status="rejected", admin_note=?, rejected_at=NOW() WHERE id=?')->execute([$note,$orderId]);
    add_order_event($orderId, 'rejected', 'سفارش رد شد', $note, true);
    return order_by_id($orderId);
}
function cancel_order(int $orderId, string $note=''): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    update_order_status($orderId, 'canceled', 'سفارش لغو شد', $note, true);
    return order_by_id($orderId);
}
function mark_order_paid(int $orderId): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    return update_order_status($orderId, 'payment_confirmed', 'پرداخت تایید شد', '', true);
}
function mark_order_preparing(int $orderId): ?array {
    return update_order_status($orderId, 'preparing', 'سفارش در حال آماده‌سازی است', '', true);
}
function reserve_inventory_for_order(array $order) {
    $params=[(int)$order['product_id']];
    $variantSql='';
    if (!empty($order['variant_id'])) { $variantSql=' AND (variant_id=? OR variant_id IS NULL)'; $params[]=(int)$order['variant_id']; }
    $sql='SELECT * FROM inventory_items WHERE product_id=?'.$variantSql.' AND status="available" ORDER BY variant_id DESC, id ASC LIMIT 1 FOR UPDATE';
    $pdo=db(); $pdo->beginTransaction();
    try {
        $q=$pdo->prepare($sql); $q->execute($params); $item=$q->fetch();
        if (!$item) { $pdo->commit(); return false; }
        $pdo->prepare('UPDATE inventory_items SET status="delivered", order_id=?, delivered_at=NOW() WHERE id=?')->execute([(int)$order['id'], (int)$item['id']]);
        $pdo->prepare('UPDATE orders SET delivered_inventory_id=? WHERE id=?')->execute([(int)$item['id'], (int)$order['id']]);
        $pdo->commit(); return $item;
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}
function delivery_template_for_order(array $order, string $rawDelivery): string {
    $type = normalize_delivery_type((string)($order['delivery_type'] ?? 'manual'));
    $template = setting('delivery_template_'.$type, setting('delivery_template_manual', "📦 سفارش شما آماده شد\n\n{delivery}"));
    $product = trim(($order['product_name'] ?? '').(!empty($order['variant_title']) ? ' - '.$order['variant_title'] : ''));
    return strtr($template, [
        '{delivery}'=>$rawDelivery,
        '{product}'=>$product,
        '{order_id}'=>'#'.($order['id'] ?? ''),
        '{expires_at}'=>!empty($order['expires_at']) ? $order['expires_at'] : '',
    ]);
}
function deliver_order(int $orderId, string $deliveryText): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    if (normalize_order_status($order['status']) === 'delivered') return $order;
    $formatted = delivery_template_for_order($order, $deliveryText);
    $reward=0;
    if (!empty($order['referrer_id']) && (int)$order['referrer_reward_amount'] === 0) {
        $ref=get_user_by_id((int)$order['referrer_id']);
        if ($ref) {
            $base = ($order['commission_type'] === 'percent') ? (int)floor((int)$order['final_amount'] * (int)$order['commission_value'] / 100) : (($order['commission_type'] === 'fixed') ? (int)$order['commission_value'] : 0);
            if ($base > 0) {
                $vip=vip_info((int)$ref['referrals_count']); $reward=(int)round($base * (float)$vip['multiplier']);
                add_balance((int)$ref['id'], $reward, 'shop_commission', 'پورسانت سفارش #'.$orderId, (int)$order['user_id']);
                send_msg((int)$ref['telegram_id'], "🎁 زیرمجموعه شما خرید انجام داد و سفارش تحویل شد.\nپورسانت: <b>".money($reward)."</b>\nسفارش: <code>#{$orderId}</code>", main_menu_keyboard(is_admin((int)$ref['telegram_id'])));
            }
        }
    }
    db()->prepare('UPDATE orders SET status="delivered", delivery_text=?, referrer_reward_amount=?, delivered_at=NOW() WHERE id=?')->execute([$formatted,$reward,$orderId]);
    add_order_event($orderId, 'delivered', 'سفارش تحویل داده شد', 'تحویل دستی/نیمه‌اتوماتیک انجام شد', true);
    return order_by_id($orderId);
}
function auto_deliver_order(int $orderId): ?array {
    $order=order_by_id($orderId); if (!$order) return null;
    $item = reserve_inventory_for_order($order);
    if (!$item) return null;
    return deliver_order($orderId, (string)$item['content']);
}
function inventory_count(int $productId, ?int $variantId=null): int {
    if ($variantId) { $q=db()->prepare('SELECT COUNT(*) c FROM inventory_items WHERE product_id=? AND (variant_id=? OR variant_id IS NULL) AND status="available"'); $q->execute([$productId,$variantId]); }
    else { $q=db()->prepare('SELECT COUNT(*) c FROM inventory_items WHERE product_id=? AND status="available"'); $q->execute([$productId]); }
    return (int)$q->fetch()['c'];
}
function order_public_payload(array $o): array {
    $name = $o['product_name'].(!empty($o['variant_title']) ? ' - '.$o['variant_title'] : '');
    return [
        'id'=>(int)$o['id'], 'product_name'=>$o['product_name'], 'variant_title'=>$o['variant_title'] ?? null, 'display_name'=>$name,
        'image_url'=>$o['image_url'] ?? null, 'amount'=>(int)$o['amount'], 'discount_amount'=>(int)$o['discount_amount'],
        'final_amount'=>(int)$o['final_amount'], 'coupon_code'=>$o['coupon_code'], 'status'=>normalize_order_status($o['status']), 'status_fa'=>order_status_fa($o['status']),
        'delivery_type'=>$o['delivery_type'], 'delivery_type_fa'=>delivery_type_fa($o['delivery_type']), 'delivery_text'=>$o['delivery_text'],
        'expires_at'=>$o['expires_at'] ?? null, 'timeline'=>array_map(function($e){ return ['status'=>$e['status'], 'title'=>$e['title'], 'note'=>$e['note'], 'created_at'=>$e['created_at']]; }, order_timeline((int)$o['id'], true)),
        'created_at'=>$o['created_at']
    ];
}
function customer_stats(int $userId): array {
    $q=db()->prepare('SELECT COUNT(*) orders_count, COALESCE(SUM(final_amount),0) total_spent FROM orders WHERE user_id=? AND status="delivered"');
    $q->execute([$userId]); $row=$q->fetch() ?: ['orders_count'=>0,'total_spent'=>0];
    $spent=(int)$row['total_spent'];
    if ($spent >= 10000000) $tier=['name'=>'Diamond','fa'=>'دایموند','emoji'=>'💎'];
    elseif ($spent >= 5000000) $tier=['name'=>'Gold','fa'=>'گلد','emoji'=>'🥇'];
    elseif ($spent >= 1000000) $tier=['name'=>'Silver','fa'=>'سیلور','emoji'=>'🥈'];
    else $tier=['name'=>'Bronze','fa'=>'برنز','emoji'=>'🥉'];
    return ['orders_count'=>(int)$row['orders_count'], 'total_spent'=>$spent, 'tier'=>$tier];
}
function sales_report(): array {
    $today=db()->query('SELECT COUNT(*) c, COALESCE(SUM(final_amount),0) s FROM orders WHERE DATE(created_at)=CURDATE() AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $month=db()->query('SELECT COUNT(*) c, COALESCE(SUM(final_amount),0) s FROM orders WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE()) AND status IN ("payment_confirmed","preparing","delivered")')->fetch();
    $pending=db()->query('SELECT COUNT(*) c FROM orders WHERE status IN ("receipt_submitted","reviewing","payment_confirmed","preparing")')->fetch();
    $top=db()->query('SELECT p.name, COUNT(*) c, COALESCE(SUM(o.final_amount),0) s FROM orders o JOIN products p ON p.id=o.product_id WHERE o.status="delivered" GROUP BY p.id ORDER BY s DESC LIMIT 5')->fetchAll();
    return ['today'=>$today,'month'=>$month,'pending'=>(int)$pending['c'],'top'=>$top];
}


// Admin Shop UX v2 helpers: image upload, delete-safe management and step-by-step wizards.
function parse_amount($value): int { return max(0, (int)preg_replace('/\D+/', '', (string)$value)); }
function step_payload_array(array $user): array {
    $raw = (string)($user['step_payload'] ?? '');
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}
function set_step_payload(int $telegram_id, string $step, array $payload): void { set_step($telegram_id, $step, json_encode($payload, JSON_UNESCAPED_UNICODE)); }
function shop_cancel_keyboard(): string { return json_markup(['inline_keyboard'=>[[['text'=>'❌ لغو و بازگشت', 'callback_data'=>'adm_shop']]]]); }
function public_base_url(): string { return rtrim((string)app_config('PUBLIC_BASE_URL',''), '/'); }
function public_url_for_path(string $relative): string { return public_base_url() . '/' . ltrim($relative, '/'); }
function telegram_file_to_public_url(string $fileId, string $folder='shop'): ?string {
    $info = tg('getFile', ['file_id'=>$fileId]);
    if (empty($info['ok']) || empty($info['result']['file_path'])) return null;
    $filePath = $info['result']['file_path'];
    $ext = pathinfo($filePath, PATHINFO_EXTENSION) ?: 'jpg';
    $safe = preg_replace('/[^A-Za-z0-9_\-]/', '', substr($fileId, 0, 28));
    $dir = __DIR__ . '/../public/uploads/' . trim($folder, '/') . '/' . date('Ymd');
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $relative = 'uploads/' . trim($folder, '/') . '/' . date('Ymd') . '/' . $safe . '.' . $ext;
    $dest = __DIR__ . '/../public/' . $relative;
    $url = 'https://api.telegram.org/file/bot' . app_config('BOT_TOKEN') . '/' . $filePath;
    $bin = @file_get_contents($url);
    if ($bin === false || strlen($bin) < 10) return null;
    file_put_contents($dest, $bin);
    return public_url_for_path($relative);
}
function image_url_from_message(array $message, string $folder='shop'): ?string {
    $text = trim((string)($message['text'] ?? $message['caption'] ?? ''));
    if ($text !== '' && preg_match('/^https?:\/\//i', $text)) return $text;
    if (!empty($message['photo']) && is_array($message['photo'])) { $last = end($message['photo']); if (!empty($last['file_id'])) return telegram_file_to_public_url((string)$last['file_id'], $folder); }
    if (!empty($message['document']['file_id']) && str_starts_with((string)($message['document']['mime_type'] ?? ''), 'image/')) return telegram_file_to_public_url((string)$message['document']['file_id'], $folder);
    return null;
}
function product_rows_keyboard(string $prefix, bool $includeInactive=false): array {
    $products = shop_products(null, !$includeInactive);
    $rows=[];
    foreach ($products as $p) $rows[] = [['text'=>'#'.$p['id'].' - '.$p['name'], 'callback_data'=>$prefix.$p['id']]];
    if (!$rows) $rows[] = [['text'=>'محصولی نیست', 'callback_data'=>'adm_shop']];
    return $rows;
}
function category_rows_keyboard(string $prefix): array {
    $rows=[];
    foreach (shop_categories(true) as $c) $rows[] = [['text'=>trim(($c['emoji']?:'🛒').' '.$c['title']), 'callback_data'=>$prefix.$c['id']]];
    $rows[] = [['text'=>'بدون دسته‌بندی', 'callback_data'=>$prefix.'0']];
    return $rows;
}
function variant_rows_keyboard(int $productId, string $prefix): array {
    $rows=[];
    foreach (product_variants($productId, true) as $v) $rows[] = [['text'=>'#'.$v['id'].' - '.$v['title'].' | '.money((int)$v['price']), 'callback_data'=>$prefix.$v['id']]];
    $rows[] = [['text'=>'بدون پلن / برای کل محصول', 'callback_data'=>$prefix.'0']];
    return $rows;
}
function soft_delete_product(int $productId): void { db()->prepare('UPDATE products SET is_active=0 WHERE id=?')->execute([$productId]); }
function soft_delete_category(int $categoryId): void { db()->prepare('UPDATE product_categories SET is_active=0 WHERE id=?')->execute([$categoryId]); }
function delete_available_inventory(int $inventoryId): bool { $q=db()->prepare('DELETE FROM inventory_items WHERE id=? AND status="available"'); $q->execute([$inventoryId]); return $q->rowCount() > 0; }
function soft_delete_variant(int $variantId): void { db()->prepare('UPDATE product_variants SET is_active=0 WHERE id=?')->execute([$variantId]); }
function set_product_image(int $productId, ?string $url): void { db()->prepare('UPDATE products SET image_url=? WHERE id=?')->execute([$url, $productId]); }
function set_category_image(int $categoryId, ?string $url): void { db()->prepare('UPDATE product_categories SET image_url=? WHERE id=?')->execute([$url, $categoryId]); }
function create_product_from_wizard(array $p): int {
    $commission = $p['commission_type'] ?? 'none'; if (!in_array($commission, ['none','fixed','percent'], true)) $commission='none';
    db()->prepare('INSERT INTO products (category_id,name,price,short_description,full_description,image_url,delivery_type,commission_type,commission_value,duration_days,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([!empty($p['category_id'])?(int)$p['category_id']:null, $p['name'] ?? '', (int)($p['price'] ?? 0), $p['short_description'] ?? '', $p['full_description'] ?? ($p['short_description'] ?? ''), $p['image_url'] ?? null, normalize_delivery_type($p['delivery_type'] ?? 'manual'), $commission, (int)($p['commission_value'] ?? 0), (int)($p['duration_days'] ?? 0), !empty($p['is_featured'])?1:0]);
    return (int)db()->lastInsertId();
}
function create_category_from_wizard(array $p): int {
    db()->prepare('INSERT INTO product_categories (emoji,title,image_url,sort_order,is_active) VALUES (?,?,?,?,1)')->execute([$p['emoji'] ?? '🛒', $p['title'] ?? 'دسته جدید', $p['image_url'] ?? null, 99]);
    return (int)db()->lastInsertId();
}
function inventory_items_for_admin(int $limit=80): array {
    $q=db()->prepare('SELECT i.*, p.name product_name, v.title variant_title FROM inventory_items i JOIN products p ON p.id=i.product_id LEFT JOIN product_variants v ON v.id=i.variant_id ORDER BY i.id DESC LIMIT ?');
    $q->bindValue(1, $limit, PDO::PARAM_INT); $q->execute(); return $q->fetchAll();
}


function setting_bool(string $key, bool $default=false): bool {
    $v = setting($key, $default ? '1' : '0');
    return in_array(strtolower((string)$v), ['1','true','yes','on'], true);
}
function button_colors(): array {
    return array_merge(['primary'=>'#1d9bf0','secondary'=>'#2563eb','danger'=>'#ef4444','success'=>'#22c55e','warning'=>'#f59e0b'], setting_json('button_colors', []));
}
function hard_delete_product(int $productId): bool {
    $q=db()->prepare('SELECT COUNT(*) c FROM orders WHERE product_id=?'); $q->execute([$productId]);
    if ((int)$q->fetch()['c'] > 0) return false;
    db()->prepare('DELETE FROM inventory_items WHERE product_id=?')->execute([$productId]);
    db()->prepare('DELETE FROM product_variants WHERE product_id=?')->execute([$productId]);
    $d=db()->prepare('DELETE FROM products WHERE id=?'); $d->execute([$productId]);
    return $d->rowCount() > 0;
}
function hard_delete_category(int $categoryId): bool {
    db()->prepare('UPDATE products SET category_id=NULL WHERE category_id=?')->execute([$categoryId]);
    $d=db()->prepare('DELETE FROM product_categories WHERE id=?'); $d->execute([$categoryId]);
    return $d->rowCount() > 0;
}
function hard_delete_variant(int $variantId): bool {
    $q=db()->prepare('SELECT COUNT(*) c FROM orders WHERE variant_id=?'); $q->execute([$variantId]);
    if ((int)$q->fetch()['c'] > 0) return false;
    db()->prepare('UPDATE inventory_items SET variant_id=NULL WHERE variant_id=?')->execute([$variantId]);
    $d=db()->prepare('DELETE FROM product_variants WHERE id=?'); $d->execute([$variantId]);
    return $d->rowCount() > 0;
}
function hard_delete_inventory(int $inventoryId): bool {
    $d=db()->prepare('DELETE FROM inventory_items WHERE id=?'); $d->execute([$inventoryId]);
    return $d->rowCount() > 0;
}
function update_product_field(int $id, string $field, $value): bool {
    $allowed=['category_id','name','price','short_description','full_description','image_url','delivery_type','commission_type','commission_value','duration_days','is_active','is_featured'];
    if (!in_array($field,$allowed,true)) return false;
    if (in_array($field,['price','commission_value','duration_days','is_active','is_featured'],true)) $value=(int)parse_amount($value);
    if ($field==='category_id') $value = ((int)$value > 0) ? (int)$value : null;
    if ($field==='delivery_type') $value=normalize_delivery_type((string)$value);
    if ($field==='commission_type' && !in_array($value,['none','fixed','percent'],true)) $value='none';
    $q=db()->prepare("UPDATE products SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}
function update_category_field(int $id, string $field, $value): bool {
    $allowed=['title','emoji','image_url','sort_order','is_active']; if(!in_array($field,$allowed,true)) return false;
    if (in_array($field,['sort_order','is_active'],true)) $value=(int)parse_amount($value);
    $q=db()->prepare("UPDATE product_categories SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}
function update_variant_field(int $id, string $field, $value): bool {
    $allowed=['title','price','duration_days','sort_order','is_active']; if(!in_array($field,$allowed,true)) return false;
    if (in_array($field,['price','duration_days','sort_order','is_active'],true)) $value=(int)parse_amount($value);
    $q=db()->prepare("UPDATE product_variants SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}
function update_inventory_field(int $id, string $field, $value): bool {
    $allowed=['product_id','variant_id','content','status']; if(!in_array($field,$allowed,true)) return false;
    if (in_array($field,['product_id','variant_id'],true)) $value=((int)$value>0)?(int)$value:null;
    if ($field==='status' && !in_array($value,['available','reserved','delivered','disabled'],true)) $value='available';
    $q=db()->prepare("UPDATE inventory_items SET {$field}=? WHERE id=?"); $q->execute([$value,$id]); return true;
}

function verify_webapp_init_data(string $initData): array|false {
    $token = app_config('BOT_TOKEN');
    parse_str($initData, $data);
    if (empty($data['hash'])) return false;
    $hash = $data['hash'];
    unset($data['hash']);
    ksort($data);
    $pairs = [];
    foreach ($data as $k => $v) $pairs[] = $k . '=' . $v;
    $checkString = implode("\n", $pairs);
    $secretKey = hash_hmac('sha256', $token, 'WebAppData', true);
    $calculated = hash_hmac('sha256', $checkString, $secretKey);
    if (!hash_equals($calculated, $hash)) return false;
    if (!empty($data['auth_date']) && time() - (int)$data['auth_date'] > 86400) return false;
    return $data;
}
