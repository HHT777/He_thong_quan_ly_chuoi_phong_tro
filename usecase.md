KHANG

USE CASE 04.C: Tạo phòng
Mô tả
Tạo / Ghi nhận thông tin trong chức năng “Quản lý phòng” theo luồng đã đặc tả. Cho phép Chủ trọ thêm mới, xem, chỉnh sửa thông tin phòng thuê, giá thuê, nội thất và cập nhật trạng thái phòng thuộc từng căn trọ để phục vụ cho các quy trình quản lý và cho thuê.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công.
- Hệ thống đã có ít nhất một Căn trọ.
  Hậu điều kiện
  Dữ liệu được tạo hoặc ghi nhận theo kết quả của luồng gốc.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý phòng”.

2. Hiển thị danh sách căn trọ.
3. Chọn căn trọ.

4. Hiển thị danh sách phòng thuộc căn.
5. Chọn “Thêm phòng mới”.

6. Hiển thị biểu mẫu diện tích, giá thuê, số người tối đa, nội thất, trạng thái khởi tạo.
7. Nhập thông tin phòng.

8. Hệ thống kiểm tra tính hợp lệ thông tin.
9. Nhấn “Xác nhận”.

10. Khởi tạo mã/số phòng, lưu vào CSDL.

11. Cập nhật danh sách và thông báo thêm thành công.
    Alternative flow
    4.1. Căn trọ chưa có phòng
12. Chủ trọ chọn một căn chưa có phòng để thêm phòng.
13. Hệ thống hiển thị danh sách trống và cho phép tiếp tục thao tác thêm phòng.
14. Tiếp tục bước 5.

Exception flow
9.1. Số phòng trong căn trọ đã tồn tại
Hệ thống báo lỗi “Phòng đã tồn tại”.
Quay lại bước 6.
11.1. Dữ liệu phòng không hợp lệ hoặc lưu thất bại

1. Hệ thống thông báo lỗi, không lưu thông tin phòng mới.
2. Quay lại bước 6.

USE CASE 04.R: Xem phòng
Mô tả
Xem / Tra cứu thông tin trong chức năng “Quản lý phòng” theo luồng đã đặc tả. Cho phép Chủ trọ thêm mới, xem, chỉnh sửa thông tin phòng thuê, giá thuê, nội thất và cập nhật trạng thái phòng thuộc từng căn trọ để phục vụ cho các quy trình quản lý và cho thuê.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công.
- Hệ thống đã có ít nhất một Căn trọ.
  Hậu điều kiện
  Thông tin được hiển thị theo luồng gốc.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý phòng”.

2. Hiển thị danh sách căn trọ.
3. Chọn căn trọ.

4. Hiển thị danh sách phòng thuộc căn.
5. Chọn một phòng để xem.

6. Hiển thị thông tin phòng, giá thuê, trạng thái và nội thất.
   Alternative flow
   4.1. Căn trọ chưa có phòng
7. Hệ thống không tìm thấy phòng thuộc căn trọ đã chọn.
8. Hiển thị thông báo “Không có phòng trong căn trọ”.
9. Quay lại bước 2.

USE CASE 04.U: Cập nhật / Chỉnh sửa – phòng
Mô tả
Cập nhật / Chỉnh sửa thông tin trong chức năng “Quản lý phòng” theo luồng đã đặc tả. Cho phép Chủ trọ thêm mới, xem, chỉnh sửa thông tin phòng thuê, giá thuê, nội thất và cập nhật trạng thái phòng thuộc từng căn trọ để phục vụ cho các quy trình quản lý và cho thuê.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công.
- Hệ thống đã có ít nhất một Căn trọ.
  Hậu điều kiện
  Dữ liệu hoặc trạng thái được cập nhật theo luồng gốc.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý phòng”.

2. Hiển thị danh sách căn trọ.
3. Chọn căn trọ.

4. Hiển thị danh sách phòng thuộc căn.
5. Chọn phòng cần chỉnh sửa và chọn “Sửa”.

6. Hiển thị thông tin hiện tại của phòng và biểu mẫu chỉnh sửa.
7. Chỉnh sửa thông tin phòng, giá thuê, nội thất.

8. Chọn “Lưu”.

9. Lưu thông tin mới vào CSDL và cập nhật danh sách phòng.

10. Thông báo cập nhật thành công.
    Alternative flow
    7.1. Hủy sửa phòng
11. Chủ trọ dừng chỉnh sửa thông tin phòng.
12. Hệ thống giữ thông tin phòng trước đó và quay về danh sách.
13. Kết thúc usecase.
    Exception flow
    9.1. Thông tin sửa không hợp lệ hoặc lỗi lưu
14. Hệ thống thông báo lỗi, không lưu thay đổi và giữ nguyên dữ liệu cũ.
15. Quay lại bước 6.

USE CASE 09: Nhập chỉ số điện
Mô tả
Cho phép khách thuê tải lên hình ảnh công tơ điện. Hệ thống sử dụng mô hình AI để tự động nhận diện và đọc chỉ số điện từ hình ảnh, sau đó hiển thị kết quả để khách thuê kiểm tra trước khi xác nhận gửi cho chủ trọ.
Tiền điều kiện

- Khách thuê đã đăng nhập thành công.
- Khách đang có phòng thuê hợp lệ.
- Đã đến thời gian nhập chỉ số điện của kỳ.
- Chỉ số kỳ trước của phòng đã tồn tại trong hệ thống.
  Hậu điều kiện
- Hình ảnh công tơ điện được lưu thành công.
- Chỉ số điện được hệ thống nhận diện và lưu cùng hình ảnh minh chứng.
- Dữ liệu ở trạng thái "Chờ xác nhận" để Chủ trọ kiểm tra.
  Actor chính
  Khách thuê
  Actor phụ
  API nhận diện ảnh
  Basic flow
  Khách thuê
  Hệ thống

1. Chọn chức năng “Nhập chỉ số điện”.
2. Hiển thị thông tin phòng, chỉ số điện kỳ trước và chức năng tải ảnh công tơ điện.
3. Chọn và tải lên hình ảnh công tơ điện.
4. Kiểm tra định dạng và chất lượng hình ảnh.

5. Sử dụng mô hình AI để nhận diện và đọc chỉ số điện từ hình ảnh.

6. Kiểm tra tính hợp lệ của chỉ số điện được nhận diện với chỉ số điện của kỳ trước.

