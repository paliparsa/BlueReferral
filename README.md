# BlueReferral – Manual Crypto TXID build

> وضعیت فعلی پرداخت رمزارز: SwapWallet کنار گذاشته شده و پرداخت رمزارز با **کیف پول دستی ادمین + ارسال TXID توسط کاربر + بررسی خودکار cron** انجام می‌شود. نرخ لحظه‌ای از نوبیتکس فقط توسط `public/cron_crypto.php` گرفته و cache می‌شود؛ Mini App و webhook هنگام باز شدن هیچ درخواست خارجی به نوبیتکس/Tron/Ton نمی‌زنند.

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


## Update: Admin Shop UX v2

این نسخه فروشگاه و پنل ادمین را بهبود می‌دهد:

- افزودن محصول به صورت مرحله‌ای داخل ربات: انتخاب دسته‌بندی → نام → قیمت → نوع تحویل → پورسانت → مدت → توضیح → عکس → ویژه/معمولی.
- افزودن دسته‌بندی به صورت مرحله‌ای: نام → ایموجی → عکس.
- افزودن پلن/Variant به صورت مرحله‌ای: انتخاب محصول → نام پلن → قیمت → مدت.
- افزودن انبار دستی به صورت مرحله‌ای: انتخاب محصول → انتخاب پلن یا بدون پلن → ارسال آیتم‌ها یکی‌یکی یا چند خطی → پایان.
- حذف/غیرفعال‌سازی امن محصول بدون پاک شدن سفارش‌های قبلی.
- حذف/غیرفعال‌سازی دسته‌بندی.
- حذف آیتم‌های آماده انبار.
- حذف/غیرفعال‌سازی پلن‌ها.
- افزودن یا حذف عکس محصول و دسته‌بندی از داخل بات؛ ادمین می‌تواند عکس را آپلود کند یا لینک عکس بفرستد.
- Mini App کاربر به صفحه فروشگاهی مدرن‌تر شبیه مارکت‌های موبایلی تبدیل شده است.
- Mini Panel ادمین از Mini App کاربر جدا شده و با `?admin=1` باز می‌شود.

بعد از آپدیت روی VPS حتماً این مراحل را بزن:

```bash
sudo blue-ref
```

سپس:

1. Update project from GitHub
2. Run database migration
3. Set Telegram webhook
4. Status / diagnostics

برای اینکه آپلود عکس داخل بات درست کار کند، مقدار `PUBLIC_BASE_URL` در `config.php` باید دامنه HTTPS واقعی پروژه باشد.

## تغییرات نسخه AdminShop UI/CRUD

این نسخه روی ساختار قبلی BlueReferral ساخته شده و برای خراب نشدن داده‌های قبلی، حذف کامل بعضی موجودیت‌ها محافظت‌شده است:

- محصول اگر سفارش ثبت‌شده داشته باشد، حذف کامل نمی‌شود و باید غیرفعال شود تا سوابق سفارش‌ها حفظ شود.
- پلن اگر در سفارش استفاده شده باشد، حذف کامل نمی‌شود و باید غیرفعال شود.
- دسته‌بندی در حذف کامل، محصولاتش بدون دسته می‌شوند.

### امکانات اضافه‌شده

- صفحه اول Mini App به پروفایل، کیف پول و لینک دعوت تبدیل شد.
- فروشگاه Mini App با دسته‌بندی افقی، کارت محصول، جستجو و رنگ‌بندی زنده‌تر بازطراحی شد.
- تنظیم رنگ کاربر در Mini App برگشت و رنگ محلی روی همان گوشی ذخیره می‌شود.
- پنل ادمین Mini App مستقل‌تر شد و بخش‌های محصولات، دسته‌بندی‌ها، پلن‌ها، انبار، سفارش‌ها و تنظیمات دارد.
- ادمین در Mini App می‌تواند محصول، دسته، پلن و آیتم انبار را اضافه، ویرایش کامل، غیرفعال یا حذف کامل کند.
- ادمین داخل ربات هم برای محصول، دسته، پلن و انبار منوی مدیریت و ویرایش جزءبه‌جزء دارد.
- دکمه‌های اصلی ربات به Reply Keyboard منتقل شدند تا همیشه پایین صفحه تلگرام دیده شوند.
- رنگ دکمه‌های Mini App از پنل ادمین قابل تنظیم است.

