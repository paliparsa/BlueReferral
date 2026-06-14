<?php
require_once __DIR__ . '/bootstrap.php';
migrate();

function handle_update(array $update): void {
    if (isset($update['callback_query'])) {
        handle_callback($update['callback_query']);
        return;
    }
    if (isset($update['message'])) {
        handle_message($update['message']);
        return;
    }
}

function handle_message(array $message): void {
    $chat_id = (int)($message['chat']['id'] ?? 0);
    $from = $message['from'] ?? [];
    if (!$chat_id || !$from) return;
    $text = trim((string)($message['text'] ?? ''));

    $ref = null;
    if (str_starts_with($text, '/start')) {
        $parts = explode(' ', $text, 2);
        $payload = $parts[1] ?? '';
        if (str_starts_with($payload, 'ref_')) $ref = substr($payload, 4);
        elseif ($payload !== '') $ref = $payload;
    }

    $user = create_or_update_user($from, $ref);

    if (!is_joined_channel($chat_id)) {
        send_msg($chat_id, "برای فعال شدن رفرال، اول داخل کانال عضو شو و بعد دکمه «عضو شدم» رو بزن 👇", force_join_keyboard());
        return;
    }
    try_reward_referrer(get_user_by_tid($chat_id));
    $user = get_user_by_tid($chat_id);

    if (str_starts_with($text, '/start')) {
        clear_step($chat_id);
        send_msg($chat_id, main_text($user), main_menu_keyboard(is_admin($chat_id)));
        return;
    }

    // No public command flow. Any free text is interpreted only when a button has opened an input step.
    if (!empty($user['step'])) {
        handle_step_message($chat_id, $user, $message);
        return;
    }

    send_msg($chat_id, "برای کار با ربات از دکمه‌های زیر استفاده کن 👇", main_menu_keyboard(is_admin($chat_id)));
}

function handle_callback(array $cb): void {
    $id = $cb['id'];
    $data = (string)($cb['data'] ?? '');
    $from = $cb['from'] ?? [];
    $chat_id = (int)($cb['message']['chat']['id'] ?? $from['id'] ?? 0);
    $message_id = $cb['message']['message_id'] ?? null;
    if (!$chat_id || !$from) return;
    answer_cb($id);
    $user = create_or_update_user($from, null);

    if ($data === 'check_join') {
        if (!is_joined_channel($chat_id)) {
            send_msg($chat_id, "هنوز عضویت شما تأیید نشد. بعد از عضویت دوباره امتحان کن.", force_join_keyboard());
            return;
        }
        try_reward_referrer(get_user_by_tid($chat_id));
        $user = get_user_by_tid($chat_id);
        send_msg($chat_id, "✅ عضویت تأیید شد. خوش اومدی!", main_menu_keyboard(is_admin($chat_id)));
        return;
    }

    if (!is_joined_channel($chat_id)) {
        send_msg($chat_id, "برای فعال شدن رفرال، اول داخل کانال عضو شو و بعد دکمه «عضو شدم» رو بزن 👇", force_join_keyboard());
        return;
    }
    try_reward_referrer($user);
    $user = get_user_by_tid($chat_id);

    if ($data === 'main') { clear_step($chat_id); send_or_edit($chat_id, $message_id, main_text($user), main_menu_keyboard(is_admin($chat_id))); return; }
    if (str_starts_with($data, 'u_') || str_starts_with($data, 'shop_') || str_starts_with($data, 'order_')) { handle_user_callback($chat_id, $message_id, $user, $data); return; }
    if (str_starts_with($data, 'adm_') || str_starts_with($data, 'set_') || str_starts_with($data, 'theme_') || str_starts_with($data, 'wd_') || str_starts_with($data, 'prod_') || str_starts_with($data, 'cat_') || str_starts_with($data, 'coupon_') || str_starts_with($data, 'ord_')) {
        if (!is_admin($chat_id)) { send_msg($chat_id, 'دسترسی ادمین ندارید.'); return; }
        handle_admin_callback($chat_id, $message_id, $user, $data); return;
    }
}

function send_or_edit(int $chat_id, $message_id, string $text, ?string $markup=null): void {
    if ($message_id) edit_msg($chat_id, $message_id, $text, $markup);
    else send_msg($chat_id, $text, $markup);
}