7. Hiển thị hình ảnh cùng chỉ số điện đã nhận diện.
8. Nhấn "Xác nhận" nếu chỉ số chính xác.
9. Lưu chỉ số điện và hình ảnh minh chứng vào CSDL.

10. Đặt trạng thái dữ liệu là “Chờ xác nhận”.

11. Thông báo cho Chủ trọ có chỉ số điện mới cần kiểm tra.

12. Thông báo chỉ số được cập nhật thành công.
    Alternative flow
    7.1. Kết quả nhận diện chưa chính xác
13. Khách thuê chọn "Tải lại hình ảnh".
14. Hệ thống hủy kết quả nhận diện trước đó.
15. Quay lại bước 3 của Basic Flow.

Exception flow
4.1. Hình ảnh không hợp lệ

1.  Hệ thống phát hiện hình ảnh không đúng định dạng hoặc bị hỏng.
2.  Hệ thống hiển thị thông báo lỗi.
3.  Yêu cầu khách thuê chọn hình ảnh khác.
4.  Quay lại bước 3 của Basic Flow.
    6.1. Chỉ số điện nhỏ hơn chỉ số kỳ trước
5.  Hệ thống phát hiện chỉ số điện vừa nhận diện nhỏ hơn chỉ số điện của kỳ trước.
6.  Hệ thống thông báo "Chỉ số điện không hợp lệ. Vui lòng kiểm tra lại hoặc tải ảnh khác."
7.  Không cho phép xác nhận.
8.  Quay lại bước 3 của Basic Flow.
    9.1. Lỗi khi lưu vào CSDL.
9.  Lỗi không thể lưu vào CSDL.
10. Hệ thống thông báo “Gửi chỉ số điện không thành công”.
11. Kết thúc usecase.

USE CASE 13: Yêu cầu gia hạn
Mô tả
Cho phép khách thuê gửi yêu cầu gia hạn hợp đồng thuê đang còn hiệu lực bằng cách cung cấp thời gian muốn gia hạn và nội dung đề nghị. Hệ thống ghi nhận yêu cầu và chuyển đến chủ trọ để xem xét, phê duyệt trước khi cập nhật thời hạn hợp đồng.

Tiền điều kiện

- Khách thuê đã đăng nhập thành công vào hệ thống.
  - Khách thuê đang có hợp đồng thuê còn hiệu lực.
  - Hợp đồng chưa được thanh lý.

Hậu điều kiện

- Yêu cầu gia hạn được lưu vào hệ thống.
  - Yêu cầu được chuyển sang trạng thái “Chờ phê duyệt”.
  - Chủ trọ nhận được thông tin yêu cầu gia hạn.
  - Nếu được phê duyệt, thông tin thời hạn hợp đồng được cập nhật theo thỏa thuận.

Actor chính
Khách thuê

Actor phụ
Chủ trọ

Basic Flow

Khách thuê
Hệ thống

1. Truy cập chức năng “Xem hợp đồng”.
2. Hiển thị thông tin hợp đồng hiện tại, bao gồm thời hạn hợp đồng và trạng thái hợp đồng.

3. Chọn “Yêu cầu gia hạn hợp đồng”.
4. Hiển thị biểu mẫu yêu cầu gia hạn.

5. Nhập thời gian muốn gia hạn và nội dung đề nghị.
6. Kiểm tra tính hợp lệ của thông tin yêu cầu.

7. Hiển thị biểu mẫu và kích hoạt nút “Gửi yêu cầu”.

8. Chọn “Gửi yêu cầu”.
9. Lưu yêu cầu gia hạn vào CSDL với trạng thái “Chờ phê duyệt”.

10. Thông báo “Gửi yêu cầu gia hạn thành công”.

Alternative flow

8.1. Khách thuê muốn thay đổi thời gian gia hạn
Khách thuê nhập lại thời gian gia hạn mong muốn.
Hệ thống cập nhật thông tin trên biểu mẫu.
Quay lại bước 5 của Basic Flow.

Exception flow

7.1. Thông tin yêu cầu không hợp lệ

1. Hệ thống phát hiện thông tin bắt buộc bị thiếu hoặc thời gian gia hạn không hợp lệ.
2. Hệ thống hiển thị thông báo lỗi tương ứng.
3. Hệ thống không lưu yêu cầu.
4. Quay lại bước 4 của Basic Flow.

USE CASE 14: Yêu cầu trả phòng
Mô tả
Cho phép khách thuê gửi yêu cầu trả phòng trước khi kết thúc hợp đồng thuê bằng cách cung cấp ngày dự kiến trả phòng và nội dung yêu cầu. Hệ thống ghi nhận yêu cầu, chuyển đến chủ trọ để xem xét, phê duyệt và làm cơ sở thực hiện quy trình xử lý trả phòng.
Tiền điều kiện

- Khách thuê đã đăng nhập thành công.
- Khách thuê đang có hợp đồng thuê còn hiệu lực.
- Hợp đồng chưa được thanh lý.
  Hậu điều kiện
- Yêu cầu trả phòng được lưu thành công.
- Yêu cầu chuyển sang trạng thái “Chờ phê duyệt”.
- Chủ trọ nhận được yêu cầu trả phòng.
- Khi yêu cầu được phê duyệt, phòng được chuyển sang trạng thái “Đang xử lý trả phòng” để thực hiện UC15.
  Actor chính
  Khách thuê
  Actor phụ
  Chủ trọ
  Basic Flow
  Khách thuê
  Hệ thống

1. Truy cập chức năng “Xem hợp đồng”.
2. Hiển thị thông tin hợp đồng hiện tại.
3. Chọn “Yêu cầu trả phòng”.
4. Hiển thị biểu mẫu yêu cầu trả phòng.
5. Nhập ngày dự kiến trả phòng và nội dung yêu cầu.
6. Kiểm tra thông tin hợp đồng và dữ liệu yêu cầu.

7. Mở khóa nút gửi yêu cầu
8. Xác nhận “Gửi yêu cầu”.
9. Lưu yêu cầu trả phòng với trạng thái “Chờ phê duyệt”.

10. Thông báo “Gửi yêu cầu trả phòng thành công”.
    Alternative flow
    8.1. Khách thuê thay đổi ngày trả phòng