> نکته: خود دکمه‌های Reply Keyboard تلگرام رنگ اختصاصی هر دکمه را از بات نمی‌پذیرند و رنگشان به تم کلاینت تلگرام بستگی دارد. تنظیم رنگ دکمه‌ها در این نسخه روی Mini App و دکمه‌های داخل WebApp اعمال می‌شود.

### بعد از آپدیت روی VPS

```bash
sudo blue-ref
```

سپس به ترتیب اجرا کن:

```text
Update project from GitHub
Run database migration
Set Telegram webhook
Status / diagnostics
```

## Update: AuthNote UI

این نسخه چند اصلاح کوچک و مهم دارد:

- دکمه Mini App از Reply Keyboard حذف شده و فقط به صورت دکمه امن WebApp زیر پیام صفحه اول نمایش داده می‌شود.
- در همه برگشت‌ها به صفحه اصلی، دکمه Mini App زیر همان پیام قرار می‌گیرد.
- احراز شماره موبایل با Share Contact به صورت اختیاری/اجباری از تنظیمات ادمین قابل کنترل است.
- اعلان عضو جدید فقط یک بار برای هر کاربر ارسال می‌شود.
- مشتری بعد از ارسال رسید، همیشه می‌تواند برای سفارش یادداشت/اطلاعات اکانت مثل ایمیل، رمز یا یوزرنیم ثبت کند.
- توضیحات کامل محصول در Mini App با خط جدید و فاصله مناسب نمایش داده می‌شود.
- UI مینی‌اپ با انیمیشن‌ها، کارت‌های زنده‌تر، ریسپانسیو بهتر و صفحه محصول تمیزتر ارتقا داده شد.

بعد از آپدیت روی VPS، مثل همیشه Migration را اجرا کنید:

```bash
sudo blue-ref
```

سپس:

1. Update project from GitHub
2. Run database migration
3. Set Telegram webhook
4. Status / diagnostics

## Order Cleanup & Better Orders UI

این نسخه بخش سفارش‌ها را خلوت‌تر و قابل‌مدیریت‌تر می‌کند:

- ادمین می‌تواند سفارش‌های `رد شده`، `لغو شده` و `مرجوع شده` را به صورت تکی کامل حذف کند.
- ادمین می‌تواند همه سفارش‌های لغو/رد/مرجوع را گروهی حذف کند.
- گزینه‌های پاکسازی قدیمی‌تر از ۷ روز و ۳۰ روز اضافه شده‌اند.
- ادمین می‌تواند سفارش‌ها را آرشیو کند تا از لیست اصلی خارج شوند.
- کاربر می‌تواند سفارش‌های لغو/رد شده خودش را فقط از دید خودش مخفی کند؛ سوابق برای ادمین باقی می‌ماند.
- کاربر می‌تواند همه سفارش‌های لغو/رد شده خودش را یکجا از لیست خودش پاکسازی کند.
- صفحه سفارش‌های Mini App به شکل لیست کارت‌های خلاصه بازطراحی شده است.
- با لمس هر سفارش، صفحه جزئیات جداگانه با تایم‌لاین، رسید، یادداشت، تحویل و دکمه‌های مربوطه نمایش داده می‌شود.
- فیلتر وضعیت سفارش‌ها در Mini App اضافه شده است.

بعد از آپدیت، حتماً از منوی `blue-ref` گزینه `Run database migration` را اجرا کنید تا ستون‌های جدید `user_hidden` و `archived_at` به جدول سفارش‌ها اضافه شوند.

## Order Mini App Fix

این نسخه دو باگ رفتاری در Mini App را اصلاح می‌کند:

- کلیک روی کارت سفارش در بخش سفارش‌های کاربر حالا صفحه جزئیات جداگانه را باز می‌کند.
- دیالوگ‌های ورودی Mini App، از جمله تحویل سفارش توسط ادمین، دیگر callback را قبل از اجرا پاک نمی‌کنند؛ بنابراین تحویل دستی از Mini Panel ثبت می‌شود و پیام تحویل برای کاربر ارسال می‌گردد.
- نمایش متن تحویل در صفحه جزئیات سفارش با حفظ خط‌های جدید بهتر شد.

