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
    seed_setting('brand_name', app_config('BRAND_NAME', 'BlueGate'));
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
function main_menu_keyboard(bool $admin=false): string {
    $mini = app_config('MINIAPP_URL', '');
    $rows = [
        [['text'=>'👥 لینک دعوت', 'callback_data'=>'u_ref'], ['text'=>'💰 کیف پول', 'callback_data'=>'u_wallet']],
        [['text'=>'📊 آمار من', 'callback_data'=>'u_stats'], ['text'=>'🏆 لیدربورد', 'callback_data'=>'u_leaderboard']],
        [['text'=>'🎯 مأموریت روزانه', 'callback_data'=>'u_missions'], ['text'=>'🎡 گردونه شانس', 'callback_data'=>'u_spin']],
        [['text'=>'🔥 کد اختصاصی', 'callback_data'=>'u_custom_code'], ['text'=>'📣 ابزار تبلیغ', 'callback_data'=>'u_promo']],
        [['text'=>'🏧 درخواست برداشت', 'callback_data'=>'u_withdraw'], ['text'=>'📞 پشتیبانی', 'callback_data'=>'u_support']],
    ];
    if ($mini) $rows[] = [['text'=>'🚀 باز کردن Mini App', 'web_app'=>['url'=>$mini]]];
    if ($admin) $rows[] = [['text'=>'⚙️ پنل ادمین', 'callback_data'=>'adm_home']];
    return json_markup(['inline_keyboard'=>$rows]);
}
function back_main_keyboard(): string { return json_markup(['inline_keyboard'=>[[['text'=>'🔙 بازگشت به منوی اصلی', 'callback_data'=>'main']]]]); }
function admin_keyboard(): string {
    return json_markup(['inline_keyboard'=>[
        [['text'=>'📈 آمار کل', 'callback_data'=>'adm_stats'], ['text'=>'🏧 برداشت‌ها', 'callback_data'=>'adm_withdrawals']],
        [['text'=>'💸 تغییر موجودی', 'callback_data'=>'adm_balance'], ['text'=>'🎁 پاداش خرید', 'callback_data'=>'adm_purchase']],
        [['text'=>'⚙️ تنظیمات پاداش‌ها', 'callback_data'=>'adm_settings'], ['text'=>'🎨 رنگ Mini App', 'callback_data'=>'adm_theme']],
        [['text'=>'📢 پیام همگانی', 'callback_data'=>'adm_broadcast'], ['text'=>'🏆 لیدربورد ادمین', 'callback_data'=>'adm_leaderboard']],
        [['text'=>'🔙 منوی کاربر', 'callback_data'=>'main']],
    ]]);
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
    return "💙 <b>{$brand} Referral Wallet</b>\n\nهمه‌چیز با دکمه‌ها انجام می‌شود؛ لینک دعوت بگیر، زیرمجموعه جذب کن، مأموریت بزن، گردونه بچرخون و برداشت ثبت کن.\n\n" . vip_line($user);
}
function validate_theme_color(string $color): ?string {
    $color = trim($color);
    if (preg_match('/^#[0-9a-fA-F]{6}$/', $color)) return strtolower($color);
    $map = ['blue'=>'#1d9bf0','purple'=>'#8b5cf6','green'=>'#22c55e','red'=>'#ef4444','orange'=>'#f97316','pink'=>'#ec4899','cyan'=>'#06b6d4'];
    return $map[strtolower($color)] ?? null;
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