11. Khách thuê nhập lại ngày dự kiến trả phòng.
12. Hệ thống cập nhật thông tin trên biểu mẫu.
13. Quay lại bước 6 của Basic Flow.

Exception flow
7.1. Hợp đồng không còn hiệu lực

1. Hệ thống phát hiện hợp đồng đã hết hạn hoặc đã được thanh lý.
2. Hệ thống không cho phép tạo yêu cầu trả phòng.
3. Hiển thị thông báo phù hợp.
4. Kết thúc Use Case.

7.2. Thông tin yêu cầu không hợp lệ

1. Hệ thống phát hiện thiếu thông tin bắt buộc.
2. Hiển thị lỗi tại trường dữ liệu tương ứng.
3. Không lưu yêu cầu.
4. Quay lại bước 5 của Basic Flow.

9.1. Đã có yêu cầu trả phòng đang chờ xử lý

1. Hệ thống phát hiện khách thuê đã có yêu cầu trả phòng chưa được xử lý.
2. Hệ thống không tạo yêu cầu mới.
3. Hiển thị thông báo yêu cầu hiện tại đang được xử lý.
4. Kết thúc Use Case.

TRƯỜNG
USE CASE 03.C: Tạo / Ghi nhận – căn trọ
Mô tả
Cho phép Chủ trọ thêm mới một căn trọ vào hệ thống (tên căn, địa chỉ, mô tả, quy định chung, hình ảnh tổng quan) làm cơ sở để tạo phòng và quản lý theo từng căn.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống
  - Kết nối cơ sở dữ liệu ổn định.
    Hậu điều kiện
- Căn trọ mới được lưu với mã căn duy nhất và trạng thái “Đang hoạt động”.
- Căn trọ mới xuất hiện trong danh sách căn trọ.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý căn trọ”.

2. Hiển thị danh sách căn trọ (tên căn, địa chỉ, trạng thái hoạt động).
3. Chọn “Thêm mới căn trọ”.

4. Hiển thị biểu mẫu: Tên căn, Địa chỉ, Mô tả, Quy định chung, Hình ảnh tổng quan.
5. Nhập thông tin căn trọ.

6. Chọn “Lưu thông tin”.

7. Kiểm tra dữ liệu hợp lệ.

8. Tạo mã căn.

9. Lưu thông tin vào CSDL.

10. Cập nhật danh sách.

11. Thông báo thêm thành công.
    Alternative flow
    5.1. Hủy thêm căn trọ
12. Chủ trọ chọn “Hủy” trên biểu mẫu thêm căn trọ.
13. Hệ thống không lưu thông tin căn trọ vào CSDL
14. Hệ thống đóng biểu mẫu thêm căn trọ..
15. Quay lại bước 2.
    Exception flow
    7.1. Dữ liệu căn trọ không hợp lệ
16. Hệ thống phát hiện thiếu trường bắt buộc hoặc dữ liệu không đúng định dạng.
17. Hệ thống thông báo lỗi tương ứng để Chủ trọ biết thông tin cần sửa.
18. Hệ thống không tạo căn trọ mới và không lưu dữ liệu không hợp lệ vào CSDL.
19. Quay lại bước 5 của Basic Flow để Chủ trọ chỉnh sửa thông tin.
    9.1. Lưu thông tin thất bại
20. Hệ thống thông báo không thể lưu thông tin căn trọ.
21. Hệ thống không tạo căn trọ mới; dữ liệu đã tồn tại trước đó trong CSDL được giữ nguyên.
22. Kết thúc UC.

USE CASE 03.R: Xem / Tra cứu – căn trọ
Mô tả
Cho phép Chủ trọ xem danh sách căn trọ, tìm kiếm theo tên/địa chỉ, lọc theo trạng thái hoạt động và xem thông tin chi tiết của từng căn.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống
  - Kết nối cơ sở dữ liệu ổn định.
    Hậu điều kiện
    Thông tin được hiển thị theo luồng gốc.
    Actor chính
    Chủ trọ
    Actor phụ
    Không
    Basic Flow
    Chủ trọ
    Hệ thống

1. Chọn “Quản lý căn trọ”.

2. Hiển thị danh sách căn trọ.
3. Chọn căn trọ muốn xem.

4. Hiển thị Tên căn, Địa chỉ, Mô tả, Quy định chung, Hình ảnh tổng quan.
   Alternative flow
   2.1. Chưa có căn trọ
5. Hệ thống không tìm thấy căn trọ nào trong CSDL.
6. Hệ thống hiển thị danh sách trống.
7. Hệ thống thông báo: “Hiện chưa có căn trọ nào”.
   4.Quay lại bước 2.
   2.2. Tìm kiếm căn trọ
8. Chủ trọ nhập từ khóa tìm kiếm theo tên căn hoặc địa chỉ.
9. Hệ thống tìm kiếm và hiển thị danh sách căn trọ phù hợp.
10. Nếu không có kết quả, hệ thống thông báo: “Không tìm thấy căn trọ phù hợp”.
11. Chủ trọ có thể nhập lại từ khóa tìm kiếm.
12. Khi có kết quả, Chủ trọ chọn căn trọ muốn xem.
13. Tiếp tục tại bước 4 của Basic Flow.
    Exception flow
    2.1. Không thể truy xuất danh sách căn trọ
14. Hệ thống thông báo không thể tải danh sách căn trọ.
15. Hệ thống không thay đổi dữ liệu trong CSDL.
16. Kết thúc UC.
    4.1. Không thể tải thông tin chi tiết căn trọ
17. Hệ thống thông báo không thể tải thông tin chi tiết căn trọ.
18. Hệ thống không thay đổi dữ liệu trong CSDL.
19. Kết thúc UC..

USE CASE 03.U: Cập nhật / Chỉnh sửa – căn trọ
Mô tả
Cho phép Chủ trọ chỉnh sửa thông tin của căn trọ và cập nhật trạng thái hoạt động (Đang hoạt động / Ngừng hoạt động).
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống.
- Căn trọ cần chỉnh sửa đã tồn tại trong hệ thống.
  Hậu điều kiện
- Thông tin và trạng thái hoạt động mới của căn trọ được lưu vào CSDL.
- Dữ liệu phòng, hợp đồng và lịch sử thanh toán của căn không bị mất hoặc thay đổi.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý căn trọ”.

2. Hiển thị danh sách căn trọ.
3. Chọn căn cần sửa.

4. Chọn “Chỉnh sửa”