بعد از آپدیت، فقط `Update project from GitHub` و `Set Telegram webhook` کافی است. Migration جدیدی لازم نیست، اما اجرای آن مشکلی ایجاد نمی‌کند.

## Wallet UX Update

این نسخه چند بهبود جدید دارد:

- موجودی کیف پول فقط برای برداشت نیست؛ کاربر می‌تواند آن را برای کاهش مبلغ فاکتور فروشگاه استفاده کند.
- در صفحه جزئیات سفارش دکمه «پرداخت از کیف پول» اضافه شده است.
- هنگام ثبت سفارش از صفحه محصول، اگر کاربر موجودی داشته باشد دکمه «خرید با کیف پول» هم نمایش داده می‌شود.
- اگر سفارش با کیف پول پرداخت شود و بعداً لغو/رد/مرجوع شود، مبلغ کیف پول به کاربر برگشت داده می‌شود.
- مأموریت‌های روزانه در Mini App به شکل کارت گرافیکی با progress bar نمایش داده می‌شوند.
- لینک دعوت دیگر به صورت خام نمایش داده نمی‌شود و فقط با دکمه کپی می‌شود.
- باگ پریدن کیبورد هنگام سرچ فروشگاه رفع شده است.
- محدودیت zoom و overflow برای جلوگیری از به‌هم‌ریختگی UI در موبایل اضافه شده است.

بعد از آپدیت روی VPS اجرای migration توصیه می‌شود چون ستون `wallet_amount` به جدول سفارش‌ها اضافه شده است.

## WalletUX v2 / Lucky Wheel

این نسخه چند بهبود روی کیف پول و Mini App اضافه می‌کند:

- فیکس اسکرول تک‌انگشتی داخل Telegram WebView
- جلوگیری از زوم/Pinch ناخواسته که باعث بیرون‌زدن UI می‌شد
- کوچک‌تر و جمع‌وجورتر شدن کارت‌ها، دکمه‌ها و بخش‌های Mini App
- جدا شدن کارت‌های مأموریت از هم و نمایش تمیزتر Progress Bar
- گردونه شانس واقعی داخل Mini App
- تنظیم جایزه‌های گردونه از Mini Panel ادمین

فرمت جایزه‌های گردونه در تنظیمات ادمین:

```text
عنوان جایزه|مبلغ کیف پول|وزن احتمال|اعلان ادمین ۰/۱
```

مثال:

```text
💰 ۵٬۰۰۰ تومان اعتبار|5000|30|0
💰 ۲۰٬۰۰۰ تومان اعتبار|20000|10|0
🎁 سرویس تست هدیه|0|5|1
```

اگر مبلغ `0` باشد، جایزه به کیف پول اضافه نمی‌شود و در صورت فعال بودن اعلان ادمین، برای ادمین پیام بررسی دستی ارسال می‌شود.


## Update: Mini App Scroll Hotfix
- Fixed Android Telegram Mini App scrolling issue where the page could stop scrolling.
- Removed global touch prevention from WebApp JS.
- Added CSS scroll-safety overrides for body/app containers while keeping compact UI and wheel features.

## Payment Methods Engine - Phase 1

این نسخه مرحله اول پرداخت چندروشی را اضافه می‌کند:

- کیف پول داخلی برای پرداخت سفارش داخل فروشگاه
- کارت‌به‌کارت چندحسابی با تنظیم از Mini App Admin
- پایه Telegram Stars با ارسال فاکتور Stars داخل چت تلگرام
- ذخیره روش پرداخت انتخاب‌شده روی سفارش
- تنظیم نرخ هر Star به تومان از پنل ادمین

### فایل‌های مهم این آپدیت

اگر از نسخه قبلی فقط می‌خواهید این آپدیت را اعمال کنید، این فایل‌ها تغییر کرده‌اند:

```text
app/bootstrap.php
app/bot_logic.php
public/api.php
public/miniapp/index.html
public/miniapp/style.css
public/miniapp/app.js
schema.sql
config.example.php
README.md
```

