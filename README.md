# BlueReferral — BlueGate Referral Wallet Ultra

ربات همکاری در فروش و کیف پول BlueGate با رابط کاملاً دکمه‌ای + Mini App مدرن تلگرام.

این نسخه برای GitHub آماده شده و ساختار پروژه طوری است که فایل‌های حساس بیرون از `public/` می‌مانند. کاربر و ادمین تقریباً بدون کامند کار می‌کنند؛ فقط `/start` برای ورود اولیه تلگرام استفاده می‌شود و بعد از آن همه‌چیز با دکمه، Inline Button و Mini App انجام می‌شود.

## امکانات اصلی

### سمت کاربر

- 👥 لینک دعوت اختصاصی
- 💰 کیف پول تومانی
- 📊 آمار زیرمجموعه‌ها
- 🏆 لیدربورد
- 🎯 مأموریت روزانه
- 🎡 گردونه شانس
- 🔥 کد دعوت اختصاصی
- 🏧 درخواست برداشت
- 📣 متن آماده تبلیغ
- 🚀 Mini App مدرن داخل تلگرام

### سمت ادمین

- ⚙️ پنل ادمین کاملاً دکمه‌ای
- 📈 آمار کل کاربران، موجودی‌ها و دعوت‌ها
- 🏧 مدیریت برداشت‌ها با دکمه پرداخت/رد
- 💸 تغییر موجودی کاربر
- 🎁 ثبت پاداش خرید برای معرف خریدار
- ⚙️ تنظیم پاداش‌ها بدون ویرایش کد
- 🎨 تغییر رنگ اصلی Mini App
- 📢 پیام همگانی
- 🏆 لیدربورد ادمین

### Mini App

- طراحی مدرن شیشه‌ای، دارک و آبی
- قابلیت تغییر رنگ محلی توسط کاربر
- قابلیت تغییر رنگ پیش‌فرض از پنل ادمین
- نمایش کیف پول، VIP، مأموریت‌ها، لینک دعوت و لیدربورد
- ثبت برداشت از داخل Mini App
- چرخاندن گردونه از داخل Mini App
- ثبت کد دعوت اختصاصی از داخل Mini App
- اعتبارسنجی Telegram WebApp `initData`

## پیش‌نیازها

سرور Ubuntu/Debian با دسترسی root:

- Nginx
- PHP 8.1+
- MariaDB/MySQL
- دامنه وصل‌شده به سرور
- SSL فعال
- Bot Token از BotFather

اسکریپت نصب، پکیج‌های لازم را نصب می‌کند.

## نصب یک‌خطی روی سرور

برای ریپوی فعلی `paliparsa/BlueReferral` نصب یک‌خطی به این شکل است:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueReferral/main/install.sh)
```

اسکریپت ازت این موارد را می‌پرسد:

- دامنه، مثل `ref.bluegate.example`
- توکن ربات تلگرام
- یوزرنیم ربات بدون `@`
- آیدی عددی ادمین یا ادمین‌ها
- یوزرنیم پشتیبانی
- مسیر نصب

بعد از نصب، خودش این کارها را انجام می‌دهد:

- نصب Nginx / PHP / MariaDB
- ساخت دیتابیس و یوزر دیتابیس
- ساخت `config.php`
- اجرای migration دیتابیس
- ساخت کانفیگ Nginx
- گرفتن SSL با Certbot
- تنظیم Webhook ربات

## نصب دستی

```bash
git clone https://github.com/paliparsa/BlueReferral.git
cd BlueReferral
cp config.example.php config.php
nano config.php
```

بعد دیتابیس بساز:

```sql
CREATE DATABASE bluegate_referral CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bluegate_user'@'localhost' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON bluegate_referral.* TO 'bluegate_user'@'localhost';
FLUSH PRIVILEGES;
```

سپس:

```bash
php public/install.php
```

Webhook:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://YOUR_DOMAIN/bot.php?secret=YOUR_WEBHOOK_SECRET" \
  -d 'allowed_updates=["message","callback_query"]'
```