5. Hiển thị biểu mẫu chứa thông tin căn trọ hiện tại.
6. Chỉnh sửa các thông tin căn trọ.

7. Chọn “Lưu”.

8. Kiểm tra tính hợp lệ của dữ liệu.

9. Lưu thông tin đã chỉnh sửa vào CSDL.

10. Cập nhật danh sách căn trọ.
    Alternative flow
    6.1. Hủy chỉnh sửa căn trọ
11. Chủ trọ dừng chỉnh sửa thông tin căn trọ.
12. Chủ trọ chọn “Hủy”.
13. Hệ thống hiện thông tin trước khi chỉnh.
14. Quay lại bước 2.
    Exception flow
    8.1. Thông tin sửa không hợp lệ
15. Hệ thống tìm thấy thông tin không hợp lệ.
16. Hệ thống thông báo thao tác không thành công;
17. Hệ thống giữ nguyên dữ liệu trước đó.
18. Quay lại bước 6.
    9.1. Lỗi lưu thông tin
19. Hệ thống thông báo lưu thông tin không thành công.
20. Hệ thống giữ nguyên thông tin căn trọ đã lưu trước đó.
21. Kết thúc UC.

USE CASE 05.C: Tạo / Ghi nhận – khách thuê
Mô tả
Tạo / Ghi nhận thông tin trong chức năng “Quản lý khách thuê” theo luồng đã đặc tả.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống với quyền quản lý.
  Hậu điều kiện
  Dữ liệu được tạo hoặc ghi nhận theo kết quả của luồng gốc.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý khách thuê”.

2. Hiển thị danh sách khách thuê.
3. Chọn “Thêm khách thuê”.

4. Hiển thị biểu mẫu nhập hồ sơ.
5. Nhập thông tin khách thuê.

6. Chọn “Lưu hồ sơ”.

7. Kiểm tra thông tin hợp lệ.

8. Tạo mã khách thuê và lưu hồ sơ vào CSDL.

9. Cập nhật danh sách và thông báo thành công.
   Alternative flow
   2.1. Chưa có khách thuê
10. Hệ thống không tìm thấy khách thuê trong CSDL.
11. Hiển thị danh sách trống.
12. Hệ thống thông báo chưa có khách thuê.
13. Tiếp tục bước 3.
    Exception flow
    7.1. Dữ liệu hồ sơ không hợp lệ
14. Hệ thống phát hiện thông tin không hợp lệ
15. Hệ thống thông báo lỗi.
16. Hệ thống không tạo hồ sơ khách thuê mới.
17. Hệ thống không lưu dữ liệu vào CSDL.
18. Hệ thống giữ lại thông tin đã nhập trên biểu mẫu để Chủ trọ chỉnh sửa.
19. Quay lại bước 5 của Basic Flow.
    8.1. Lưu hồ sơ thất bại
20. Hệ thống thông báo lưu hồ sơ khách thuê không thành công.
21. Hệ thống không tạo hồ sơ khách thuê mới trong CSDL.
22. Dữ liệu đã tồn tại trước đó trong CSDL vẫn được giữ nguyên.
23. Hệ thống giữ lại thông tin đã nhập trên biểu mẫu để Chủ trọ có thể thử lưu lại.
24. Kết thúc UC

USE CASE 05.R: Xem / Tra cứu – khách thuê
Mô tả
Xem / Tra cứu thông tin trong chức năng “Quản lý khách thuê” theo luồng đã đặc tả.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống với quyền quản lý.
  Hậu điều kiện
  Thông tin được hiển thị theo luồng gốc.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý khách thuê”.

2. Hiển thị danh sách khách thuê.
3. Chọn khách thuê cần xem.

4. Hiển thị thông tin hồ sơ khách thuê.
   Alternative flow
   2.1. Chưa có khách thuê
5. Hệ thống không tìm thấy khách thuê nào trong CSDL.
6. Hệ thống hiển thị danh sách trống.
7. Quay lại bước 1.
   2.2. Tìm kiếm khách thuê
8. Chủ trọ nhập từ khóa tìm kiếm theo họ tên, số điện thoại hoặc CCCD.
9. Hệ thống tìm kiếm và hiển thị danh sách khách thuê phù hợp.
10. Nếu không có kết quả, hệ thống thông báo “Không tìm thấy khách thuê phù hợp”.
11. Nếu có kết quả, Chủ trọ chọn khách thuê cần xem.
12. Tiếp tục tại bước 4 của Basic Flow.
    4.1. Xem lịch sử thuê
13. Chủ trọ chọn chức năng “Xem lịch sử” của khách thuê.
14. Hệ thống hiển thị các căn trọ, phòng và hợp đồng khách thuê đã hoặc đang thuê, gồm căn trọ, phòng, mã hợp đồng, thời gian thuê và trạng thái hợp đồng.
15. Chủ trọ xác nhận thông tin.
16. Quay lại bước 4.
    Exception flow
    2.1. Không thể truy xuất danh sách khách thuê
17. Hệ thống thông báo không thể tải danh sách khách thuê.
18. Hệ thống không thay đổi dữ liệu trong CSDL.
19. Hệ thống giữ nguyên màn hình hiện tại.
20. Kết thúc UC.
    4.1. Không thể truy xuất hồ sơ khách thuê
21. Hệ thống thông báo không thể tải thông tin hồ sơ khách thuê.
22. Hệ thống không thay đổi dữ liệu trong CSDL.
23. Hệ thống giữ nguyên màn hình hiện tại.
24. Kết thúc UC

USE CASE 05.U: Cập nhật / Chỉnh sửa – khách thuê
Mô tả
Cập nhật / Chỉnh sửa thông tin trong chức năng “Quản lý khách thuê” theo luồng đã đặc tả.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống với quyền quản lý.
  Hậu điều kiện
  Dữ liệu hoặc trạng thái được cập nhật theo luồng gốc.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic Flow
  Chủ trọ
  Hệ thống

1. Chọn “Quản lý khách thuê”.

2. Hiển thị danh sách khách thuê.
3. Chọn khách thuê cần “Chỉnh sửa”

4. CHọn “Chỉnh sửa”

5. Hiển thị biểu mẫu với dữ liệu hồ sơ hiện tại.
6. Chỉnh sửa thông tin hồ sơ khách thuê.

7. Chọn “Lưu hồ sơ”.