بعد از آپدیت روی سرور، حتماً از منوی `blue-ref` گزینه‌های زیر را اجرا کنید:

```text
Update project from GitHub
Run database migration
Set Telegram webhook
```

### فرمت کارت‌های پرداخت

در Mini App Admin > تنظیمات، هر کارت را در یک خط وارد کنید:

```text
عنوان کارت|شماره کارت|صاحب کارت|شبا
```

مثال:

```text
کارت اصلی|6037990000000000|BlueGate|IR000000000000000000000000
کارت دوم|5892000000000000|BlueGate|IR111111111111111111111111
```

### Telegram Stars

Telegram Stars در این مرحله به شکل پایه اضافه شده است. وقتی فعال باشد، کاربر روی سفارش دکمه پرداخت Stars می‌زند و ربات یک فاکتور Stars داخل چت برای او ارسال می‌کند. بعد از پرداخت موفق، سفارش خودکار به وضعیت «پرداخت تایید شد» می‌رود.


## Payment Phase 1 Fix

این نسخه فیکس مرحله اول پرداخت است:

- `payment_methods` به payload کاربر اضافه شد تا روش‌های پرداخت داخل Mini App نمایش داده شوند.
- تنظیمات پرداخت داخل Mini Panel ادمین به صورت کادرهای جدا و مرتب بازطراحی شد.
- کارت به کارت چندحسابی، کیف پول داخلی و Telegram Stars از تنظیمات قابل فعال/غیرفعال‌سازی هستند.
- اسکرول فروشگاه در Telegram WebView اصلاح شد تا ردیف‌های افقی جلوی اسکرول عمودی صفحه را نگیرند.
- کارت محصول اصلاح شد تا عکس محصول در کادر جدا باشد و نام/قیمت روی تصویر نیاید.

### فایل‌های تغییرکرده در این نسخه

```text
public/api.php
public/miniapp/index.html
public/miniapp/style.css
public/miniapp/app.js
README.md
```

Migration جدید لازم نیست اگر مرحله PaymentPhase1 را قبلاً migrate کرده‌ای. اگر نه، یک بار migration را اجرا کن.

---

## Payment Phase 2 — Crypto Payments

This version adds a second payment phase without changing the existing card, wallet, Stars, shop, referral, and order flows.

### What was added

- Crypto payment method inside the payment engine.
- Admin-configurable crypto wallets from the Mini App admin settings.
- User can choose a crypto wallet for an order.
- The bot/Mini App calculates the crypto amount from the Toman invoice.
- Price source can be Nobitex with manual fallback, or manual-only.
- User can submit TXID / Hash from Mini App or bot.
- Automatic checker verifies pending crypto payments.
- If Nobitex rate lookup fails, admins can be notified and manual fallback rates are used.

### Admin wallet format

Go to Mini App Admin → Settings → Payment Methods → Crypto Settings.

Each wallet line:

```text
Title|Network|Asset|Address|RateSymbol|Active 0/1|Sort
```

Examples:

```text
USDT TRC20|TRC20|USDT|TXXXXXXXXXXXXXXXXXXXXXXXXXXXX|USDT|1|1
TRX Wallet|TRX|TRX|TXXXXXXXXXXXXXXXXXXXXXXXXXXXX|TRX|1|2
TON Wallet|TON|TON|UQXXXXXXXXXXXXXXXXXXXXXXXXXXXX|TON|1|3
```

### Manual fallback rate format

```text
USDT|95000
TRX|12000
TON|320000
```

### Automatic crypto checker

The installer now has an extra menu option:

```bash
sudo blue-ref
```

Then choose:

```text
Install/repair crypto payment cron
```

This creates:

```text
/etc/cron.d/blue-ref-crypto
```

and runs the checker every minute:

```bash
php /var/www/bluereferral/public/cron_crypto.php
```

You can also run it manually:

```bash
sudo -u www-data php /var/www/bluereferral/public/cron_crypto.php
```

### Notes

- TRON/TRC20 checking uses TronScan API. A TronScan API key is optional but recommended for stable rate limits.
- TON checking uses Toncenter API. A Toncenter API key is optional but recommended.
- If automatic verification cannot confirm a transaction, the admin can still manually approve the order from the admin panel.

