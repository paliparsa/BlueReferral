# BlueReferral — Referral Wallet + Shop + Mini App

ربات همکاری در فروش، کیف پول، فروشگاه دستی و Mini App مدرن تلگرام با نصب تعاملی روی سرور.

این نسخه برای ریپوی `paliparsa/BlueReferral` آماده شده و تمرکز اصلی‌اش این است که نصب و مدیریت پروژه از حالت «یک اسکریپت خطی و شکننده» خارج شود. حالا با یک منوی نصب می‌توانی هر مرحله را جدا اجرا کنی، اگر خطا خوردی برگردی همان مرحله را دوباره بزنی، و بعد از نصب با دستور دائمی `blue-ref` دوباره پنل مدیریت نصب را باز کنی.

---

## امکانات ربات

### فروشگاه دستی جدید

- 🛒 فروشگاه کامل داخل بات و Mini App
- 📂 دسته‌بندی محصول
- ➕ افزودن محصول دستی توسط ادمین
- 📦 نوع تحویل: دستی، اکانت/ایمیل‌پسورد، لینک ساب VPN، کد/گیفت/لایسنس، فایل/متن
- 🧾 فاکتور خودکار برای هر سفارش
- 📤 ارسال رسید پرداخت توسط کاربر؛ متن یا عکس رسید داخل بات، متن رسید داخل Mini App
- ✅ تایید پرداخت، رد سفارش و تحویل دستی توسط ادمین
- 🎁 پورسانت خرید برای معرف به صورت درصدی یا مبلغ ثابت برای هر محصول
- 🎟 کد تخفیف درصدی یا مبلغ ثابت
- 💳 متن پرداخت قابل تغییر از پنل ادمین

### سمت کاربر

- 🛒 فروشگاه
- 🧾 سفارش‌های من
- 👥 لینک دعوت اختصاصی
- 💰 کیف پول تومانی
- 📊 آمار زیرمجموعه‌ها
- 🏆 لیدربورد
- 🎯 مأموریت روزانه
- 🎡 گردونه شانس
- 🔥 کد دعوت اختصاصی
- 🏧 درخواست برداشت
- 📣 ابزار تبلیغ با متن آماده
- 🚀 Mini App داخل تلگرام

### سمت ادمین

- ⚙️ پنل ادمین دکمه‌ای
- 🛒 مدیریت فروشگاه، محصولات، دسته‌ها، سفارش‌ها و کد تخفیف
- 📈 آمار کلی کاربران، موجودی و دعوت‌ها
- 🏧 مدیریت برداشت‌ها
- 💸 تغییر موجودی کاربر
- 🎁 ثبت پاداش خرید برای معرف
- ⚙️ تغییر پاداش‌ها بدون ویرایش کد
- 🎨 تغییر رنگ اصلی Mini App
- 📢 پیام همگانی
- 🏆 لیدربورد ادمین

### Mini App

- طراحی دارک، شیشه‌ای و مدرن
- رنگ پیش‌فرض آبی BlueGate
- امکان تغییر رنگ اصلی از پنل ادمین
- امکان تغییر رنگ محلی توسط کاربر
- نمایش فروشگاه، محصولات، سفارش‌ها، کیف پول، VIP، مأموریت‌ها، لینک دعوت و لیدربورد
- ثبت برداشت، گردونه و کد اختصاصی داخل Mini App
- اعتبارسنجی Telegram WebApp `initData`

---

## فرمت افزودن محصول از پنل ادمین

از پنل ادمین برو به:

```text
⚙️ پنل ادمین → 🛒 فروشگاه → ➕ افزودن محصول
```

بعد اطلاعات محصول را خط‌به‌خط بفرست:

```text
Spotify Family 1 Month
600000
موزیک
account
percent:10
اشتراک یک ماهه اسپاتیفای فمیلی
بعد از تایید پرداخت، ایمیل و پسورد یا لینک دعوت فمیلی به صورت دستی ارسال می‌شود.
```