8. Kiểm tra tính hợp lệ của dữ liệu.

9. Lưu thay đổi vào CSDL và cập nhật danh sách khách thuê.
   Alternative flow
   6.1. Hủy chỉnh sửa khách thuê
10. Chủ trọ dừng thao tác sửa hồ sơ.
11. Chủ trọ chọn hủy thao tác sửa.
    3.Hệ thống giữ nguyên thông tin cũ.
12. Quay lại bước 2.
    Exception flow
    8.1. Dữ liệu chỉnh sửa không hợp lệ
13. Hệ thống phát hiện dữ liệu không hợp lệ.
14. Hệ thống thông báo lỗi tương ứng.
15. Hệ thống không cập nhật CSDL.
16. Hệ thống giữ nguyên hồ sơ đã lưu trước đó..
17. Hệ thống giữ nội dung đang sửa trên biểu mẫu nếu hỗ trợ.
18. Quay lại bước 6 của Basic Flow.
    9.1. Lưu dữ liệu không thành công
19. Hệ thống thông báo cập nhật hồ sơ không thành công.
20. Hệ thống giữ nguyên hồ sơ đã lưu trước đó.
21. Kết thúc UC

USE CASE 12: Theo dõi thanh toán
Tiền điều kiện

- Khách thuê đã đăng nhập thành công vào hệ thống.
- Khách thuê đang có hợp đồng thuê còn hiệu lực.
- Hệ thống đã phát sinh khoản phải trả.
  Hậu điều kiện
- Khách thuê xem được danh sách khoản phải trả, số tiền đã thanh toán, số tiền còn nợ và lịch sử thanh toán.
- Nếu có thực hiện thanh toán, biên lai được lưu vào hệ thống với trạng thái "Chờ xác nhận".
  Actor chính
  Khách thuê
  Actor phụ
  Không
  Basic Flow
  Khách thuê
  Hệ thống

1. Chọn chức năng “Theo dõi thanh toán”.
2. Hiển thị chi tiết các chi phí đang cần thanh toán của kỳ hiện tại (tiền phòng, tiền điện nước, phí dịch vụ, công nợ cũ, tổng tiền, số tiền đã thanh toán, số tiền còn lại).
3. Chọn chức năng "Xem lịch sử giao dịch".
4. Hiển thị chi tiết khoản đã trả: tiền phòng, tiền điện nước, phí dịch vụ, tổng tiền phải trả, số tiền đã thanh toán, và số tiền còn lại (công nợ).

5. Nhấn “Quay lại”.
6. Đưa người dùng về màn hình chi tiết chi phí kỳ hiện tại.
   Alternative flow
   2.1. Chọn xem khoản phải trả của một kỳ khác
7. Khách thuê chọn tháng/năm cần xem.
8. Hệ thống hiển thị chi tiết thanh toán của kỳ được chọn.
9. Quay lại bước 2 của Basic Flow.
   2.2. Khách thuê nộp minh chứng thanh toán
10. Khách thuê chọn chức năng "Nộp minh chứng".
11. Hệ thống hiển thị biểu mẫu nộp biên lai.
12. Khách thuê tải lên hình ảnh biên lai thanh toán.
13. Khách thuê nhấn nút "Xác nhận".
14. Hệ thống kiểm tra tính hợp lệ của hình ảnh đính kèm.
15. Hệ thống lưu biên lai vào CSDL.
16. Hệ thống cập nhật trạng thái thanh toán thành "Chờ xác nhận".
17. Hệ thống hiển thị thông báo "Nộp minh chứng thành công".
18. Quay lại bước 2 của Basic Flow.

Exception flow
2.2.1. Hình ảnh minh chứng không hợp lệ

1. Hệ thống phát hiện chưa có hình ảnh minh chứng hoặc định dạng ảnh bị lỗi.
2. Hệ thống thông báo yêu cầu tải lại hình ảnh hợp lệ.
3. Hệ thống không lưu dữ liệu.
4. Quay lại thao tác tải hình ảnh của luồng 2.2
   2.2.2 Lỗi khi lưu minh chứng
5. Hệ thống thông báo thao tác không thành công, trạng thái thanh toán giữ nguyên.
6. Kết thúc use case.

VI

USE CASE 17: Quản lý sự cố
Use case 17 được phân rã thành 4 use case nhỏ. Mỗi use case có một đặc tả, một sơ đồ Activity và một sơ đồ Sequence. Actor chính của cả 4 use case là Chủ trọ; actor phụ: Không.
Mã
Use case
Thao tác
Mục tiêu

Xem sự cố
Đọc (R)
Tra cứu danh sách và chi tiết sự cố theo trạng thái.
17.1
Phê duyệt sự cố
Nghiệp vụ
Tiếp nhận báo cáo hợp lý, chuyển sang “Đang xử lý”.
17.2
Cập nhật kết quả xử lý sự cố
Cập nhật (U)
Ghi kết quả, chi phí, đối tượng chịu chi phí; chuyển sang “Đã xử lý”.
17.3
Xóa sự cố không hợp lý
Xóa (D)
Loại bỏ báo cáo không hợp lý khi chưa được tiếp nhận.

17.2 Phê duyệt sự cố
17.2 Đặc tả use case

17.2.2 Sơ đồ Activity

17.2.3 Sơ đồ Sequence

17.3 Cập nhật kết quả xử lý sự cố
17.3.1 Đặc tả use case

17.3.2 Sơ đồ Activity

17.3.3 Sơ đồ Sequence

17.4 Xóa sự cố không hợp lý
17.4.1 Đặc tả use case

17.3.2 Sơ đồ Activity

17.3.3 Sơ đồ Sequence

USE CASE 18: Gửi thông báo sự cố

Mã
Use case
Thao tác
Mục tiêu
18.1
Gửi thông báo sự cố
Tạo (C)
Gửi sự cố mới đến Chủ trọ, trạng thái “Chờ tiếp nhận”.
18.2
Chỉnh sửa sự cố
Cập nhật (U)
Sửa thông tin sự cố đã gửi khi chưa được tiếp nhận.

18.1 Gửi thông báo sự cố
18.1.1 Đặc tả use case

18.1.2 Sơ đồ Activity

18.1.3 Sơ đồ Sequence

18.2 Chỉnh sửa thông tin sự cố

18.2.2 Sơ đồ Activity

18.2.3 Sơ đồ Sequence