## Update: Payment Admin Form UX

این نسخه تنظیمات پرداخت را از حالت textarea خطی خارج می‌کند:

- کارت‌های کارت‌به‌کارت با دکمه «افزودن کارت جدید» و فرم جداگانه ثبت می‌شوند.
- کیف پول‌های رمزارز با دکمه «افزودن ولت جدید» و فیلدهای جداگانه ثبت می‌شوند.
- نرخ‌های دستی fallback با فرم جداگانه اضافه/ویرایش/حذف می‌شوند.
- پالت رنگ Mini App برای ادمین و کاربر به color picker مجهز شد.
- ذخیره کیف پول رمزارز دیگر باعث ساخت ردیف‌های تکراری برای ولت‌های موجود نمی‌شود؛ سیستم بر اساس شبکه + ارز + آدرس، رکورد موجود را به‌روزرسانی می‌کند.
- دریافت نرخ نوبیتکس کمی مقاوم‌تر شد و چند شکل پاسخ/نماد رایج را بررسی می‌کند.

فایل‌های تغییرکرده در این آپدیت:

```text
app/bootstrap.php
public/miniapp/index.html
public/miniapp/style.css
public/miniapp/app.js
README.md
```

Migration جدید لازم نیست.


## Patch: Crypto/Admin Mini App debug fix

This patch fixes a critical Mini App/admin issue after saving payment settings:

- Admin Mini Panel URL now appends `admin=1` safely even if `MINIAPP_URL` already contains query parameters.
- Mini App detects admin mode more robustly from URL/search/hash/start parameter.
- API now returns JSON errors instead of blank/fatal responses where possible.
- Crypto wallet saving is safer and will not silently wipe wallets if a broken/old UI submits an empty builder state.
- Nobitex rate fetching now uses shorter timeouts and a 5-minute cache to prevent the bot/webhook from hanging when the external API is slow.
- Mini App cache version was bumped.

## Update: SwapWallet Pay جایگزین کریپتوی TXID

در این نسخه پرداخت رمزارز مستقیم با TXID برای پرداخت‌های جدید کنار گذاشته شد و روش پیشنهادی `SwapWallet Pay` جایگزین شد.

### تنظیمات ادمین
از Mini Panel ادمین وارد Settings شوید و در کارت **SwapWallet Pay** این موارد را وارد کنید:

- API Key
- Application
- Base URL: پیش‌فرض `https://swapwallet.app/api`
- Auto Token: پیش‌فرض `USDT`
- نرخ ۱ USDT/USD به تومان
- درصد احتیاط نرخ
- زمان انقضای فاکتور

اگر API Key را خالی بگذارید، مقدار قبلی حفظ می‌شود.

### مسیر پرداخت کاربر
کاربر در صفحه سفارش روش **SwapWallet Pay** را انتخاب می‌کند. ربات یک invoice در SwapWallet می‌سازد و لینک پرداخت را داخل Mini App و چت نشان می‌دهد. وضعیت پرداخت با cron بررسی می‌شود و اگر وضعیت invoice برابر `PAID` شود، سفارش خودکار تایید می‌شود.

### Cron بررسی پرداخت
همان cron قبلی `public/cron_crypto.php` اکنون فقط invoiceهای SwapWallet را بررسی می‌کند و دیگر موقع لود Mini App یا پنل ادمین هیچ درخواست خارجی به نوبیتکس/Tron/Ton زده نمی‌شود.



## Debug Fix: SwapWallet + Speed

این نسخه چند فیکس مهم دارد:

- اجرای `migrate()` از مسیرهای webhook/API/cron حذف شد؛ فقط از `install.php` یا منوی `blue-ref` انجام می‌شود.
- مسیر Mini App دیگر موقع باز شدن به Nobitex، Tron یا TON درخواست نمی‌زند.
- نرخ پرداخت SwapWallet فقط از تنظیم دستی `SWAPPAY_USDT_RATE_TOMAN` / پنل ادمین خوانده می‌شود.
- اگر ساخت invoice سواپ‌ولت خطا بدهد، Mini App دیگر پیام موفقیت الکی نشان نمی‌دهد.
- پاسخ SwapWallet با چند ساختار مختلف parse می‌شود و `raw_response` داخل `swapwallet_invoices` ذخیره می‌شود.
- اگر لینک پرداخت ساخته شود، هم داخل Mini App نمایش داده می‌شود و هم با دکمه مستقیم برای کاربر در تلگرام ارسال می‌شود.