نوع تحویل‌ها:

```text
manual   تحویل دستی
account  اکانت / ایمیل و پسورد
vpn      لینک ساب VPN
code     کد / گیفت / لایسنس
file     فایل یا متن آماده
```

پورسانت محصول:

```text
none
fixed:20000
percent:10
```

## جریان سفارش

```text
کاربر محصول را انتخاب می‌کند
↓
فاکتور ساخته می‌شود
↓
کاربر رسید پرداخت می‌فرستد
↓
ادمین پرداخت را تایید یا رد می‌کند
↓
ادمین اطلاعات تحویل را دستی ارسال می‌کند
↓
اگر خریدار معرف داشته باشد، پورسانت محصول به کیف پول معرف اضافه می‌شود
```

---

## نصب یک‌خطی

روی Ubuntu/Debian با دسترسی root اجرا کن:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueReferral/main/install.sh)
```

بعد از اجرا، منوی نصب باز می‌شود.

گزینه پیشنهادی برای نصب کامل:

```text
1) Full install / reinstall recommended path
```

این گزینه مرحله‌به‌مرحله این کارها را انجام می‌دهد:

1. نصب/تعمیر دستور دائمی `blue-ref`
2. گرفتن اطلاعات اولیه مثل دامنه، توکن ربات، ادمین‌ها و رنگ Mini App
3. نصب پکیج‌ها: Nginx, PHP, MariaDB, Certbot و...
4. کلون یا آپدیت پروژه از GitHub
5. ساخت `config.php`
6. ساخت دیتابیس و یوزر دیتابیس
7. تنظیم Nginx
8. گرفتن SSL با Certbot
9. اجرای migration دیتابیس
10. تنظیم Webhook ربات تلگرام

---

## دستور دائمی مدیریت نصب

بعد از اجرای نصب کامل، دستور زیر روی سرور ساخته می‌شود:

```bash
blue-ref
```

از این به بعد هر وقت خواستی نصب را ادامه بدهی، مرحله‌ای را تعمیر کنی، وبهوک را دوباره ست کنی، SSL بگیری، آپدیت بزنی یا وضعیت را ببینی، فقط بزن:

```bash
sudo blue-ref
```

یا اگر با root وارد شدی:

```bash
blue-ref
```

---

## منوی نصب و مدیریت

داخل `blue-ref` این گزینه‌ها را داری:

```text
1) Full install / reinstall recommended path
2) Setup wizard only: domain, token, database, theme
3) Install/repair system packages
4) Clone/update GitHub repository
5) Generate/repair config.php
6) Create/update database user and DB
7) Configure nginx
8) Request/repair SSL certificate
9) Run database migrations
10) Set Telegram webhook
11) Install/repair blue-ref command
12) Update project from GitHub
13) Status / diagnostics
14) Remove app files only
0) Exit
```

اگر وسط نصب از SSH پرت شدی یا یک مرحله خطا داد، دوباره وارد SSH شو و بزن:

```bash
sudo blue-ref
```

بعد همان مرحله‌ای که خطا داده را انتخاب کن. لازم نیست کل نصب را از اول بزنی.

---

## لاگ نصب

همه خروجی‌های نصب اینجا ذخیره می‌شود:

```text
/var/log/blue-ref-install.log
```

برای دیدن خطاهای آخر:

```bash
tail -n 100 /var/log/blue-ref-install.log
```

---

## تنظیمات ذخیره‌شده نصب

اطلاعاتی مثل دامنه، مسیر نصب، دیتابیس و توکن ربات بعد از ویزارد اینجا ذخیره می‌شود:

```text
/etc/blue-ref.env
```

سطح دسترسی این فایل محدود است. این فایل را عمومی نکن چون شامل توکن و پسورد دیتابیس است.

---

## نصب دستی از داخل ریپو

```bash
git clone https://github.com/paliparsa/BlueReferral.git
cd BlueReferral
sudo bash install.sh
```

یا نصب کامل بدون باز کردن منوی اصلی:

```bash
sudo bash install.sh --full
```

گزینه‌های سریع:

```bash
sudo bash install.sh --status
sudo bash install.sh --webhook
sudo bash install.sh --update
sudo bash install.sh --install-command
```

---

## آپدیت پروژه

روش پیشنهادی:

```bash
sudo blue-ref
```

بعد گزینه زیر را بزن:

```text
12) Update project from GitHub
```

یا مستقیم:

```bash
sudo blue-ref --update
```

یا از داخل پوشه پروژه:

```bash
sudo bash update.sh
```

---

## مسیرهای مهم

فرض کن دامنه تو `ref.example.com` باشد:

```text
https://ref.example.com/bot.php?secret=YOUR_WEBHOOK_SECRET
https://ref.example.com/miniapp/
https://ref.example.com/setwebhook.php?secret=YOUR_WEBHOOK_SECRET
```

فایل‌های حساس بیرون از `public/` هستند و `config.php` داخل GitHub آپلود نمی‌شود.

---

## تنظیم Mini App در BotFather

در BotFather:

1. `/mybots`
2. ربات را انتخاب کن
3. `Bot Settings`
4. `Menu Button`
5. `Configure menu button`
6. URL را بگذار:

```text
https://YOUR_DOMAIN/miniapp/
```

برای Mini App رسمی‌تر هم می‌توانی از `/newapp` استفاده کنی و همین URL را بدهی.

---

## ساختار پروژه

```text
BlueReferral/
├── app/
│   ├── bootstrap.php
│   └── bot_logic.php
├── public/
│   ├── bot.php
│   ├── api.php
│   ├── install.php
│   ├── setwebhook.php
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