USE CASE 19: Thống kê báo cáo

Mã
Use case
Thao tác
Mục tiêu
19.1
Xem doanh thu
Đọc (R)
Xem tổng doanh thu theo loại khoản thu và theo căn.
19.2
Xem chi phí
Đọc (R)
Xem tổng chi phí theo loại, theo căn và chi phí chung.
19.3
Xem lợi nhuận
Đọc (R)
Xem lợi nhuận = doanh thu − chi phí.
19.4
So sánh các căn
Đọc (R)
So sánh doanh thu, chi phí, lợi nhuận giữa các căn.

Đối chiếu với các chức năng ở chương 1
Chức năng ở chương 1
Được thể hiện ở
Xem doanh thu
Use case 19.1
Xem chi phí
Use case 19.2
Xem lợi nhuận
Use case 19.3
So sánh các căn
Use case 19.4
Xem hiệu quả từng căn
Phạm vi “một căn” ở 19.1, 19.2, 19.3 và Alternative flow 9.1 của 19.4
Lọc theo tháng/quý/năm
Bước 4–6 (bộ lọc kỳ báo cáo), Alternative flow thay đổi kỳ và Exception flow 6.1 của cả 4 use case
Ghi nhận khoản chi mới
Ngoài phạm vi use case 19 (use case riêng)

19.1 Xem doanh thu
19.1.1 Đặc tả use case

19.1.2 Sơ đồ Activity

19.1.3 Sơ đồ Sequence

19.2 Xem chi phí

19.2.2 Sơ đồ Activity

19.2.3 Sơ đồ Sequence

19.3 Xem lợi nhuận
19.3.1 Đặc tả use case

19.3.2 Sơ đồ Activity

19.3.3 Sơ đồ Sequence

19.4 So sánh các căn
19.4.1 Đặc tả use case

19.4.2 Sơ đồ Activity

19.4.3 Sơ đồ Sequence

TUẤN
USE CASE 10: Quản lý tiền điện
USE CASE 10.1: Xem chỉ số điện
Mô tả
Cho phép chủ trọ xem danh sách phòng và tình trạng ghi nhận chỉ số điện theo kỳ, căn trọ; chọn phòng để xem chi tiết chỉ số điện, ảnh minh chứng, trạng thái xác nhận, đơn giá, lượng điện tiêu thụ và tiền điện.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống.
- Hệ thống đã có thông tin căn trọ, phòng và hợp đồng tương ứng thuộc phạm vi quản lý của chủ trọ.
  Hậu điều kiện
- Thông tin chỉ số điện được hiển thị nếu có dữ liệu.
- Không làm thay đổi dữ liệu trong CSDL.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic flow
  Chủ trọ
  Hệ thống

1. Chọn chức năng “Quản lý tiền điện”.
2. Hiển thị giao diện quản lý tiền điện gồm danh sách kỳ và căn trọ.
3. Chọn kỳ và căn trọ cần xem.
4. Hiển thị danh sách phòng thuộc căn trọ và tình trạng ghi nhận chỉ số điện trong kỳ được chọn.
5. Chọn phòng cần xem chi tiết.
6. Hiển thị chỉ số điện kỳ trước, chỉ số kỳ được chọn, ảnh minh chứng nếu có, trạng thái xác nhận, đơn giá điện áp dụng trong kỳ, lượng điện tiêu thụ và tiền điện.
   Alternative flow
   6.1. Phòng chưa có chỉ số điện kỳ hiện tại
7. Hệ thống hiển thị chỉ số điện kỳ trước và đơn giá điện áp dụng trong kỳ.
8. Hệ thống hiển thị thông báo “Không tìm thấy dữ liệu kỳ hiện tại”.
9. Hệ thống chưa hiển thị lượng điện tiêu thụ và tiền điện.
10. Kết thúc Use Case.
    Exception flow

USE CASE 10.2: Thêm chỉ số điện
Mô tả
Cho phép chủ trọ thêm chỉ số điện cho phòng bằng cách tải ảnh công tơ điện. Hệ thống kiểm tra ảnh, sử dụng OCR để nhận diện chỉ số điện và lưu thông tin sau khi chủ trọ xác nhận.
Tiền điều kiện
– Chủ trọ đã đăng nhập thành công.
– Chủ trọ chọn chức năng “Quản lý tiền điện”.
– Chủ trọ đã chọn phòng và kỳ cần thêm chỉ số điện.
– Phòng chưa có chỉ số điện trong kỳ được chọn.
– Hệ thống đã có chỉ số điện kỳ trước và đơn giá điện theo hợp đồng.
Hậu điều kiện

- Chỉ số điện được lưu vào CSDL sau khi xác nhận thành công.
- Nếu lưu thất bại, chỉ số điện không được ghi nhận.
  Actor chính
  Chủ trọ
  Actor phụ
  OCR
  Basic flow
  Chủ trọ
  Hệ thống

1. Chọn “Thêm” chỉ số điện.
2. Hiển thị biểu mẫu thêm chỉ số điện gồm: chỉ số điện kỳ trước, đơn giá điện, ô tải ảnh và ô chỉ số điện kỳ hiện tại.
3. Tải ảnh công tơ điện.
4. Kiểm tra tính hợp lệ của ảnh; gửi ảnh đến dịch vụ OCR để nhận dạng và kiểm tra kết quả nhận dạng.

5. Hiển thị ảnh cùng chỉ số điện đọc được.
6. Nhấn “Xác nhận”.
7. Lưu chỉ số điện của phòng trong kỳ được chọn vào CSDL.

8. Hiển thị thông báo “Xác nhận thành công”.
   Alternative flow
   4.1. Hình ảnh không hợp lệ
9. Hệ thống phát hiện hình ảnh tải lên không hợp lệ.
10. Hệ thống hiển thị thông báo “Hình ảnh không hợp lệ”.
11. Quay lại bước 3 của Basic flow.
    4.2. Không thể nhận diện chỉ số điện
12. Hệ thống không nhận dạng được chỉ số điện từ ảnh.
13. Hệ thống hiển thị thông báo “Không thể nhận diện ảnh! Vui lòng thử lại.”.
14. Quay lại bước 3 của Basic flow.
    Exception flow
    7.1. Lỗi khi lưu chỉ số điện