بعد از آپدیت، فقط یک بار migration را از `blue-ref` اجرا کن. اگر پنل کند بود، `grep -R "CryptoRate\|api.nobitex" app public` نباید خروجی فعال مرتبط با API بدهد.

## Update: SwapWallet v2 Temporary Wallet

This build updates SwapWallet Pay to the current SwapPay v2 flow:

- Create invoice via `POST /v2/payment/{username}/invoices/temporary-wallet`.
- Keep the old v1 path only as a final compatibility fallback.
- Rename the admin field concept from Application to **SwapWallet Username / Slug**.
- Store request URL, request body, API version, raw response, and callback payload for debugging.
- Add `public/swapwallet_callback.php` for SwapWallet payment callbacks.
- Keep rates manual to avoid Nobitex/Tron/Ton calls during Mini App load.

Admin settings needed:

- API Key: from SwapWallet panel.
- SwapWallet Username / Slug: the username/merchant slug used in `/v2/payment/{username}/...`.
- Base URL: `https://swapwallet.app/api`.
- Auto Token: usually `USDT`.
- USDT/USD to Toman rate: manual rate used to convert Toman invoices to USD.

If invoice creation fails, inspect:

```bash
sudo mysql -D YOUR_DB -e "SELECT id, order_id, status, fail_reason, request_url, LEFT(request_body,300) req, LEFT(raw_response,500) raw FROM swapwallet_invoices ORDER BY id DESC LIMIT 5;"
```

### SwapWallet V2 CronFix

`public/cron_crypto.php` now explicitly runs only the SwapWallet V2 temporary-wallet invoice checker. It does not run migrations and does not call legacy Nobitex / Tron / TON checks.

Health check:

```bash
curl "https://YOUR_DOMAIN/cron_crypto.php?secret=WEBHOOK_SECRET&health=1"
```

Manual run:

```bash
php /var/www/bluereferral/public/cron_crypto.php
```

## SwapWallet Final Debug Fix

این نسخه فقط مسیر SwapWallet را اصلاح و شفاف کرده است:

- ساخت invoice فقط با endpoint جدید `POST /v2/payment/{username}/invoices/temporary-wallet` انجام می‌شود.
- fallback قدیمی `v1/payment/{username}/invoice` حذف شد تا خطای واقعی پشت v1 گم نشود.
- اگر همه درخواست‌ها 404 شوند، خطا با پیام واضح `SWAPWALLET_USERNAME_NOT_FOUND_OR_SWAPPAY_INACTIVE` ذخیره می‌شود؛ یعنی مقدار Username/Slug درست نیست یا SwapPay برای آن حساب فعال نشده است.
- در Mini Panel ادمین دکمه `تست اتصال SwapWallet` اضافه شد.
- جزئیات HTTP، status code و body خطا در `raw_response` ذخیره می‌شود.
- هیچ درخواست Nobitex/Tron/Ton هنگام باز شدن Mini App اجرا نمی‌شود.

فایل‌های مهم این نسخه:

```text
app/bootstrap.php
public/api.php
public/miniapp/app.js
README.md
```

اگر بعد از این نسخه هم خطای 404 دیدی، مقدار `SwapWallet Username / Slug` باید از پشتیبانی SwapWallet گرفته شود؛ API Key به‌تنهایی کافی نیست.


## Manual Crypto Payments restored

این نسخه پرداخت رمزارز را از SwapWallet به ساختار کیف پول دستی + TXID برگردانده است.

- ادمین کیف پول‌ها را از Mini Panel اضافه می‌کند.
- کاربر کیف پول را انتخاب می‌کند، مبلغ رمزارز و آدرس را می‌بیند و TXID را می‌فرستد.
- `public/cron_crypto.php` دو حالت جدا دارد: `--check-payments` برای بررسی TXIDها و `--refresh-rates` برای رفرش نرخ نوبیتکس.
- Mini App و webhook هیچ درخواست مستقیم به Nobitex/Tron/Ton نمی‌زنند تا کند نشوند.

