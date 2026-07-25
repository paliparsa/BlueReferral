<?php
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');

// If domain is Telegram Bot domain, route to Telegram MiniApp:
if (str_contains($host, 'bot.p1store.store')) {
    header('Location: /miniapp/', true, 302);
    exit;
}

// Otherwise (blluegatestore.online and all web browsers), route to Dedicated Web Storefront:
header('Location: /web/', true, 302);
exit;