function handle_user_callback(int $chat_id, $message_id, array $user, string $data): void {
    if ($data === 'u_ref') {
        $link = referral_link($user);
        $spinEvery = setting_int('spin_referrals_per_chance', 5);
        $txt = "👥 <b>لینک دعوت اختصاصی شما</b>\n\n<code>{$link}</code>\n\n💰 پاداش هر دعوت معتبر: <b>".money(setting_int('start_reward', 2000))."</b>\n🎡 هر <b>{$spinEvery}</b> دعوت معتبر = ۱ شانس گردونه\n\nاین لینک را برای دوستات بفرست؛ ورود با لینک شما، زیرمجموعه شما ثبت می‌شود.";
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_wallet') {
        $txt = "💰 <b>کیف پول شما</b>\n\nموجودی قابل برداشت: <b>".money($user['balance'])."</b>\nکل درآمد: <b>".money($user['total_earned'])."</b>\nکل برداشت موفق: <b>".money($user['total_withdrawn'])."</b>\nشانس گردونه: <b>{$user['spin_balance']}</b>\n\n".vip_line($user);
        send_or_edit($chat_id, $message_id, $txt, json_markup(['inline_keyboard'=>[[['text'=>'🏧 ثبت برداشت', 'callback_data'=>'u_withdraw']], [['text'=>'🔙 بازگشت', 'callback_data'=>'main']]]])); return;
    }
    if ($data === 'u_stats') {
        $today = today_referrals((int)$user['id']);
        $txt = "📊 <b>آمار همکاری شما</b>\n\nکل زیرمجموعه‌ها: <b>{$user['referrals_count']}</b>\nدعوت‌های امروز: <b>{$today}</b>\nموجودی: <b>".money($user['balance'])."</b>\nشانس گردونه: <b>{$user['spin_balance']}</b>\n\n".vip_line($user);
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_leaderboard') {
        $rows = top_users(10); $out = "🏆 <b>لیدربورد همکاری</b>\n\n"; $i=1;
        foreach ($rows as $r) { $medal = $i===1?'🥇':($i===2?'🥈':($i===3?'🥉':$i.'.')); $out .= "{$medal} ".display_name($r)." — <b>{$r['referrals_count']}</b> دعوت | ".money($r['total_earned'])."\n"; $i++; }
        if (!$rows) $out .= 'هنوز کسی وارد لیدربورد نشده.';
        send_or_edit($chat_id, $message_id, $out, back_main_keyboard()); return;
    }
    if ($data === 'u_missions') {
        [$todayCount, $claimed] = claim_available_missions($user);
        $user = get_user_by_tid($chat_id);
        $today = date('Y-m-d');
        $out = "🎯 <b>مأموریت روزانه</b>\n\nدعوت‌های امروز شما: <b>{$todayCount}</b>\n\n";
        foreach (mission_rows() as $m) {
            if ($m['target'] <= 0 || $m['reward'] <= 0) continue;
            $done = $todayCount >= $m['target'];
            $claimedBefore = is_mission_claimed((int)$user['id'], $today, (int)$m['target']);
            $icon = $claimedBefore ? '✅' : ($done ? '🎁' : '⏳');
            $out .= "{$icon} {$m['target']} دعوت امروز = <b>".money($m['reward'])."</b>" . ($claimedBefore ? ' | دریافت شد' : '') . "\n";
        }
        if ($claimed) $out .= "\n🔥 پاداش‌های جدید به کیف پولت اضافه شد.";
        else $out .= "\nهر روز از نو شروع می‌شود؛ دعوت‌های امروزت را زیاد کن.";
        send_or_edit($chat_id, $message_id, $out, back_main_keyboard()); return;
    }
    if ($data === 'u_spin') {
        $user = get_user_by_tid($chat_id);
        if ((int)$user['spin_balance'] <= 0) {
            $spinEvery = setting_int('spin_referrals_per_chance', 5);
            send_or_edit($chat_id, $message_id, "🎡 فعلاً شانس گردونه نداری.\nهر <b>{$spinEvery}</b> دعوت معتبر = ۱ بار گردونه.", back_main_keyboard()); return;
        }
        $reward = weighted_spin_reward();
        $title = $reward['title'] ?? 'جایزه گردونه'; $amount = (int)($reward['amount'] ?? 0);
        db()->prepare('UPDATE users SET spin_balance=spin_balance-1 WHERE id=? AND spin_balance>0')->execute([$user['id']]);
        db()->prepare('INSERT INTO spin_logs (user_id, prize_title, prize_amount) VALUES (?,?,?)')->execute([$user['id'], $title, $amount]);
        if ($amount > 0) add_balance($user['id'], $amount, 'spin_reward', $title, null);
        if (!empty($reward['notify_admin'])) notify_admins("🎡 جایزه نیازمند بررسی\nکاربر: <code>{$chat_id}</code>\nجایزه: <b>".h($title)."</b>");
        $remain = max(0, (int)$user['spin_balance'] - 1);
        $txt = "🎡 گردونه چرخید...\n\nبرنده شدی: <b>".h($title)."</b>\nشانس باقی‌مانده: <b>{$remain}</b>" . ($amount > 0 ? "\n✅ مبلغ به کیف پولت اضافه شد." : "\nادمین برای تحویل جایزه بررسی می‌کند.");
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_custom_code') {
        $min = setting_int('custom_code_min_referrals', 3);
        if ((int)$user['referrals_count'] < $min) {
            send_or_edit($chat_id, $message_id, "🔥 کد دعوت اختصاصی وقتی باز می‌شود که حداقل <b>{$min}</b> زیرمجموعه داشته باشی.\nالان داری: <b>{$user['referrals_count']}</b>", back_main_keyboard()); return;
        }
        set_step($chat_id, 'custom_ref_code');
        send_msg($chat_id, "کد اختصاصی دلخواهت را بفرست.\nمثال: <code>parsa_blue</code>\n\nفقط حروف انگلیسی، عدد و _ | طول ۴ تا ۲۰ کاراکتر", back_main_keyboard()); return;
    }
    if ($data === 'u_promo') {
        $link = referral_link($user);
        $caption = "💙 با BlueGate هم اینترنت آزاد داشته باش، هم از دعوت دوستات درآمد بگیر!\n\n👥 با لینک من وارد ربات شو؛ فعالیتت زیرمجموعه من حساب می‌شه.\n🎁 پاداش دعوت، کیف پول، گردونه شانس و برداشت نقدی فعال است.\n\n🔗 {$link}";
        $txt = "📣 <b>متن آماده تبلیغ شما</b>\n\n<code>".h($caption)."</code>\n\nلینک اختصاصی:\n<code>{$link}</code>";
        send_or_edit($chat_id, $message_id, $txt, back_main_keyboard()); return;
    }
    if ($data === 'u_withdraw') {
        $user = get_user_by_tid($chat_id);
        $min = setting_int('min_withdraw', 50000);
        if ((int)$user['balance'] < $min) { send_or_edit($chat_id, $message_id, 'حداقل برداشت <b>'.money($min).'</b> است. موجودی شما: <b>'.money($user['balance']).'</b>', back_main_keyboard()); return; }
        $pending = db()->prepare('SELECT COUNT(*) c FROM withdrawals WHERE user_id=? AND status="pending"');
        $pending->execute([$user['id']]);
        if ((int)$pending->fetch()['c'] > 0) { send_or_edit($chat_id, $message_id, 'شما یک درخواست برداشت در انتظار دارید. بعد از بررسی دوباره می‌توانید درخواست ثبت کنید.', back_main_keyboard()); return; }
        set_step($chat_id, 'withdraw_card');
        send_msg($chat_id, "شماره کارت/شبا و نام صاحب حساب را در یک پیام بفرست.\nمبلغ قابل برداشت: <b>".money($user['balance'])."</b>", back_main_keyboard()); return;
    }

    if ($data === 'u_shop') { show_shop_home($chat_id, $message_id); return; }
    if ($data === 'u_orders') { show_user_orders($chat_id, $message_id, (int)$user['id']); return; }
    if (str_starts_with($data, 'shop_cat_')) { show_shop_category($chat_id, $message_id, (int)substr($data, 9)); return; }
    if (str_starts_with($data, 'shop_prod_')) { show_shop_product($chat_id, $message_id, (int)substr($data, 10)); return; }
    if (str_starts_with($data, 'shop_buy_')) {
        try {
            $order = create_shop_order((int)$user['id'], (int)substr($data, 9));
            show_order_invoice($chat_id, $message_id, $order);
            notify_admins("🧾 سفارش جدید ثبت شد\nسفارش: <code>#{$order['id']}</code>\nکاربر: <code>{$chat_id}</code>\nمحصول: <b>".h($order['product_name'])."</b>\nمبلغ: <b>".money($order['final_amount'])."</b>");
        } catch (Throwable $e) { send_or_edit($chat_id, $message_id, 'محصول پیدا نشد یا غیرفعال است.', back_main_keyboard()); }
        return;
    }
    if (str_starts_with($data, 'order_view_')) {
        $order = order_by_id((int)substr($data, 11));
        if (!$order || (int)$order['user_id'] !== (int)$user['id']) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', back_main_keyboard()); return; }
        show_order_invoice($chat_id, $message_id, $order); return;
    }
    if (str_starts_with($data, 'order_receipt_')) {
        $oid = (int)substr($data, 14);
        $order = order_by_id($oid);
        if (!$order || (int)$order['user_id'] !== (int)$user['id']) { send_or_edit($chat_id, $message_id, 'سفارش پیدا نشد.', back_main_keyboard()); return; }
        set_step($chat_id, 'order_receipt', (string)$oid);
        send_msg($chat_id, "رسید پرداخت سفارش <code>#{$oid}</code> را بفرست.\nمی‌تواند متن، توضیح پرداخت یا عکس رسید باشد.", back_main_keyboard()); return;
    }
    if (str_starts_with($data, 'order_coupon_')) {
        $oid = (int)substr($data, 13);
        $order = order_by_id($oid);
        if (!$order || (int)$order['user_id'] !== (int)$user['id'] || $order['status'] !== 'pending_payment') { send_or_edit($chat_id, $message_id, 'برای این سفارش نمی‌شود کد تخفیف ثبت کرد.', back_main_keyboard()); return; }
        set_step($chat_id, 'order_coupon', (string)$oid);
        send_msg($chat_id, "کد تخفیف سفارش <code>#{$oid}</code> را بفرست.", back_main_keyboard()); return;
    }
    if (str_starts_with($data, 'order_cancel_')) {
        $oid = (int)substr($data, 13);
        $order = order_by_id($oid);
        if ($order && (int)$order['user_id'] === (int)$user['id'] && $order['status'] === 'pending_payment') {
            db()->prepare('UPDATE orders SET status="canceled" WHERE id=?')->execute([$oid]);
            send_or_edit($chat_id, $message_id, "سفارش <code>#{$oid}</code> لغو شد.", back_main_keyboard()); return;
        }
        send_or_edit($chat_id, $message_id, 'امکان لغو این سفارش نیست.', back_main_keyboard()); return;
    }

    if ($data === 'u_support') {
        $support = app_config('SUPPORT_USERNAME', 'BlueGateSupport');
        send_or_edit($chat_id, $message_id, "📞 پشتیبانی: @{$support}", back_main_keyboard()); return;
    }
}