---

## رفع خطاهای رایج

### اگر نصب پکیج‌ها گیر کرد

```bash
ps aux | grep -E "apt|dpkg|install.sh|systemctl" | grep -v grep
```

اگر پروسه‌ای گیر کرده بود و مطمئن بودی باید متوقف شود:

```bash
sudo pkill -f install.sh
sudo pkill apt
sudo pkill dpkg
sudo dpkg --configure -a
sudo apt --fix-broken install -y
```

بعد:

```bash
sudo blue-ref
```

و همان مرحله را دوباره اجرا کن.

### اگر SSL خطا داد

اول مطمئن شو DNS دامنه به IP سرور وصل است، بعد:

```bash
sudo blue-ref
```

گزینه:

```text
8) Request/repair SSL certificate
```

### اگر ربات جواب نداد

Webhook را دوباره ست کن:

```bash
sudo blue-ref
```

گزینه:

```text
10) Set Telegram webhook
```

### اگر فقط وضعیت را می‌خواهی

```bash
sudo blue-ref --status
```

---

## نکات امنیتی

- `config.php`، `/etc/blue-ref.env` و لاگ‌ها را عمومی نکن.
- توکن ربات را داخل GitHub نگذار.
- Webhook با secret ست می‌شود.
- Mini App درخواست‌ها را با `initData` تلگرام بررسی می‌کند.
- دسترسی `config.php` بعد از نصب محدود می‌شود.

---

## پیشنهاد اجرای امن روی SSH

برای اینکه وسط نصب با قطع SSH به مشکل نخوری، بهتر است نصب را داخل `screen` یا `tmux` اجرا کنی:

```bash
apt install -y screen
screen -S blue-ref
bash <(curl -fsSL https://raw.githubusercontent.com/paliparsa/BlueReferral/main/install.sh)
```

اگر SSH قطع شد، برگرد و بزن:

```bash
screen -r blue-ref
```

---

## Commerce Plus Upgrade

این نسخه بدون تغییر نام پروژه، فروشگاه BlueReferral را حرفه‌ای‌تر می‌کند و روی نسخه‌های قبلی Migration امن دارد.