## تنظیم Mini App در BotFather

در BotFather این کارها را انجام بده:

1. `/mybots`
2. انتخاب ربات
3. `Bot Settings`
4. `Menu Button`
5. `Configure menu button`
6. URL را بگذار:

```text
https://YOUR_DOMAIN/miniapp/
```

برای Mini App کامل‌تر هم می‌توانی از بخش `BotFather > /newapp` استفاده کنی و همین URL را بدهی.

## تنظیمات مهم در `config.php`

```php
$BOT_TOKEN = '...';
$BOT_USERNAME = 'BlueGateBot';
$ADMIN_IDS = [123456789];
$SUPPORT_USERNAME = 'BlueGateSupport';
$PUBLIC_BASE_URL = 'https://YOUR_DOMAIN';
$WEBHOOK_SECRET = 'random-secret';
$MINIAPP_URL = 'https://YOUR_DOMAIN/miniapp/';
```

پاداش‌ها:

```php
$START_REWARD = 2000;
$MIN_WITHDRAW = 50000;
$PURCHASE_REWARD = 10000;
```

عضویت اجباری در کانال:

```php
$FORCE_JOIN_CHANNEL = '@BllueGate';
```

اگر خالی باشد، عضویت اجباری خاموش است.

## ساختار پروژه

```text
BlueReferral/
├── app/
│   ├── bootstrap.php      # دیتابیس، تنظیمات، تلگرام، helperها
│   └── bot_logic.php      # منطق ربات و callbackها
├── public/
│   ├── bot.php            # webhook endpoint
│   ├── api.php            # API مربوط به Mini App
│   ├── install.php        # اجرای migration
│   ├── setwebhook.php     # تنظیم webhook با secret
│   └── miniapp/
│       ├── index.html
│       ├── style.css
│       └── app.js
├── schema.sql
├── config.example.php
├── install.sh
├── update.sh
├── uninstall.sh
└── README.md
```

## آپدیت پروژه

روی سرور:

```bash
sudo APP_DIR=/var/www/bluegate-referral-wallet bash update.sh
```

یا اگر داخل مسیر نصب هستی:

```bash
sudo bash update.sh
```

## نکته امنیتی

- فایل `config.php` را به GitHub آپلود نکن؛ داخل `.gitignore` گذاشته شده.
- ربات فقط endpoint زیر را با secret قبول می‌کند:

```text
https://YOUR_DOMAIN/bot.php?secret=YOUR_WEBHOOK_SECRET
```

- Mini App درخواست‌ها را با `initData` تلگرام بررسی می‌کند.
- دیتابیس و تنظیمات حساس داخل `public/` نیستند.

## مسیرهای مهم

```text
https://YOUR_DOMAIN/bot.php?secret=YOUR_WEBHOOK_SECRET
https://YOUR_DOMAIN/miniapp/
https://YOUR_DOMAIN/setwebhook.php?secret=YOUR_WEBHOOK_SECRET
```

## تست سریع بعد از نصب

1. ربات را در تلگرام باز کن.
2. فقط `/start` را بزن.
3. بعد از آن همه چیز با دکمه‌هاست.
4. دکمه Mini App را بزن.
5. از پنل ادمین، رنگ Mini App و پاداش‌ها را تغییر بده.

## مهاجرت از نسخه PRO قبلی

اگر نسخه قبلی همین پروژه را داشتی، دیتابیس را نگه دار و فقط فایل‌های جدید را جایگزین کن. سپس اجرا کن:

```bash
php public/install.php
```

Migration ستون‌های جدید مثل `step_payload`، `theme_color` و جدول‌های لازم را اضافه می‌کند.

## شخصی‌سازی رنگ‌ها

رنگ پیش‌فرض Mini App از پنل ادمین قابل تغییر است. کاربر هم داخل Mini App می‌تواند رنگ را برای خودش عوض کند؛ این تغییر محلی در مرورگر تلگرام ذخیره می‌شود.

رنگ‌ها با CSS Variable کنترل می‌شوند:

```css
--accent: #1d9bf0;
```