function handle_admin_callback(int $chat_id, $message_id, array $user, string $data): void {
    if ($data === 'adm_home') { clear_step($chat_id); send_or_edit($chat_id, $message_id, '⚙️ <b>پنل ادمین</b>\nهمه مدیریت‌ها با دکمه انجام می‌شود.', admin_keyboard()); return; }
    if ($data === 'adm_stats') {
        $u = db()->query('SELECT COUNT(*) c, COALESCE(SUM(balance),0) b, COALESCE(SUM(total_earned),0) e, COALESCE(SUM(referrals_count),0) r, COALESCE(SUM(spin_balance),0) s FROM users')->fetch();
        $w = db()->query('SELECT COUNT(*) c FROM withdrawals WHERE status="pending"')->fetch();
        $m = db()->query('SELECT COALESCE(SUM(reward_amount),0) s FROM mission_claims WHERE mission_date=CURDATE()')->fetch();
        $txt = "📈 <b>آمار کل</b>\n\nکاربران: <b>{$u['c']}</b>\nکل دعوت‌ها: <b>{$u['r']}</b>\nموجودی کل کاربران: <b>".money($u['b'])."</b>\nکل درآمد ثبت‌شده: <b>".money($u['e'])."</b>\nشانس‌های فعال گردونه: <b>{$u['s']}</b>\nپاداش مأموریت امروز: <b>".money($m['s'])."</b>\nبرداشت‌های در انتظار: <b>{$w['c']}</b>";
        send_or_edit($chat_id, $message_id, $txt, admin_keyboard()); return;
    }
    if ($data === 'adm_withdrawals') {
        $rows = db()->query('SELECT w.*, u.telegram_id, u.username FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.status="pending" ORDER BY w.id DESC LIMIT 20')->fetchAll();
        if (!$rows) { send_or_edit($chat_id, $message_id, 'برداشت در انتظار نداریم.', admin_keyboard()); return; }
        send_or_edit($chat_id, $message_id, '🏧 <b>برداشت‌های در انتظار</b>\nدر پیام‌های بعدی هر برداشت را جدا می‌بینی.', admin_keyboard());
        foreach ($rows as $w) {
            send_msg($chat_id, "#{$w['id']} | @".h($w['username'])." | <code>{$w['telegram_id']}</code>\nمبلغ: <b>".money($w['amount'])."</b>\n".h($w['card_info']), json_markup(['inline_keyboard'=>[[['text'=>'✅ پرداخت شد','callback_data'=>'wd_paid_'.$w['id']], ['text'=>'❌ رد شود','callback_data'=>'wd_reject_'.$w['id']]]]]));
        }
        return;
    }
    if ($data === 'adm_balance') { set_step($chat_id, 'admin_balance'); send_msg($chat_id, "آیدی عددی تلگرام، مبلغ و توضیح را در یک پیام بفرست.\nمثال:\n<code>497837519 20000 پاداش دستی</code>", admin_keyboard()); return; }
    if ($data === 'adm_purchase') { set_step($chat_id, 'admin_purchase'); send_msg($chat_id, "برای ثبت پاداش خرید، آیدی عددی خریدار و مبلغ پایه را بفرست.\nمثال:\n<code>497837519 10000</code>\nضریب VIP معرف روی مبلغ اعمال می‌شود.", admin_keyboard()); return; }
    if ($data === 'adm_broadcast') { set_step($chat_id, 'admin_broadcast'); send_msg($chat_id, "متن پیام همگانی را بفرست.\nHTML ساده مثل <b>bold</b> پشتیبانی می‌شود.", admin_keyboard()); return; }
    if ($data === 'adm_leaderboard') {
        $rows = top_users(20); $out = "🏆 <b>لیدربورد ادمین</b>\n\n"; $i=1;
        foreach ($rows as $r) { $vip = vip_info((int)$r['referrals_count']); $out .= "{$i}. ".display_name($r)." | <code>{$r['telegram_id']}</code> | {$vip['emoji']} {$vip['fa']} | {$r['referrals_count']} دعوت | ".money($r['total_earned'])."\n"; $i++; }
        if (!$rows) $out .= 'هنوز داده‌ای نداریم.';
        send_or_edit($chat_id, $message_id, $out, admin_keyboard()); return;
    }

    if ($data === 'adm_shop') { show_admin_shop_home($chat_id, $message_id); return; }
    if ($data === 'adm_products') { show_admin_products($chat_id, $message_id); return; }
    if ($data === 'adm_add_product') { set_step($chat_id, 'admin_add_product'); send_msg($chat_id, "➕ افزودن محصول\nهر مورد را در یک خط بفرست:\n\n<code>نام محصول\nقیمت تومان\nدسته‌بندی یا ID دسته\nنوع تحویل: manual/account/vpn/code/file\nپورسانت: none یا fixed:20000 یا percent:10\nتوضیح کوتاه\nتوضیح کامل اختیاری</code>", admin_shop_keyboard()); return; }
    if ($data === 'adm_categories') { show_admin_categories($chat_id, $message_id); return; }
    if ($data === 'adm_add_category') { set_step($chat_id, 'admin_add_category'); send_msg($chat_id, "نام دسته را بفرست. مثال:\n<code>🤖 هوش مصنوعی</code>", admin_shop_keyboard()); return; }
    if ($data === 'adm_coupons') { show_admin_coupons($chat_id, $message_id); return; }
    if ($data === 'adm_add_coupon') { set_step($chat_id, 'admin_add_coupon'); send_msg($chat_id, "🎟 افزودن کد تخفیف\nهر مورد را در یک خط بفرست:\n\n<code>BLUE10\npercent\n10\n100</code>\n\nخط چهارم حداکثر استفاده است؛ 0 یعنی نامحدود. برای تخفیف مبلغی به جای percent بنویس fixed.", admin_shop_keyboard()); return; }
    if ($data === 'adm_orders') { show_admin_order_filters($chat_id, $message_id); return; }
    if (str_starts_with($data, 'adm_orders_')) { show_admin_orders($chat_id, $message_id, substr($data, 11)); return; }
    if ($data === 'adm_payment') { set_step($chat_id, 'admin_payment_instructions'); send_msg($chat_id, "متن راهنمای پرداخت را بفرست. این متن زیر فاکتور خرید نمایش داده می‌شود.", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'prod_toggle_')) { $pid=(int)substr($data,12); db()->prepare('UPDATE products SET is_active=1-is_active WHERE id=?')->execute([$pid]); show_admin_products($chat_id, $message_id); return; }
    if (str_starts_with($data, 'ord_view_')) { show_admin_order($chat_id, $message_id, (int)substr($data,9)); return; }
    if (str_starts_with($data, 'prod_delete_')) { $pid=(int)substr($data,12); db()->prepare('UPDATE products SET is_active=0 WHERE id=?')->execute([$pid]); send_msg($chat_id, "محصول #{$pid} غیرفعال شد.", admin_shop_keyboard()); return; }
    if (str_starts_with($data, 'ord_paid_')) { $oid=(int)substr($data,9); $o=mark_order_paid($oid); if ($o) { send_msg($o['telegram_id'], "✅ پرداخت سفارش <code>#{$oid}</code> تایید شد.\nبعد از آماده شدن، اطلاعات تحویل برای شما ارسال می‌شود.", main_menu_keyboard(is_admin($o['telegram_id']))); send_msg($chat_id, "✅ سفارش #{$oid} تایید شد.", admin_order_keyboard($oid)); } return; }
    if (str_starts_with($data, 'ord_reject_')) { $oid=(int)substr($data,11); $o=reject_order($oid); if ($o) { send_msg($o['telegram_id'], "❌ سفارش <code>#{$oid}</code> رد شد. برای پیگیری با پشتیبانی ارتباط بگیر.", main_menu_keyboard(is_admin($o['telegram_id']))); send_msg($chat_id, "❌ سفارش #{$oid} رد شد.", admin_shop_keyboard()); } return; }
    if (str_starts_with($data, 'ord_deliver_')) { $oid=(int)substr($data,12); set_step($chat_id, 'admin_deliver_order', (string)$oid); send_msg($chat_id, "📩 متن تحویل سفارش <code>#{$oid}</code> را بفرست.\nمثلاً ایمیل/پسورد، لینک ساب VPN، کد گیفت یا توضیحات تحویل.", admin_shop_keyboard()); return; }

    if ($data === 'adm_settings') {
        $txt = "⚙️ <b>تنظیمات پاداش‌ها</b>\n\nپاداش دعوت: <b>".money(setting_int('start_reward', 2000))."</b>\nحداقل برداشت: <b>".money(setting_int('min_withdraw', 50000))."</b>\nپاداش پایه خرید: <b>".money(setting_int('purchase_reward', 10000))."</b>\nهر چند دعوت یک گردونه: <b>".setting_int('spin_referrals_per_chance', 5)."</b>\nحداقل دعوت برای کد اختصاصی: <b>".setting_int('custom_code_min_referrals', 3)."</b>";
        $kb = json_markup(['inline_keyboard'=>[
            [['text'=>'پاداش دعوت', 'callback_data'=>'set_start_reward'], ['text'=>'حداقل برداشت', 'callback_data'=>'set_min_withdraw']],
            [['text'=>'پاداش خرید', 'callback_data'=>'set_purchase_reward'], ['text'=>'هر چند دعوت گردونه', 'callback_data'=>'set_spin_every']],
            [['text'=>'حداقل کد اختصاصی', 'callback_data'=>'set_custom_code_min']],
            [['text'=>'مأموریت ۱', 'callback_data'=>'set_mission1'], ['text'=>'مأموریت ۲', 'callback_data'=>'set_mission2'], ['text'=>'مأموریت ۳', 'callback_data'=>'set_mission3']],
            [['text'=>'🔙 پنل ادمین', 'callback_data'=>'adm_home']],
        ]]);
        send_or_edit($chat_id, $message_id, $txt, $kb); return;
    }
    if ($data === 'adm_theme') {
        $txt = "🎨 <b>رنگ اصلی Mini App</b>\nرنگ فعلی: <code>".h(setting('theme_color', '#1d9bf0'))."</code>\n\nیک رنگ انتخاب کن یا دکمه «رنگ دلخواه» را بزن.";
        $kb = json_markup(['inline_keyboard'=>[
            [['text'=>'آبی', 'callback_data'=>'theme_#1d9bf0'], ['text'=>'بنفش', 'callback_data'=>'theme_#8b5cf6'], ['text'=>'سبز', 'callback_data'=>'theme_#22c55e']],
            [['text'=>'قرمز', 'callback_data'=>'theme_#ef4444'], ['text'=>'نارنجی', 'callback_data'=>'theme_#f97316'], ['text'=>'صورتی', 'callback_data'=>'theme_#ec4899']],
            [['text'=>'رنگ دلخواه HEX', 'callback_data'=>'set_theme_custom']],
            [['text'=>'🔙 پنل ادمین', 'callback_data'=>'adm_home']],
        ]]);
        send_or_edit($chat_id, $message_id, $txt, $kb); return;
    }
    if (str_starts_with($data, 'theme_')) {
        $color = substr($data, 6);
        $valid = validate_theme_color($color);
        if ($valid) set_setting('theme_color', $valid);
        send_or_edit($chat_id, $message_id, "✅ رنگ Mini App تغییر کرد: <code>{$valid}</code>", admin_keyboard()); return;
    }
    if ($data === 'set_theme_custom') { set_step($chat_id, 'admin_set_setting', 'theme_color'); send_msg($chat_id, "کد رنگ HEX را بفرست. مثال: <code>#1d9bf0</code>", admin_keyboard()); return; }
    $setMap = [
        'set_start_reward'=>'start_reward', 'set_min_withdraw'=>'min_withdraw', 'set_purchase_reward'=>'purchase_reward', 'set_spin_every'=>'spin_referrals_per_chance', 'set_custom_code_min'=>'custom_code_min_referrals',
        'set_mission1'=>'mission_1', 'set_mission2'=>'mission_2', 'set_mission3'=>'mission_3'
    ];
    if (isset($setMap[$data])) {
        set_step($chat_id, 'admin_set_setting', $setMap[$data]);
        if (str_starts_with($setMap[$data], 'mission_')) send_msg($chat_id, "برای مأموریت، هدف و پاداش را بفرست. مثال:\n<code>3 10000</code>", admin_keyboard());
        else send_msg($chat_id, "عدد جدید را بفرست.", admin_keyboard());
        return;
    }
    if (str_starts_with($data, 'wd_paid_') || str_starts_with($data, 'wd_reject_')) {
        $isPaid = str_starts_with($data, 'wd_paid_');
        $wid = (int)preg_replace('/\D/', '', $data);
        $q = db()->prepare('SELECT w.*, u.telegram_id FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.id=? AND w.status="pending"');
        $q->execute([$wid]); $w = $q->fetch();
        if (!$w) { send_msg($chat_id, 'این برداشت قبلاً بررسی شده یا پیدا نشد.', admin_keyboard()); return; }
        if ($isPaid) {
            db()->prepare('UPDATE withdrawals SET status="paid" WHERE id=?')->execute([$wid]);
            db()->prepare('UPDATE users SET total_withdrawn=total_withdrawn+? WHERE id=?')->execute([$w['amount'], $w['user_id']]);
            send_msg($w['telegram_id'], "✅ برداشت شما پرداخت شد.\nمبلغ: <b>".money($w['amount'])."</b>", main_menu_keyboard(is_admin($w['telegram_id'])));
            send_msg($chat_id, "✅ برداشت #{$wid} پرداخت شد.", admin_keyboard());
        } else {
            db()->prepare('UPDATE withdrawals SET status="rejected" WHERE id=?')->execute([$wid]);
            db()->prepare('UPDATE users SET balance=balance+? WHERE id=?')->execute([$w['amount'], $w['user_id']]);
            send_msg($w['telegram_id'], "❌ برداشت شما رد شد و مبلغ به کیف پول برگشت.\nمبلغ: <b>".money($w['amount'])."</b>", main_menu_keyboard(is_admin($w['telegram_id'])));
            send_msg($chat_id, "❌ برداشت #{$wid} رد شد و مبلغ برگشت خورد.", admin_keyboard());
        }
        return;
    }
}