### امکانات جدید فروشگاه

- Product Variants / پلن‌های محصول: مثل 10GB، 20GB، سه‌ماهه، شش‌ماهه و غیره.
- Inventory دستی: ادمین می‌تواند ایمیل/پسورد، لینک ساب، کد گیفت یا هر متن آماده‌ای را به انبار اضافه کند.
- تحویل نیمه‌اتوماتیک از انبار: اگر موجودی آماده باشد، ادمین با یک دکمه سفارش را از انبار تحویل می‌دهد.
- تایم‌لاین سفارش: کاربر و ادمین مراحل سفارش را می‌بینند.
- وضعیت‌های حرفه‌ای سفارش:
  - در انتظار پرداخت
  - رسید ارسال شده
  - در حال بررسی
  - پرداخت تایید شد
  - در حال آماده‌سازی
  - تحویل داده شد
  - رد / لغو / مرجوع
- یادداشت داخلی ادمین برای هر سفارش.
- جستجوی سفارش با شماره سفارش، آیدی تلگرام، username یا نام محصول.
- گزارش فروش روزانه/ماهانه و محصولات پرفروش.
- سطح مشتری بر اساس خریدهای تحویل‌شده.
- عکس محصول و کارت‌های بهتر در Mini App.
- Admin Mini Panel پایه داخل Mini App برای گزارش سریع فروش.

### فرمت افزودن محصول از پنل ادمین بات

از مسیر `⚙️ پنل ادمین` → `🛒 مدیریت فروشگاه` → `➕ افزودن محصول`:

```text
نام محصول
قیمت تومان
دسته‌بندی یا ID دسته
نوع تحویل: manual/account/vpn/code/file
پورسانت: none یا fixed:20000 یا percent:10
عکس محصول یا -
مدت روزانه یا 0
توضیح کوتاه
توضیح کامل اختیاری
```

مثال:

```text
VPN Tunnel
150000
VPN
vpn
percent:10
-
30
لینک ساب ۳۰ روزه
بعد از تایید پرداخت، لینک ساب دستی یا از انبار ارسال می‌شود.
```

### افزودن پلن / Variant

از مسیر `🛒 مدیریت فروشگاه` → `🧩 پلن/Variant` یا از لیست محصولات روی `🧩 پلن #ID` بزن.

فرمت دستی عمومی:

```text
ID محصول
نام پلن
قیمت تومان
مدت روزانه یا 0
```

مثال:

```text
12
20GB - 30 روزه
300000
30
```

### افزودن انبار دستی

از مسیر `🛒 مدیریت فروشگاه` → `📥 انبار دستی` → `➕ افزودن آیتم انبار`:

```text
ID محصول یا ID محصول:ID پلن
آیتم اول
آیتم دوم
آیتم سوم
```

مثال برای اکانت:

```text
8
Email: user1@mail.com
Password: pass1
Note: رمز را تغییر ندهید.
---
Email: user2@mail.com
Password: pass2
Note: رمز را تغییر ندهید.
```

مثال برای پلن خاص:

```text
12:3
https://sub.example.com/user1
https://sub.example.com/user2
```

> هر خط به عنوان یک آیتم جدا ذخیره می‌شود. اگر می‌خواهید ایمیل/پسورد چندخطی باشد، آن را در یک خط با `|` یا `;` جدا کنید.

### آپدیت روی VPS

بعد از push کردن این نسخه روی GitHub:

```bash
sudo blue-ref
```

بعد به ترتیب:

```text
Update project from GitHub
Run database migration
Set Telegram webhook
Status / diagnostics
```

اگر Git به خاطر تغییرات محلی خطا داد:

```bash
cd /var/www/bluereferral
sudo cp config.php /root/blue-ref-config-backup.php 2>/dev/null || true
sudo git reset --hard HEAD
sudo git pull origin main
sudo blue-ref
```

