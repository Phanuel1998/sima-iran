<?php
/**
 * ============================================================================
 * سامانه مدیریت و ثبت ویزیت فروشگاهی (Field Sales Tracker)
 * نسخه نهایی بک‌اند و سرور PHP اختصاصی سرورهای لینوکس (Apache / Nginx / cPanel)
 * ============================================================================
 * سازگار با PHP 7.4 و PHP 8.0 و بالاتر
 * پایگاه داده پیش‌فرض: SQLite (بدون نیاز به نصب یا تنظیم دیتابیس جداگانه)
 * قابلیت اتصال به MySQL با تغییر متغیرهای زیر
 */

// ----------------------------------------------------------------------------
// ۱. تنظیمات پایگاه داده (Database Configuration)
// ----------------------------------------------------------------------------
define('DB_DRIVER', 'sqlite'); // 'sqlite' یا 'mysql'

// تنظیمات دیتابیس SQLite (فایل محلی پایگاه داده)
define('SQLITE_FILE', __DIR__ . '/field_sales.db');

// تنظیمات در صورت تمایل به استفاده از MySQL (در صورت نیاز تغییر دهید):
define('MYSQL_HOST', 'localhost');
define('MYSQL_PORT', '3306');
define('MYSQL_DBNAME', 'field_sales_db');
define('MYSQL_USER', 'root');
define('MYSQL_PASSWORD', '');
define('MYSQL_CHARSET', 'utf8mb4');

// ----------------------------------------------------------------------------
// ۲. تنظیمات خطایابی و هدرهای CORS
// ----------------------------------------------------------------------------
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// تنظیم منطقه زمانی به وقت تهران
date_default_timezone_set('Asia/Tehran');