function handle_step_message(int $chat_id, array $user, array $message): void {
    $step = (string)($user['step'] ?? '');
    if ($step === 'order_receipt') {
        $oid = (int)$user['step_payload'];
        $note = trim((string)($message['caption'] ?? $message['text'] ?? ''));
        $fileId = null;
        if (!empty($message['photo']) && is_array($message['photo'])) {
            $last = end($message['photo']);
            $fileId = $last['file_id'] ?? null;
        }
        if ($note === '' && !$fileId) { send_msg($chat_id, 'لطفاً متن رسید یا عکس رسید را ارسال کن.', back_main_keyboard()); return; }
        try {
            $order = submit_order_receipt($oid, (int)$user['id'], $note, $fileId);
            clear_step($chat_id);
            send_msg($chat_id, "✅ رسید سفارش <code>#{$oid}</code> ثبت شد.\nوضعیت: <b>".order_status_fa($order['status'])."</b>\nبعد از بررسی ادمین اطلاع داده می‌شود.", main_menu_keyboard(is_admin($chat_id)));
            $msg = order_admin_card($order) . "\n\nرسید/توضیح پرداخت:\n" . h($note ?: 'عکس رسید ارسال شده است.');
            foreach (app_config('ADMIN_IDS', []) as $aid) {
                if ($fileId) tg('sendPhoto', ['chat_id'=>$aid, 'photo'=>$fileId, 'caption'=>$msg, 'parse_mode'=>'HTML', 'reply_markup'=>admin_order_keyboard((int)$order['id'])]);
                else send_msg($aid, $msg, admin_order_keyboard((int)$order['id']));
            }
        } catch (Throwable $e) { clear_step($chat_id); send_msg($chat_id, 'ثبت رسید ممکن نشد. سفارش پیدا نشد یا قابل پرداخت نیست.', main_menu_keyboard(is_admin($chat_id))); }
        return;
    }
    handle_step_input($chat_id, $user, trim((string)($message['text'] ?? '')));
}