15. Hệ thống không thể lưu chỉ số điện vào CSDL.
16. Hiển thị thông báo “Thêm thất bại! Vui lòng thử lại sau”.
17. Kết thúc Use Case.

UC 10.3: Cập nhật chỉ số điện
Mô tả
Cho phép chủ trọ cập nhật chỉ số điện đã ghi nhận của phòng. Hệ thống kiểm tra tính hợp lệ của chỉ số mới, tính lại lượng điện tiêu thụ và tiền điện, sau đó lưu thông tin khi chủ trọ xác nhận.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống.
- Chủ trọ chọn chức năng “Quản lý tiền điện”.
- Chủ trọ đang ở giao diện quản lý tiền điện.
- Bản ghi chỉ số điện cần cập nhật đã tồn tại trong hệ thống.
  Hậu điều kiện
- Chỉ số điện mới, lượng điện tiêu thụ và tiền điện được cập nhật vào CSDL nếu thành công.
- Nếu cập nhật thất bại, dữ liệu cũ được giữ nguyên.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic flow
  Chủ trọ
  Hệ thống

1. Chọn “Chỉnh sửa” bản ghi chỉ số điện.
2. Hiển thị ô chỉnh sửa trực tiếp bản ghi chỉ số điện.
3. Nhập chỉ số điện mới.
4. Kiểm tra tính hợp lệ của chỉ số điện mới.

5. Hiển thị chỉ số điện mới, tính lại lượng điện tiêu thụ và tiền điện.
6. Nhấn “Xác nhận”.
7. Cập nhật chỉ số điện mới, lượng điện tiêu thụ và tiền điện vào CSDL.

8. Hiển thị thông báo “Cập nhật thành công”.
   Alternative flow
   4.1. Chỉ số điện không hợp lệ
9. Hệ thống phát hiện chỉ số điện mới không hợp lệ.
10. Hệ thống hiển thị thông báo “Chỉ số điện không hợp lệ”.
11. Quay lại bước 3 của Basic flow.
    Exception flow
    7.1. Lỗi khi cập nhật chỉ số điện
12. Hệ thống không thể cập nhật thông tin vào CSDL.
13. Hệ thống giữ nguyên dữ liệu cũ.
14. Hiển thị thông báo “Cập nhật thất bại! Vui lòng thử lại sau”.
15. Kết thúc Use Case.

USE CASE 10.4: Xóa chỉ số điện
Mô tả
Cho phép chủ trọ xóa bản ghi chỉ số điện của phòng trong kỳ được chọn. Hệ thống yêu cầu xác nhận trước khi xóa và cập nhật hiển thị sau khi xóa thành công.
Tiền điều kiện
– Chủ trọ đã đăng nhập thành công vào hệ thống.
– Chủ trọ chọn chức năng “Quản lý tiền điện”.
– Chủ trọ đang ở giao diện Quản lý tiền điện.
– Bản ghi chỉ số điện cần xóa đã tồn tại trong hệ thống.
Hậu điều kiện
– Bản ghi chỉ số điện được xóa khỏi CSDL.
– Phòng được hiển thị trạng thái “Chưa có chỉ số điện” cho kỳ tương ứng.
– Nếu hủy thao tác hoặc xóa thất bại, dữ liệu cũ được giữ nguyên.
Actor chính
Chủ trọ
Actor phụ
Không
Basic flow
Chủ trọ
Hệ thống

1. Chọn bản ghi chỉ số điện cần xóa.

2. Chọn “Xóa”.
3. Hiển thị hộp thoại yêu cầu xác nhận xóa, gồm thông tin phòng, kỳ và chỉ số điện cần xóa.
4. Chọn “Xóa” để xác nhận.
5. Xóa bản ghi chỉ số điện khỏi CSDL.

6. Hiển thị thông báo “Xóa thành công”.

7. Hiển thị “Phòng chưa có chỉ số điện”.
   Alternative flow
   3.1. Chủ trọ hủy xóa chỉ số điện
8. Chủ trọ chọn “Hủy” trong hộp thoại xác nhận.
9. Hệ thống đóng hộp thoại và trở về màn hình xem thông tin điện của phòng.
10. Kết thúc Use Case.
    Exception flow
    5.1. Lỗi khi xóa chỉ số điện
11. Hệ thống không thể xóa bản ghi chỉ số điện khỏi CSDL.
12. Hệ thống giữ nguyên dữ liệu cũ.
13. Hiển thị thông báo “Xóa không thành công! Vui lòng thử lại”.
14. Kết thúc Use Case.

USE CASE 11: Quản lý thanh toán
UC11.1 – Xem thông tin thanh toán
Mô tả
Cho phép chủ trọ xem thông tin thanh toán của các phòng theo kỳ (tháng, năm) và căn trọ, bao gồm các khoản phải thanh toán, tổng tiền, số tiền đã thanh toán, số tiền còn nợ và trạng thái thanh toán.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống.
- Căn trọ và phòng cần xem đã tồn tại trong hệ thống.
  Hậu điều kiện
- Thông tin thanh toán được hiển thị nếu có dữ liệu.
- Không làm thay đổi dữ liệu trong CSDL.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic flow
  Chủ trọ
  Hệ thống

1. Chọn chức năng “Quản lý thanh toán”.
2. Hiển thị giao diện quản lý thanh toán gồm kỳ (tháng, năm) và danh sách căn trọ.
3. Chọn kỳ và căn trọ cần xem.
4. Hiển thị danh sách thông tin thanh toán của các phòng thuộc căn trọ trong kỳ được chọn.
5. Chọn “Xem chi tiết” tại phòng cần xem.
6. Hiển thị thông tin chi tiết gồm tên phòng, kỳ thanh toán, các khoản phải thanh toán, tổng tiền, số tiền đã thanh toán, số tiền còn nợ và trạng thái thanh toán.
7. Kiểm tra thông tin.

8. Nhấn “Đóng”.
9. Hiển thị lại danh sách thông tin thanh toán của các phòng.
   Alternative flow
   4.1. Chưa có thông tin thanh toán trong kỳ được chọn
10. Hệ thống hiển thị thông báo “Chưa có thông tin thanh toán trong kỳ được chọn”.
11. Kết thúc Use Case.
    Exception flow