فایل cron پیشنهادی:

```bash
* * * * * php /var/www/bluereferral/public/cron_crypto.php --check-payments >/dev/null 2>&1
*/10 * * * * php /var/www/bluereferral/public/cron_crypto.php --refresh-rates >/dev/null 2>&1
```

## Crypto Live Rate Update

این نسخه پرداخت رمزارز دستی را با نرخ زنده‌ی cache شده بهبود می‌دهد:

- نرخ نوبیتکس فقط در `public/cron_crypto.php` یا با دکمه رفرش ادمین گرفته می‌شود تا Mini App و webhook کند نشوند.
- فاکتور رمزارز کاربر هنگام مشاهده‌ی صفحه سفارش هر ۶۰ ثانیه دوباره از API سبک `me` خوانده می‌شود و اگر هنوز TXID ثبت نشده باشد، مبلغ رمزارز با نرخ جدید آپدیت می‌شود.
- بعد از ثبت TXID مبلغ فاکتور فریز می‌شود تا کاربر با تغییر نرخ متضرر/سردرگم نشود.
- ادمین می‌تواند ولت‌ها/شبکه‌ها/ارزها را از Mini Panel اضافه، ویرایش، حذف یا غیرفعال کند.
- ادمین می‌تواند نرخ نوبیتکس/cache را داخل تنظیمات ببیند و با دکمه «رفرش نرخ از نوبیتکس» دستی آپدیت کند.
- در فاکتور رمزارز صریحاً نوشته می‌شود مبلغ نمایش‌داده‌شده باید دقیقاً به ولت برسد و کارمزد صرافی/شبکه بر عهده مشتری است.
- مبلغ و آدرس ولت هر دو دکمه کپی دارند.

Cron پیشنهادی:

```cron
* * * * * php /var/www/bluereferral/public/cron_crypto.php --check-payments >/dev/null 2>&1
*/10 * * * * php /var/www/bluereferral/public/cron_crypto.php --refresh-rates >/dev/null 2>&1
```

فایل‌های تغییر کرده در این نسخه:

```text
app/bootstrap.php
public/api.php
public/cron_crypto.php
public/miniapp/app.js
public/miniapp/style.css
schema.sql
README.md
```


## Split Crypto Cron

در این نسخه cron رمزارز از هم جدا شد تا تایید پرداخت‌ها سریع بماند ولی نرخ نوبیتکس کمتر refresh شود:

```cron
# بررسی TXIDهای ثبت‌شده هر ۱ دقیقه
* * * * * php /var/www/bluereferral/public/cron_crypto.php --check-payments >/dev/null 2>&1

# رفرش نرخ نوبیتکس هر ۱۰ دقیقه
*/10 * * * * php /var/www/bluereferral/public/cron_crypto.php --refresh-rates >/dev/null 2>&1
```

دستور نصب/تعمیر cron داخل `blue-ref` هم همین دو خط را داخل `/etc/cron.d/blue-ref-crypto` می‌سازد. اگر می‌خواهی نرخ‌ها هر ۵ یا ۱۵ دقیقه refresh شوند فقط خط دوم را تغییر بده؛ خط اول را یک‌دقیقه‌ای نگه دار تا تایید پرداخت‌ها دیر نشود.

اجرای دستی برای تست:

```bash
php /var/www/bluereferral/public/cron_crypto.php --check-payments
php /var/www/bluereferral/public/cron_crypto.php --refresh-rates
php /var/www/bluereferral/public/cron_crypto.php --all
```

فایل‌های تغییر کرده در این نسخه:

```text
public/cron_crypto.php
install.sh
README.md
```


## Update: Multi-provider crypto rates

در این نسخه منبع نرخ رمزارز از حالت تک‌منبعی خارج شد. cron نرخ‌ها را فقط در حالت `--refresh-rates` می‌گیرد و ترتیب پیش‌فرض این است:

```text
Wallex → Ramzinex → Nobitex → last cache/manual fallback
```