function handle_step_input(int $chat_id, array $user, string $text): void {
    $step = $user['step'];
    if ($text === '' && $step !== 'admin_broadcast') { send_msg($chat_id, 'لطفاً متن معتبر بفرست.', main_menu_keyboard(is_admin($chat_id))); return; }

    if ($step === 'withdraw_card') {
        $user = get_user_by_tid($chat_id); $amount = (int)$user['balance'];
        $min = setting_int('min_withdraw', 50000);
        if ($amount < $min) { clear_step($chat_id); send_msg($chat_id, 'موجودی شما دیگر به حداقل برداشت نمی‌رسد.', main_menu_keyboard(is_admin($chat_id))); return; }
        db()->prepare('INSERT INTO withdrawals (user_id, amount, card_info) VALUES (?,?,?)')->execute([$user['id'], $amount, $text]);
        db()->prepare('UPDATE users SET balance=0 WHERE id=?')->execute([$user['id']]);
        clear_step($chat_id);
        send_msg($chat_id, "✅ درخواست برداشت ثبت شد.\nمبلغ: <b>".money($amount)."</b>\nبعد از بررسی ادمین اطلاع داده می‌شود.", main_menu_keyboard(is_admin($chat_id)));
        notify_admins("🏧 برداشت جدید\nکاربر: <code>{$chat_id}</code>\nمبلغ: <b>".money($amount)."</b>\nاطلاعات:\n".h($text));
        return;
    }
    if ($step === 'custom_ref_code') {
        $code = normalize_ref_code($text);
        if (strlen($code) < 4 || strlen($code) > 20) { send_msg($chat_id, 'کد باید بین ۴ تا ۲۰ کاراکتر باشد.', back_main_keyboard()); return; }
        $exists = get_user_by_ref($code);
        if ($exists && (int)$exists['id'] !== (int)$user['id']) { send_msg($chat_id, 'این کد قبلاً گرفته شده. یک کد دیگر بفرست.', back_main_keyboard()); return; }
        db()->prepare('UPDATE users SET ref_code=? WHERE id=?')->execute([$code, $user['id']]);
        clear_step($chat_id); $user = get_user_by_tid($chat_id);
        send_msg($chat_id, "✅ کد اختصاصی ثبت شد.\nلینک جدید شما:\n<code>".referral_link($user)."</code>", main_menu_keyboard(is_admin($chat_id))); return;
    }


    if ($step === 'order_coupon') {
        $oid = (int)$user['step_payload'];
        try {
            $order = apply_coupon_to_order($oid, (int)$user['id'], $text);
            clear_step($chat_id);
            send_msg($chat_id, "✅ کد تخفیف اعمال شد.\nتخفیف: <b>".money($order['discount_amount'])."</b>\nمبلغ نهایی: <b>".money($order['final_amount'])."</b>", order_user_keyboard($order));
        } catch (Throwable $e) { send_msg($chat_id, 'کد تخفیف معتبر نیست یا برای این سفارش قابل استفاده نیست.', back_main_keyboard()); }
        return;
    }

    if (!is_admin($chat_id)) { clear_step($chat_id); send_msg($chat_id, 'این مرحله فقط برای ادمین است.', main_menu_keyboard(false)); return; }

    if ($step === 'admin_balance') {
        $parts = preg_split('/\s+/', $text, 3);
        if (count($parts) < 2) { send_msg($chat_id, 'فرمت درست نیست. مثال: <code>497837519 20000 پاداش دستی</code>', admin_keyboard()); return; }
        [$tid, $amount] = [$parts[0], (int)$parts[1]]; $desc = $parts[2] ?? 'تغییر موجودی توسط ادمین';
        $target = get_user_by_tid((int)$tid);
        if (!$target) { send_msg($chat_id, 'کاربر پیدا نشد.', admin_keyboard()); return; }
        add_balance($target['id'], $amount, 'admin_adjust', $desc, null);
        clear_step($chat_id);
        send_msg($chat_id, '✅ موجودی تغییر کرد.', admin_keyboard());
        send_msg($target['telegram_id'], "💸 موجودی شما تغییر کرد.\nمبلغ: <b>".money($amount)."</b>\nتوضیح: ".h($desc), main_menu_keyboard(is_admin($target['telegram_id'])));
        return;
    }
    if ($step === 'admin_purchase') {
        $parts = preg_split('/\s+/', $text, 2);
        if (count($parts) < 2) { send_msg($chat_id, 'فرمت درست نیست. مثال: <code>497837519 10000</code>', admin_keyboard()); return; }
        $buyer = get_user_by_tid((int)$parts[0]); $base = (int)$parts[1];
        if (!$buyer || empty($buyer['referrer_id'])) { clear_step($chat_id); send_msg($chat_id, 'این خریدار معرف ثبت‌شده ندارد یا پیدا نشد.', admin_keyboard()); return; }
        $referrer = get_user_by_id((int)$buyer['referrer_id']);
        $vip = vip_info((int)$referrer['referrals_count']);
        $amount = (int)round($base * (float)$vip['multiplier']);
        add_balance($referrer['id'], $amount, 'purchase_reward', 'پورسانت خرید زیرمجموعه با ضریب VIP', $buyer['id']);
        clear_step($chat_id);
        send_msg($chat_id, "✅ پاداش خرید ثبت شد.\nمعرف: ".display_name($referrer)."\nمبلغ نهایی: <b>".money($amount)."</b>", admin_keyboard());
        send_msg($referrer['telegram_id'], "🎁 زیرمجموعه شما خرید انجام داد.\nپورسانت: <b>".money($amount)."</b>\nسطح: {$vip['emoji']} {$vip['fa']}", main_menu_keyboard(is_admin($referrer['telegram_id'])));
        return;
    }

    if ($step === 'admin_add_category') {
        $line = trim($text); $emoji='🛒'; $title=$line;
        if (preg_match('/^(.{1,4})\s+(.+)$/u', $line, $m)) { $emoji=$m[1]; $title=$m[2]; }
        db()->prepare('INSERT INTO product_categories (emoji,title,sort_order) VALUES (?,?,99)')->execute([$emoji,$title]);
        clear_step($chat_id); send_msg($chat_id, '✅ دسته اضافه شد.', admin_shop_keyboard()); return;
    }
    if ($step === 'admin_add_coupon') {
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/', $text))));
        if (count($lines) < 3) { send_msg($chat_id, 'فرمت کافی نیست. کد، نوع، مقدار و حداکثر استفاده را خط‌به‌خط بفرست.', admin_shop_keyboard()); return; }
        $code=normalize_coupon_code($lines[0]); $type=strtolower($lines[1])==='fixed'?'fixed':'percent'; $value=max(0,(int)$lines[2]); $max=max(0,(int)($lines[3] ?? 0));
        if ($code==='' || $value<=0) { send_msg($chat_id, 'کد یا مقدار تخفیف معتبر نیست.', admin_shop_keyboard()); return; }
        db()->prepare('INSERT INTO coupons (code,type,value,max_uses) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE type=VALUES(type), value=VALUES(value), max_uses=VALUES(max_uses), is_active=1')->execute([$code,$type,$value,$max]);
        clear_step($chat_id); send_msg($chat_id, "✅ کد تخفیف <code>{$code}</code> ذخیره شد.", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_add_product') {
        $lines = array_map('trim', preg_split('/\R/', $text));
        $lines = array_values(array_filter($lines, fn($v)=>$v!==''));
        if (count($lines) < 6) { send_msg($chat_id, 'فرمت محصول کامل نیست. حداقل ۶ خط لازم است.', admin_shop_keyboard()); return; }
        $name=$lines[0]; $price=max(0,(int)preg_replace('/\D/','',$lines[1])); $catId=find_or_create_category($lines[2]); $delivery=normalize_delivery_type($lines[3]);
        $commission='none'; $commissionValue=0; $c=strtolower($lines[4]);
        if (str_starts_with($c,'fixed:')) { $commission='fixed'; $commissionValue=max(0,(int)preg_replace('/\D/','',substr($c,6))); }
        elseif (str_starts_with($c,'percent:')) { $commission='percent'; $commissionValue=max(0,min(100,(int)preg_replace('/\D/','',substr($c,8)))); }
        $short=$lines[5]; $full=$lines[6] ?? $short;
        db()->prepare('INSERT INTO products (category_id,name,price,short_description,full_description,delivery_type,commission_type,commission_value) VALUES (?,?,?,?,?,?,?,?)')->execute([$catId,$name,$price,$short,$full,$delivery,$commission,$commissionValue]);
        clear_step($chat_id); send_msg($chat_id, "✅ محصول اضافه شد.\nنام: <b>".h($name)."</b>\nقیمت: <b>".money($price)."</b>", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_deliver_order') {
        $oid=(int)$user['step_payload'];
        $order=deliver_order($oid, $text);
        clear_step($chat_id);
        if (!$order) { send_msg($chat_id, 'سفارش پیدا نشد.', admin_shop_keyboard()); return; }
        send_msg($order['telegram_id'], "📦 سفارش شما تحویل داده شد.\nسفارش: <code>#{$oid}</code>\nمحصول: <b>".h($order['product_name'])."</b>\n\nاطلاعات تحویل:\n<code>".h($text)."</code>", main_menu_keyboard(is_admin($order['telegram_id'])));
        send_msg($chat_id, "✅ سفارش #{$oid} تحویل شد.\nپورسانت معرف: <b>".money($order['referrer_reward_amount'])."</b>", admin_shop_keyboard()); return;
    }
    if ($step === 'admin_payment_instructions') {
        set_setting('payment_instructions', $text);
        clear_step($chat_id); send_msg($chat_id, '✅ متن پرداخت ذخیره شد.', admin_shop_keyboard()); return;
    }

    if ($step === 'admin_broadcast') {
        clear_step($chat_id);
        $ids = db()->query('SELECT telegram_id FROM users')->fetchAll(PDO::FETCH_COLUMN);
        $sent=0;
        foreach ($ids as $tid) { tg('sendMessage', ['chat_id'=>$tid, 'text'=>$text, 'parse_mode'=>'HTML', 'disable_web_page_preview'=>true]); $sent++; usleep(45000); }
        send_msg($chat_id, "✅ پیام همگانی ارسال شد.\nتعداد: <b>{$sent}</b>", admin_keyboard()); return;
    }
    if ($step === 'admin_set_setting') {
        $key = (string)$user['step_payload'];
        if ($key === 'theme_color') {
            $color = validate_theme_color($text);
            if (!$color) { send_msg($chat_id, 'رنگ معتبر نیست. مثال: <code>#1d9bf0</code>', admin_keyboard()); return; }
            set_setting('theme_color', $color); clear_step($chat_id); send_msg($chat_id, "✅ رنگ ثبت شد: <code>{$color}</code>", admin_keyboard()); return;
        }
        if (str_starts_with($key, 'mission_')) {
            $parts = preg_split('/\s+/', $text);
            if (count($parts) < 2) { send_msg($chat_id, 'هدف و پاداش را با فاصله بفرست. مثال: <code>3 10000</code>', admin_keyboard()); return; }
            $idx = substr($key, -1); set_setting("mission_{$idx}_target", max(0, (int)$parts[0])); set_setting("mission_{$idx}_reward", max(0, (int)$parts[1]));
            clear_step($chat_id); send_msg($chat_id, '✅ مأموریت ذخیره شد.', admin_keyboard()); return;
        }
        $map = ['start_reward'=>'start_reward','min_withdraw'=>'min_withdraw','purchase_reward'=>'purchase_reward','spin_referrals_per_chance'=>'spin_referrals_per_chance','custom_code_min_referrals'=>'custom_code_min_referrals'];
        if (!isset($map[$key])) { clear_step($chat_id); send_msg($chat_id, 'تنظیم ناشناخته بود.', admin_keyboard()); return; }
        set_setting($map[$key], max(0, (int)$text)); clear_step($chat_id); send_msg($chat_id, '✅ تنظیمات ذخیره شد.', admin_keyboard()); return;
    }

    clear_step($chat_id);
    send_msg($chat_id, 'مرحله ناشناخته بود؛ به منوی اصلی برگشتیم.', main_menu_keyboard(is_admin($chat_id)));
}