UC11.2 – Cập nhật thông tin thanh toán
Mô tả
Cho phép chủ trọ cập nhật tổng số tiền thực tế khách thuê đã thanh toán trong kỳ. Hệ thống kiểm tra tính hợp lệ của số tiền, tính lại số tiền còn nợ và trạng thái thanh toán, sau đó lưu thông tin khi chủ trọ xác nhận.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống.
- Chủ trọ đang ở giao diện quản lý thanh toán.
- Thông tin thanh toán của phòng trong kỳ cần cập nhật đã tồn tại trong hệ thống.
  Hậu điều kiện
- Số tiền đã thanh toán, số tiền còn nợ và trạng thái thanh toán được cập nhật vào CSDL nếu thành công.
- Nếu chủ trọ hủy thao tác hoặc cập nhật thất bại, dữ liệu cũ được giữ nguyên.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic flow
  Chủ trọ
  Hệ thống

1. Chọn “Cập nhật” tại phòng cần cập nhật thông tin thanh toán.
2. Hiển thị ô chỉnh sửa số tiền đã thanh toán, tổng tiền phải thanh toán và số tiền đã thanh toán đang lưu.
3. Nhập tổng số tiền thực tế khách thuê đã thanh toán trong kỳ.
4. Kiểm tra tính hợp lệ của số tiền nhập vào.

5. Tính lại số tiền còn nợ và trạng thái thanh toán; hiển thị kết quả để chủ trọ kiểm tra.
6. Nhấn “Xác nhận”.
7. Cập nhật thông tin thanh toán vào CSDL.

8. Hiển thị thông báo “Cập nhật thành công”.

9. Hiển thị thông tin thanh toán đã cập nhật.
   Alternative flow
   4.1. Số tiền đã thanh toán không hợp lệ
10. Hệ thống hiển thị thông báo “Số tiền nhập không hợp lệ”.
11. Nhập lại số tiền đã thanh toán.
12. Quay lại bước 4 của Basic Flow.
    6.1. Chủ trọ hủy thao tác cập nhật
13. Nhấn “Hủy”.
14. Hệ thống bỏ các thay đổi và hiển thị lại bảng thông tin thanh toán các phòng đang lưu.
15. Kết thúc Use Case.
    Exception flow
    7.1. Lỗi khi cập nhật thông tin thanh toán
16. Hệ thống không thể cập nhật thông tin thanh toán vào CSDL.
17. Hệ thống giữ nguyên thông tin thanh toán trước cập nhật.
18. Hiển thị thông báo “Không thể lưu thông tin thanh toán. Vui lòng thử lại”.
19. Kết thúc Use Case.

UC11.3 – Xóa thông tin thanh toán
Mô tả
Cho phép chủ trọ xóa thông tin ghi nhận thanh toán của phòng trong kỳ được chọn. Hệ thống yêu cầu xác nhận trước khi xóa, đưa số tiền đã thanh toán về 0 và cập nhật danh sách thanh toán.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống.
- Chủ trọ đang ở giao diện quản lý thanh toán.
- Thông tin thanh toán cần xóa đã tồn tại trong hệ thống.
  Hậu điều kiện
- Thông tin ghi nhận thanh toán được xóa và số tiền đã thanh toán trở về 0 nếu thành công.
- Danh sách thanh toán được cập nhật.
- Nếu hủy thao tác hoặc xóa thất bại, dữ liệu cũ được giữ nguyên.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic flow
  Chủ trọ
  Hệ thống

1. Chọn “Xóa thông tin thanh toán” tại phòng cần xử lý.
2. Hiển thị hộp thoại xác nhận gồm tên phòng, kỳ, tổng tiền phải thanh toán, số tiền đã thanh toán và thông báo số tiền đã thanh toán sẽ trở về 0.
3. Chọn “Xóa” để xác nhận.
4. Xóa thông tin ghi nhận thanh toán.

5. Lưu thay đổi vào CSDL.

6. Hiển thị thông báo “Xóa thông tin thanh toán thành công” và cập nhật danh sách thanh toán các phòng.
   Alternative flow
   3.1. Chủ trọ hủy thao tác xóa
7. Chọn “Hủy”.
8. Đóng hộp thoại xác nhận và hiển thị lại danh sách thanh toán các phòng.
9. Kết thúc Use Case.
   Exception flow
   5.1. Lỗi khi xóa thông tin thanh toán
10. Hệ thống không thể lưu thay đổi vào CSDL.
11. Hệ thống giữ nguyên dữ liệu thanh toán trước khi xóa.
12. Hiển thị thông báo “Không thể xóa thông tin thanh toán. Vui lòng thử lại”.
13. Kết thúc Use Case.

UC16 – Phê duyệt yêu cầu
Mô tả
Cho phép chủ trọ xem và phê duyệt các yêu cầu của khách thuê đang ở trạng thái “Chờ phê duyệt”. Hệ thống cập nhật trạng thái yêu cầu và thông báo kết quả xử lý.
Tiền điều kiện

- Chủ trọ đã đăng nhập thành công vào hệ thống.
- Chủ trọ có quyền phê duyệt yêu cầu.
  Hậu điều kiện
- Yêu cầu được cập nhật trạng thái thành “Đã phê duyệt” nếu thành công.
- Nếu phê duyệt thất bại, trạng thái yêu cầu được giữ nguyên.
  Actor chính
  Chủ trọ
  Actor phụ
  Không
  Basic flow
  Chủ trọ
  Hệ thống

1. Chọn chức năng “Phê duyệt yêu cầu”.
2. Hiển thị danh sách các yêu cầu đang ở trạng thái “Chờ phê duyệt”.
3. Chọn một yêu cầu cần xử lý.
4. Hiển thị chi tiết nội dung yêu cầu.
5. Chọn “Phê duyệt”.
6. Cập nhật trạng thái yêu cầu thành “Đã phê duyệt” trong CSDL.

7. Hiển thị thông báo “Phê duyệt yêu cầu thành công”.
   Alternative flow
   2.1. Không có yêu cầu chờ phê duyệt
8. Hệ thống hiển thị thông báo “Không có yêu cầu chờ phê duyệt nào”.
9. Kết thúc Use Case.
   Exception flow
   6.1. Lỗi khi phê duyệt yêu cầu
10. Hệ thống không thể cập nhật trạng thái yêu cầu vào CSDL.
11. Hệ thống giữ nguyên trạng thái yêu cầu trước khi phê duyệt.
12. Hiển thị thông báo “Không thể phê duyệt yêu cầu”.
13. Kết thúc Use Case.