// هدرهای CORS برای ارتباط بدون مشکل فرانت‌اند با بک‌اند
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ----------------------------------------------------------------------------
// ۳. اتصال به پایگاه داده و ساخت خودکار جداول
// ----------------------------------------------------------------------------
function getDatabaseConnection(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    try {
        if (DB_DRIVER === 'sqlite') {
            $dbPath = SQLITE_FILE;
            $isNew = !file_exists($dbPath);

            $pdo = new PDO("sqlite:" . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

            // فعال‌سازی Foreign Keys و حالت WAL برای سرعت و همزمانی بالا
            $pdo->exec('PRAGMA foreign_keys = ON;');
            $pdo->exec('PRAGMA journal_mode = WAL;');

            // ساخت جدول ویزیت‌ها در صورت عدم وجود (با پشتیبانی از وضعیت Sample و فیلد units_sold)
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS visits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shop_name TEXT NOT NULL,
                    phone_number TEXT,
                    sale_status TEXT NOT NULL CHECK(sale_status IN ('Sold', 'Sample', 'Rejected', 'Callback')),
                    sale_amount REAL DEFAULT 0,
                    units_sold INTEGER DEFAULT 0,
                    notes TEXT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            ");

            // ارتقای ایمن ستون units_sold در دیتابیس‌های موجود
            try {
                $pdo->exec("ALTER TABLE visits ADD COLUMN units_sold INTEGER DEFAULT 0;");
            } catch (Exception $e) {
                // ستون از قبل وجود دارد
            }

            // اگر دیتابیس تازه ساخته شده و خالی است، داده‌های اولیه دمو تهران را اضافه کن
            $countStmt = $pdo->query("SELECT COUNT(*) as count FROM visits");
            $count = (int)$countStmt->fetchColumn();
            if ($count === 0) {
                seedDemoVisits($pdo);
            }
        } else {
            // اتصال به MySQL
            $dsn = "mysql:host=" . MYSQL_HOST . ";port=" . MYSQL_PORT . ";dbname=" . MYSQL_DBNAME . ";charset=" . MYSQL_CHARSET;
            $pdo = new PDO($dsn, MYSQL_USER, MYSQL_PASSWORD, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ]);

            $pdo->exec("
                CREATE TABLE IF NOT EXISTS visits (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    shop_name VARCHAR(255) NOT NULL,
                    phone_number VARCHAR(50),
                    sale_status ENUM('Sold', 'Sample', 'Rejected', 'Callback') NOT NULL,
                    sale_amount DECIMAL(15, 2) DEFAULT 0,
                    units_sold INT DEFAULT 0,
                    notes TEXT,
                    latitude DECIMAL(10, 7) NOT NULL,
                    longitude DECIMAL(10, 7) NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_persian_ci;
            ");
        }

        return $pdo;
    } catch (PDOException $e) {
        respondJson(['success' => false, 'error' => 'خطای اتصال به دیتابیس: ' . $e->getMessage()], 500);
        exit;
    }
}

// درج چند ویزیت اولیه تهران جهت تست
function seedDemoVisits(PDO $pdo): void {
    $stmt = $pdo->prepare("
        INSERT INTO visits (shop_name, phone_number, sale_status, sale_amount, units_sold, notes, latitude, longitude, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $today = date('Y-m-d H:i:s');
    $yesterday = date('Y-m-d H:i:s', strtotime('-1 day'));
    $twoDaysAgo = date('Y-m-d H:i:s', strtotime('-2 days'));

    $demo = [
        ['سوپرمارکت پارس آزادی', '02166554433', 'Sample', 0, 5, 'ارائه ۵ بسته نمونه جهت تست طعم و بررسی مشتریان', 35.6892, 51.3890, $today],
        ['سوپرمارکت ولیعصر تهران', '02188992211', 'Sold', 350000, 15, 'خریداری ۱۵ کارتن آبمیوه طبیعی', 35.6945, 51.3965, $yesterday],
        ['کتابفروشی دانشجو انقلاب', '02166405588', 'Sold', 450000, 10, 'سفارش عمده کتاب‌های کمک‌آموزشی ثبت شد', 35.7010, 51.3912, $twoDaysAgo],
        ['کافه ولیعصر تهران', '02188885544', 'Callback', 0, 0, 'پیگیری مجدد در انتهای هفته', 35.6920, 51.3930, $yesterday],
    ];

    foreach ($demo as $v) {
        $stmt->execute($v);
    }
}

// ----------------------------------------------------------------------------
// ۴. توابع کمکی خروجی JSON و دریافت ورودی
// ----------------------------------------------------------------------------
function respondJson(array $data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return $_POST;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// ----------------------------------------------------------------------------
// ۵. مسیریابی درخواست‌ها (Routing)
// ----------------------------------------------------------------------------
$method = $_SERVER['REQUEST_METHOD'];
$requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// حذف پوشه فعلی از مسیر برای سازگاری در ساب‌فولدرها
$scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
if ($scriptDir !== '/' && strpos($requestUri, $scriptDir) === 0) {
    $requestUri = substr($requestUri, strlen($scriptDir));
}
$requestUri = '/' . ltrim($requestUri, '/');

// همچنین پشتیبانی از ?action=... در صورت غیرفعال بودن mod_rewrite
$action = $_GET['action'] ?? null;

// ۱) لیست تمام ویزیت‌ها: GET /api/visits
if (($method === 'GET' && preg_match('#^/api/visits/?$#', $requestUri)) || ($action === 'visits' && $method === 'GET')) {
    $db = getDatabaseConnection();
    try {
        $stmt = $db->query("SELECT * FROM visits ORDER BY id DESC");
        $visits = $stmt->fetchAll();

        // تبدیل مقادیر عددی برای تطابق کامل با تایپ‌اسکریپت فرانت‌اند
        foreach ($visits as &$v) {
            $v['id'] = (int)$v['id'];
            $v['sale_amount'] = (float)$v['sale_amount'];
            $v['units_sold'] = isset($v['units_sold']) ? (int)$v['units_sold'] : 0;
            $v['latitude'] = (float)$v['latitude'];
            $v['longitude'] = (float)$v['longitude'];
        }

        respondJson(['success' => true, 'visits' => $visits]);
    } catch (Exception $e) {
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ۲) ثبت ویزیت جدید: POST /api/visits
if (($method === 'POST' && preg_match('#^/api/visits/?$#', $requestUri)) || ($action === 'create_visit' && $method === 'POST')) {
    $data = getJsonInput();
    $shopName = trim($data['shop_name'] ?? '');
    $phoneNumber = trim($data['phone_number'] ?? '');
    $saleStatus = trim($data['sale_status'] ?? '');
    $saleAmount = (float)($data['sale_amount'] ?? 0);
    $unitsSold = (int)($data['units_sold'] ?? 0);
    $notes = trim($data['notes'] ?? '');
    $latitude = isset($data['latitude']) ? (float)$data['latitude'] : null;
    $longitude = isset($data['longitude']) ? (float)$data['longitude'] : null;
    $timestamp = !empty($data['timestamp']) ? $data['timestamp'] : date('Y-m-d H:i:s');

    if (empty($shopName)) {
        respondJson(['success' => false, 'error' => 'نام فروشگاه الزامی است.'], 400);
    }

    if (!in_array($saleStatus, ['Sold', 'Sample', 'Rejected', 'Callback'], true)) {
        respondJson(['success' => false, 'error' => 'وضعیت ویزیت نامعتبر است.'], 400);
    }

    if ($latitude === null || $longitude === null) {
        respondJson(['success' => false, 'error' => 'مختصات جغرافیایی (عرض و طول) الزامی است.'], 400);
    }

    $db = getDatabaseConnection();
    try {
        $stmt = $db->prepare("
            INSERT INTO visits (shop_name, phone_number, sale_status, sale_amount, units_sold, notes, latitude, longitude, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $shopName,
            $phoneNumber,
            $saleStatus,
            $saleAmount,
            $unitsSold,
            $notes,
            $latitude,
            $longitude,
            $timestamp
        ]);

        $lastId = (int)$db->lastInsertId();
        $visitStmt = $db->prepare("SELECT * FROM visits WHERE id = ?");
        $visitStmt->execute([$lastId]);
        $createdVisit = $visitStmt->fetch();

        if ($createdVisit) {
            $createdVisit['id'] = (int)$createdVisit['id'];
            $createdVisit['sale_amount'] = (float)$createdVisit['sale_amount'];
            $createdVisit['units_sold'] = (int)$createdVisit['units_sold'];
            $createdVisit['latitude'] = (float)$createdVisit['latitude'];
            $createdVisit['longitude'] = (float)$createdVisit['longitude'];
        }

        respondJson(['success' => true, 'visit' => $createdVisit], 201);
    } catch (Exception $e) {
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ۳) همگام‌سازی دسته‌ای آفلاین: POST /api/visits/sync
if (($method === 'POST' && preg_match('#^/api/visits/sync/?$#', $requestUri)) || ($action === 'sync_visits' && $method === 'POST')) {
    $data = getJsonInput();
    $visitsList = $data['visits'] ?? [];

    if (!is_array($visitsList)) {
        respondJson(['success' => false, 'error' => 'آرایه‌ای از ویزیت‌ها ارسال نشده است.'], 400);
    }

    $db = getDatabaseConnection();
    $syncedCount = 0;

    try {
        $db->beginTransaction();
        $stmt = $db->prepare("
            INSERT INTO visits (shop_name, phone_number, sale_status, sale_amount, units_sold, notes, latitude, longitude, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        foreach ($visitsList as $v) {
            $shopName = trim($v['shop_name'] ?? '');
            $status = $v['sale_status'] ?? '';
            if (!empty($shopName) && in_array($status, ['Sold', 'Sample', 'Rejected', 'Callback'], true)) {
                $stmt->execute([
                    $shopName,
                    trim($v['phone_number'] ?? ''),
                    $status,
                    (float)($v['sale_amount'] ?? 0),
                    (int)($v['units_sold'] ?? 0),
                    trim($v['notes'] ?? ''),
                    (float)($v['latitude'] ?? 0),
                    (float)($v['longitude'] ?? 0),
                    !empty($v['timestamp']) ? $v['timestamp'] : date('Y-m-d H:i:s')
                ]);
                $syncedCount++;
            }
        }
        $db->commit();

        $allStmt = $db->query("SELECT * FROM visits ORDER BY id DESC");
        $allVisits = $allStmt->fetchAll();

        foreach ($allVisits as &$item) {
            $item['id'] = (int)$item['id'];
            $item['sale_amount'] = (float)$item['sale_amount'];
            $item['units_sold'] = isset($item['units_sold']) ? (int)$item['units_sold'] : 0;
            $item['latitude'] = (float)$item['latitude'];
            $item['longitude'] = (float)$item['longitude'];
        }

        respondJson(['success' => true, 'syncedCount' => $syncedCount, 'visits' => $allVisits]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ۴) ویرایش ویزیت: PUT /api/visits/{id} (یا POST با id)
if (($method === 'PUT' && preg_match('#^/api/visits/(\d+)/?$#', $requestUri, $matches)) ||
    (($method === 'POST' || $method === 'PUT') && ($action === 'update_visit' && !empty($_GET['id'])))) {
    $id = isset($matches[1]) ? (int)$matches[1] : (int)$_GET['id'];
    $data = getJsonInput();

    $shopName = trim($data['shop_name'] ?? '');
    $phoneNumber = trim($data['phone_number'] ?? '');
    $saleStatus = trim($data['sale_status'] ?? '');
    $saleAmount = (float)($data['sale_amount'] ?? 0);
    $unitsSold = (int)($data['units_sold'] ?? 0);
    $notes = trim($data['notes'] ?? '');
    $latitude = isset($data['latitude']) ? (float)$data['latitude'] : null;
    $longitude = isset($data['longitude']) ? (float)$data['longitude'] : null;

    if (empty($shopName)) {
        respondJson(['success' => false, 'error' => 'نام فروشگاه الزامی است.'], 400);
    }

    if (!empty($saleStatus) && !in_array($saleStatus, ['Sold', 'Sample', 'Rejected', 'Callback'], true)) {
        respondJson(['success' => false, 'error' => 'وضعیت ویزیت نامعتبر است.'], 400);
    }

    $db = getDatabaseConnection();
    try {
        $stmt = $db->prepare("
            UPDATE visits
            SET shop_name = ?,
                phone_number = ?,
                sale_status = ?,
                sale_amount = ?,
                units_sold = ?,
                notes = ?,
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude)
            WHERE id = ?
        ");
        $stmt->execute([
            $shopName,
            $phoneNumber,
            $saleStatus,
            $saleAmount,
            $unitsSold,
            $notes,
            $latitude,
            $longitude,
            $id
        ]);

        $checkStmt = $db->prepare("SELECT * FROM visits WHERE id = ?");
        $checkStmt->execute([$id]);
        $updated = $checkStmt->fetch();

        if (!$updated) {
            respondJson(['success' => false, 'error' => 'رکورد ویزیت یافت نشد.'], 404);
        }

        $updated['id'] = (int)$updated['id'];
        $updated['sale_amount'] = (float)$updated['sale_amount'];
        $updated['units_sold'] = (int)$updated['units_sold'];
        $updated['latitude'] = (float)$updated['latitude'];
        $updated['longitude'] = (float)$updated['longitude'];

        respondJson(['success' => true, 'visit' => $updated]);
    } catch (Exception $e) {
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ۵) حذف ویزیت: DELETE /api/visits/{id} (یا POST با id)
if (($method === 'DELETE' && preg_match('#^/api/visits/(\d+)/?$#', $requestUri, $matches)) ||
    (($method === 'POST' || $method === 'DELETE') && ($action === 'delete_visit' && !empty($_GET['id'])))) {
    $id = isset($matches[1]) ? (int)$matches[1] : (int)$_GET['id'];

    $db = getDatabaseConnection();
    try {
        $stmt = $db->prepare("DELETE FROM visits WHERE id = ?");
        $stmt->execute([$id]);
        respondJson(['success' => true, 'message' => 'رکورد ویزیت با موفقیت حذف گردید.']);
    } catch (Exception $e) {
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ۶) خروجی اکسل راست‌به‌چپ (RTL): GET /api/export-excel
if (($method === 'GET' && preg_match('#^/api/export-excel/?$#', $requestUri)) || ($action === 'export_excel' && $method === 'GET')) {
    $db = getDatabaseConnection();
    try {
        $stmt = $db->query("SELECT * FROM visits ORDER BY id ASC");
        $visits = $stmt->fetchAll();

        $dateStr = date('Y-m-d');
        $filename = "field_sales_report_tehran_{$dateStr}.xls";

        // خروجی در قالب XML Spreadsheet رسمی با جهت راست‌به‌چپ و UTF-8 برای باز شدن بی‌نقص در اکسل
        header('Content-Type: application/vnd.ms-excel; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: max-age=0');

        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"' . "\n";
        echo ' xmlns:o="urn:schemas-microsoft-com:office:office"' . "\n";
        echo ' xmlns:x="urn:schemas-microsoft-com:office:excel"' . "\n";
        echo ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"' . "\n";
        echo ' xmlns:html="http://www.w3.org/TR/REC-html40">' . "\n";

        // استایل‌های پیشرفته برای اکسل
        echo '<Styles>' . "\n";
        echo ' <Style ss:ID="Default" ss:Name="Normal">' . "\n";
        echo '  <Alignment ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>' . "\n";
        echo '  <Font ss:FontName="Tahoma" x:CharSet="178" ss:Size="10" ss:Color="#0F172A"/>' . "\n";
        echo ' </Style>' . "\n";
        echo ' <Style ss:ID="HeaderStyle">' . "\n";
        echo '  <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>' . "\n";
        echo '  <Borders>' . "\n";
        echo '   <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#059669"/>' . "\n";
        echo '  </Borders>' . "\n";
        echo '  <Font ss:FontName="Tahoma" x:CharSet="178" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>' . "\n";
        echo '  <Interior ss:Color="#059669" ss:Pattern="Solid"/>' . "\n";
        echo ' </Style>' . "\n";
        echo ' <Style ss:ID="NumberStyle">' . "\n";
        echo '  <Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>' . "\n";
        echo '  <NumberFormat ss:Format="#,##0"/>' . "\n";
        echo ' </Style>' . "\n";
        echo ' <Style ss:ID="SampleStyle">' . "\n";
        echo '  <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>' . "\n";
        echo '  <Font ss:FontName="Tahoma" x:CharSet="178" ss:Size="10" ss:Color="#1D4ED8" ss:Bold="1"/>' . "\n";
        echo '  <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>' . "\n";
        echo ' </Style>' . "\n";
        echo ' <Style ss:ID="SoldStyle">' . "\n";
        echo '  <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:ReadingOrder="RightToLeft"/>' . "\n";
        echo '  <Font ss:FontName="Tahoma" x:CharSet="178" ss:Size="10" ss:Color="#047857" ss:Bold="1"/>' . "\n";
        echo '  <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>' . "\n";
        echo ' </Style>' . "\n";
        echo '</Styles>' . "\n";

        // کاربرگ با جهت راست‌به‌چپ (RTL)
        echo '<Worksheet ss:Name="گزارش ویزیت فروشگاه‌ها">' . "\n";
        echo ' <Table ss:DefaultRowHeight="22">' . "\n";
        echo '  <Column ss:Width="45"/>' . "\n";  // ردیف
        echo '  <Column ss:Width="160"/>' . "\n"; // نام فروشگاه
        echo '  <Column ss:Width="110"/>' . "\n"; // تلفن
        echo '  <Column ss:Width="140"/>' . "\n"; // وضعیت
        echo '  <Column ss:Width="120"/>' . "\n"; // مبلغ
        echo '  <Column ss:Width="110"/>' . "\n"; // تعداد اقلام
        echo '  <Column ss:Width="240"/>' . "\n"; // یادداشت
        echo '  <Column ss:Width="95"/>' . "\n";  // عرض جغرافیایی
        echo '  <Column ss:Width="95"/>' . "\n";  // طول جغرافیایی
        echo '  <Column ss:Width="130"/>' . "\n"; // تاریخ

        // سطر سرستون‌ها
        echo '  <Row ss:Height="28">' . "\n";
        $headers = [
            'ردیف',
            'نام فروشگاه / کسب‌وکار',
            'شماره تماس',
            'وضعیت ویزیت',
            'مبلغ فروش (تومان)',
            'تعداد اقلام (واحد)',
            'یادداشت و اقدامات',
            'عرض جغرافیایی',
            'طول جغرافیایی',
            'تاریخ و زمان ثبت'
        ];
        foreach ($headers as $h) {
            echo '   <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">' . htmlspecialchars($h, ENT_QUOTES, 'UTF-8') . '</Data></Cell>' . "\n";
        }
        echo '  </Row>' . "\n";

        // داده‌های ویزیت‌ها
        $index = 1;
        foreach ($visits as $v) {
            $statusStr = 'نامشخص';
            $statusStyle = '';
            if ($v['sale_status'] === 'Sold') {
                $statusStr = 'موفق (فروش انجام شد)';
                $statusStyle = ' ss:StyleID="SoldStyle"';
            } elseif ($v['sale_status'] === 'Sample') {
                $statusStr = 'نمونه (ارائه نمونه کالا)';
                $statusStyle = ' ss:StyleID="SampleStyle"';
            } elseif ($v['sale_status'] === 'Rejected') {
                $statusStr = 'ناموفق (عدم تمایل)';
            } elseif ($v['sale_status'] === 'Callback') {
                $statusStr = 'پیگیری مجدد';
            }

            echo '  <Row>' . "\n";
            echo '   <Cell><Data ss:Type="Number">' . $index++ . '</Data></Cell>' . "\n";
            echo '   <Cell><Data ss:Type="String">' . htmlspecialchars($v['shop_name'] ?? '', ENT_QUOTES, 'UTF-8') . '</Data></Cell>' . "\n";
            echo '   <Cell><Data ss:Type="String">' . htmlspecialchars($v['phone_number'] ?: '---', ENT_QUOTES, 'UTF-8') . '</Data></Cell>' . "\n";
            echo '   <Cell' . $statusStyle . '><Data ss:Type="String">' . htmlspecialchars($statusStr, ENT_QUOTES, 'UTF-8') . '</Data></Cell>' . "\n";
            echo '   <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">' . (float)($v['sale_amount'] ?? 0) . '</Data></Cell>' . "\n";
            echo '   <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">' . (int)($v['units_sold'] ?? 0) . '</Data></Cell>' . "\n";
            echo '   <Cell><Data ss:Type="String">' . htmlspecialchars($v['notes'] ?? '', ENT_QUOTES, 'UTF-8') . '</Data></Cell>' . "\n";
            echo '   <Cell><Data ss:Type="Number">' . (float)($v['latitude'] ?? 0) . '</Data></Cell>' . "\n";
            echo '   <Cell><Data ss:Type="Number">' . (float)($v['longitude'] ?? 0) . '</Data></Cell>' . "\n";
            echo '   <Cell><Data ss:Type="String">' . htmlspecialchars($v['timestamp'] ?? '', ENT_QUOTES, 'UTF-8') . '</Data></Cell>' . "\n";
            echo '  </Row>' . "\n";
        }

        echo ' </Table>' . "\n";
        echo ' <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">' . "\n";
        echo '  <DisplayRightToLeft/>' . "\n";
        echo ' </WorksheetOptions>' . "\n";
        echo '</Worksheet>' . "\n";
        echo '</Workbook>' . "\n";
        exit;
    } catch (Exception $e) {
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ۷) خروجی CSV با UTF-8 BOM: GET /api/export
if (($method === 'GET' && preg_match('#^/api/export/?$#', $requestUri)) || ($action === 'export_csv' && $method === 'GET')) {
    $db = getDatabaseConnection();
    try {
        $stmt = $db->query("SELECT * FROM visits ORDER BY id ASC");
        $visits = $stmt->fetchAll();

        $filename = "visits_export_" . date('Y-m-d') . ".csv";
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        // ارسال UTF-8 BOM برای خواندن درست حروف فارسی در نرم‌افزار اکسل ویندوز
        echo "\xEF\xBB\xBF";

        $output = fopen('php://output', 'w');
        fputcsv($output, ['id', 'shop_name', 'phone_number', 'sale_status', 'sale_amount', 'units_sold', 'notes', 'latitude', 'longitude', 'timestamp']);

        foreach ($visits as $v) {
            fputcsv($output, [
                $v['id'],
                $v['shop_name'],
                $v['phone_number'],
                $v['sale_status'],
                $v['sale_amount'],
                $v['units_sold'] ?? 0,
                $v['notes'],
                $v['latitude'],
                $v['longitude'],
                $v['timestamp']
            ]);
        }
        fclose($output);
        exit;
    } catch (Exception $e) {
        respondJson(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

// ----------------------------------------------------------------------------
// ۶. سرو فایل‌های فرانت‌اند استاتیک (SPA Static Delivery)
// ----------------------------------------------------------------------------
// اگر درخواستی به روت / یا فایل‌های کلاینت ارسال شد، از پوشه dist/ سرو می‌گردد
$distDir = __DIR__ . '/dist';
if (is_dir($distDir)) {
    $requestedPath = $distDir . $requestUri;
    if (is_file($requestedPath)) {
        $ext = strtolower(pathinfo($requestedPath, PATHINFO_EXTENSION));
        $mimes = [
            'js' => 'application/javascript',
            'css' => 'text/css',
            'html' => 'text/html; charset=utf-8',
            'json' => 'application/json',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'svg' => 'image/svg+xml',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ico' => 'image/x-icon',
        ];
        header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
        readfile($requestedPath);
        exit;
    }

    // fallback به index.html برای مسیریابی React Router / SPA
    if (file_exists($distDir . '/index.html')) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($distDir . '/index.html');
        exit;
    }
}

// اگر هیچ فایل فرانت‌اندی در dist نبود، پیام وضعیت API نمایش داده می‌شود
respondJson([
    'service' => 'Field Sales Tracker PHP API',
    'status' => 'online',
    'php_version' => PHP_VERSION,
    'db_engine' => DB_DRIVER,
    'time' => date('Y-m-d H:i:s'),
    'endpoints' => [
        'GET /api/visits' => 'لیست ویزیت‌ها',
        'POST /api/visits' => 'ثبت ویزیت جدید',
        'POST /api/visits/sync' => 'همگام‌سازی آفلاین',
        'PUT /api/visits/{id}' => 'ویرایش ویزیت',
        'DELETE /api/visits/{id}' => 'حذف ویزیت',
        'GET /api/export-excel' => 'دانلود گزارش اکسل راست‌به‌چپ (RTL)',
        'GET /api/export' => 'دانلود خروجی CSV',
    ]
]);