فاکتور و Mini App هیچ درخواست مستقیم به صرافی‌ها نمی‌زنند و فقط از cache استفاده می‌کنند، بنابراین باز شدن پنل مشتری کند نمی‌شود. اگر یکی از Providerها DNS/timeout/JSON error بدهد، Provider بعدی امتحان می‌شود. اگر هیچ‌کدام جواب ندادند، آخرین cache معتبر یا نرخ دستی ادمین استفاده می‌شود.

تست دستی روی سرور:

```bash
cd /var/www/bluereferral
php public/cron_crypto.php --refresh-rates
php public/cron_crypto.php --check-payments
```

cron پیشنهادی:

```cron
* * * * * www-data php /var/www/bluereferral/public/cron_crypto.php --check-payments >/dev/null 2>&1
*/10 * * * * www-data php /var/www/bluereferral/public/cron_crypto.php --refresh-rates >/dev/null 2>&1
```

تنظیمات مهم:

```php
$CRYPTO_RATE_SOURCE = 'auto'; // auto, wallex, ramzinex, nobitex, manual
$CRYPTO_RATE_PROVIDER_PRIORITY = 'wallex,ramzinex,nobitex';
```

در پنل ادمین دکمه «رفرش نرخ از Wallex/Ramzinex/Nobitex» نرخ را دستی refresh می‌کند و آخرین cache، Provider موفق و خطاهای fallback نمایش داده می‌شود.

## Stable Admin Backup / Restore

This version adds a stable backup system that does not depend only on Mini App browser downloads.

Admin Mini App:
- Admin Panel → Backup tab
- Create backup on server
- Send backup to admin Telegram chat
- List server backups
- Download/delete server backups
- Upload `.json.gz` backup and restore
- Restore creates a safety backup automatically before replacing the database

Bot chat admin commands:

```text
/backup
/restore_backup
```

Server-side backups are saved here:

```text
/var/www/bluereferral/storage/backups/
```

Backup format:

```text
blue-referral-backup-YYYYMMDD-HHMMSS.json.gz
```

SFTP path:

```text
/var/www/bluereferral/storage/backups/
```

Notes:
- Backups include database content: users, wallet balances, referrals, settings, products, categories, variants, inventory, orders, crypto wallets/checks, and rate cache.
- Backups do not include `config.php`, bot token, database password, source code, or OS-level files.
- Keep `config.php` and the project ZIP/GitHub repo separately.


## DeviceAdaptive + BackupStable Merge
- Backup/Restore server files are included: public/backup_download.php and public/backup_upload.php.
- Admin Backup tab preserved.
- Bot commands /backup and /restore_backup preserved.
- iOS/Android responsive Mini App UI preserved.

## Update: Dual Currency Product Pricing + Liquid Toggle UI

This version keeps all previous BackupStable, DeviceAdaptive UI, Square Product Image, Manual Crypto and Multi-Rate-Provider features, and adds product pricing in either Toman or USD.

### Product pricing behavior

- Admin can set each product and variant price as **Toman** or **USD/USDT**.
- If price is set as Toman, the exact Toman amount is shown to users.
- If price is set as USD, the Mini App converts it to Toman using the cached USDT/Toman rate from the rate providers:
  `Wallex -> Ramzinex -> Nobitex -> Manual/Cache fallback`.
- Users see the **Toman price** in the shop and product page.
- The USD base price is only shown to users inside the crypto/payment flow, where it is relevant.
- External exchange APIs are still only called by cron/admin refresh, not during normal Mini App page loads.

### Required migration

Run the database migration after updating:

```bash
sudo blue-ref
# then choose:
# Update project from GitHub
# Run database migration
# Install/repair crypto payment cron
# Set Telegram webhook
```

### Cron

Keep the split cron setup:

```cron
* * * * * php /var/www/bluereferral/public/cron_crypto.php --check-payments >/dev/null 2>&1
*/10 * * * * php /var/www/bluereferral/public/cron_crypto.php --refresh-rates >/dev/null 2>&1
```

`--refresh-rates` also refreshes cached Toman values for USD-priced products and variants.

### UI update

Switches and toggle-style controls were redesigned with a soft liquid/glass style inspired by iOS-like toggles, while preserving Android-friendly layout and the existing DeviceAdaptive UI.
