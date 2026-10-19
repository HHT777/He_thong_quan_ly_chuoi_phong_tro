# Thiết lập charset/collation khi nâng cấp DB cũ

## Nhận biết schema chưa nâng cấp và quy trình an toàn

Khi schema thiếu bảng/cột bắt buộc, backend ghi danh sách thiếu vào log lúc khởi động, không chạy cron và trả HTTP 503, mã `DB_SCHEMA_OUTDATED` cho các route `/api/*`. Nội dung trả về không nêu tên bảng/cột. `/health` và `/ready` vẫn dùng được để kiểm tra tiến trình và kết nối DB. Sau khi nâng cấp phải khởi động lại backend để kiểm tra lại schema; backend **không tự chạy DDL**.

1. Sao lưu DB hiện tại và kiểm tra khả năng phục hồi bản sao.
2. Tạo **bản sao** có tên kết thúc `_ci` hoặc `_test`; không dùng DB thật để thử migration.
3. Trên bản sao, chạy migration theo thứ tự 004 → migration mới nhất, rồi chạy lại lượt thứ hai để kiểm tra khả năng chạy lặp.
4. Đối chiếu bảng/cột bằng truy vấn chỉ đọc sau; đối chiếu với `data2.md` và `tests/schema-contract.test.js`. Chỉ sau khi kiểm chứng và được phép vận hành mới lên kế hoạch nâng cấp DB thật với sao lưu/khôi phục riêng.

```sql
SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

Nếu cần lệnh `db:status` chỉ đọc để in danh sách thiếu, hãy duyệt thành việc riêng; đợt này không tạo công cụ migration/status.

Schema chuẩn dùng `utf8mb4` và `utf8mb4_unicode_ci` cho **mọi bảng**, kể cả các bảng được tạo bởi migration 004–015. Database test có thể có mặc định khác; migration phải khai báo collation tường minh để khóa ngoại kiểu chuỗi khớp bảng cũ. Sequelize model cũng khai báo `charset`/`collate` tương ứng.

Trước khi nâng cấp, kiểm tra bản sao DB và chạy migration chỉ trên DB test (`_test`/`_ci`). Không chạy `ALTER TABLE ... CONVERT TO CHARACTER SET` trên DB cũ nếu chưa được người dùng duyệt: thao tác này có thể viết lại dữ liệu và ảnh hưởng index/FK.

```sql
SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE SCHEMA_NAME = DATABASE();

SELECT TABLE_NAME, TABLE_COLLATION
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

SELECT k.CONSTRAINT_NAME, k.TABLE_NAME AS child_table, k.COLUMN_NAME AS child_column,
       k.REFERENCED_TABLE_NAME AS parent_table, k.REFERENCED_COLUMN_NAME AS parent_column,
       child.CHARACTER_SET_NAME AS child_charset, child.COLLATION_NAME AS child_collation,
       parent.CHARACTER_SET_NAME AS parent_charset, parent.COLLATION_NAME AS parent_collation
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
JOIN INFORMATION_SCHEMA.COLUMNS child
  ON child.TABLE_SCHEMA = k.TABLE_SCHEMA AND child.TABLE_NAME = k.TABLE_NAME AND child.COLUMN_NAME = k.COLUMN_NAME
JOIN INFORMATION_SCHEMA.COLUMNS parent
  ON parent.TABLE_SCHEMA = k.REFERENCED_TABLE_SCHEMA AND parent.TABLE_NAME = k.REFERENCED_TABLE_NAME
 AND parent.COLUMN_NAME = k.REFERENCED_COLUMN_NAME
WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
  AND child.CHARACTER_SET_NAME IS NOT NULL
ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION;
```

Hai cột chuỗi trong mỗi cặp FK phải có cùng charset và collation. Bảng chuẩn phải có `TABLE_COLLATION = utf8mb4_unicode_ci`. DB mặc định khác không phải lỗi nếu từng bảng chuẩn vẫn đúng. Kiểm chứng tự động: `tests/schema-contract.test.js`, `tests/schema-collation.integration.test.js` và `scripts/verify-collation-upgrade.js` (hai engine, baseline 25 bảng, chạy migration hai lượt, phép thử bỏ `COLLATE` ở 009 phải thất bại). Script sau **tạo và xóa DB test**; chỉ chạy khi tên/host/cổng đã được duyệt và dump legacy đọc được.
