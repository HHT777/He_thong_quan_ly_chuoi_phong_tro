PHÂN TÍCH YÊU CẦU BÀI TOÁN
CHƯƠNG 1: PHÂN TÍCH YÊU CẦU CỦA BÀI TOÁN

1. Mục đích
   Dự án xây dựng hệ thống quản lý chuỗi phòng trọ nhằm hỗ trợ chủ trọ chuyển từ phương thức quản lý bằng nhiều file Excel và hợp đồng giấy sang một hệ thống quản lý tập trung.
   Hệ thống hướng đến việc số hóa và hỗ trợ các nghiệp vụ chính gồm: quản lý căn trọ, phòng trọ, khách thuê, tài khoản khách thuê, hợp đồng, tiền cọc, tiền điện, khoản phải thu, phiếu thu, thanh toán, công nợ, sự cố sửa chữa, trả phòng, thu chi và thống kê báo cáo.
   Đối với khách thuê, hệ thống cung cấp kênh để xem hợp đồng, theo dõi các khoản phải thanh toán và lịch sử thanh toán, nộp minh chứng thanh toán, nhập chỉ số điện, gửi yêu cầu gia hạn hoặc trả phòng, báo sự cố, đề xuất bạn cùng phòng và đặt lại mật khẩu.
   Mục tiêu của hệ thống là:
   • Giảm thao tác quản lý thủ công.
   • Tập trung hóa dữ liệu.
   • Hạn chế sai sót trong quá trình tính tiền và theo dõi thanh toán.
   • Hỗ trợ theo dõi công nợ.
   • Hỗ trợ quản lý hợp đồng và thời hạn thuê.
   • Giảm thời gian ghi nhận chỉ số điện.
   • Hỗ trợ chủ trọ theo dõi doanh thu, chi phí và lợi nhuận của từng căn cũng như toàn bộ chuỗi.
   • Bảo toàn lịch sử dữ liệu về hợp đồng, thanh toán, điện và sự cố để phục vụ đối chiếu và truy vết.
2. Phạm vi
   2.1. Phạm vi trong hệ thống
   Hệ thống được xây dựng dựa trên quy mô hiện tại gồm 3 căn trọ, mỗi căn có nhiều phòng và khách thuê, đồng thời có khả năng mở rộng khi quy mô kinh doanh tăng.
   Đối với Chủ trọ
   Hệ thống hỗ trợ các chức năng:
   • Quản lý tài khoản khách thuê.
   • Quản lý căn trọ.
   • Quản lý phòng.
   • Quản lý khách thuê.
   • Quản lý hợp đồng (bao gồm tiền cọc, gia hạn trực tiếp và thanh lý hợp đồng).
   • Quản lý tiền điện.
   • Quản lý thanh toán và công nợ.
   • Lập phiếu thu.
   • Phê duyệt yêu cầu (gia hạn, trả phòng).
   • Xử lý trả phòng.
   • Quản lý sự cố.
   • Xử lý đề xuất bạn cùng phòng.
   • Ghi nhận khoản chi và thống kê báo cáo.
   Đối với Khách thuê
   Hệ thống hỗ trợ các chức năng:
   • Đặt lại mật khẩu.
   • Xem hợp đồng.
   • Đề xuất bạn cùng phòng.
   • Nhập chỉ số điện.
   • Theo dõi thanh toán và nộp minh chứng thanh toán.
   • Yêu cầu gia hạn hợp đồng.
   • Yêu cầu trả phòng.
   • Gửi thông báo sự cố.
   Chức năng chung
   Đăng nhập, đăng xuất, nhận thông báo và nhật ký thao tác trên dữ liệu quan trọng, áp dụng cho cả hai nhóm người dùng.
   2.2. Stakeholder
   Hệ thống có hai actor chính:
   • Chủ trọ: quản lý thông tin phòng trọ, khách thuê, hợp đồng, tài khoản, điện, thanh toán, công nợ, phiếu thu, sự cố, trả phòng, thu chi và báo cáo.
   • Khách thuê: sử dụng hệ thống để theo dõi các thông tin liên quan đến việc thuê phòng và thực hiện các thao tác được cho phép.
   Dịch vụ nhận dạng chỉ số điện (OCR) là hệ thống bên ngoài, tham gia với vai trò actor phụ khi Chủ trọ thêm chỉ số điện bằng hình ảnh và hỗ trợ chức năng nhập chỉ số điện của Khách thuê. Đây không phải là người dùng của hệ thống.
   Người quản lý căn không phải actor riêng của hệ thống. Người này vẫn sử dụng tài khoản khách thuê thông thường và chỉ được chủ trọ giao thêm một số công việc hỗ trợ thực tế bên ngoài hệ thống.
   2.3. Phạm vi ngoài hệ thống
   Các hoạt động sau không được hệ thống trực tiếp thực hiện:
   • Việc giao nhận hoặc chuyển tiền thực tế giữa khách thuê và chủ trọ (tiền phòng, tiền điện, tiền nước, phí dịch vụ, tiền cọc).
   • Việc gặp mặt trực tiếp giữa chủ trọ và khách thuê.
   • Việc thương lượng giá thuê, đơn giá điện, đơn giá nước hoặc phí dịch vụ.
   • Thợ sửa chữa thực hiện công việc sửa chữa thực tế.
   • Người quản lý căn trực tiếp mở khóa hoặc hỗ trợ thợ sửa chữa.
   • Hoạt động của sale hoặc người giới thiệu khách.
   • Chức năng tìm kiếm phòng như một nền tảng môi giới phòng trọ.
   • Việc hoàn tiền cọc thực tế.
   • Việc kiểm tra thực tế phòng và tài sản khi khách trả phòng (hệ thống chỉ ghi nhận kết quả kiểm tra).
   Hệ thống chỉ ghi nhận kết quả của các hoạt động thực tế khi cần phục vụ quản lý.
   Đối với thanh toán, giao dịch tiền diễn ra bên ngoài hệ thống. Khách thuê có thể gửi minh chứng thanh toán, còn Chủ trọ là người xác nhận và cập nhật thông tin thanh toán chính thức trên hệ thống.
3. Mô tả bài toán
   3.1. Giới thiệu tổ chức của khách hàng
   Khách hàng hiện đang quản lý 3 căn trọ, mỗi căn có nhiều phòng và nhiều khách thuê.
   Chủ trọ chịu trách nhiệm chính trong việc quản lý căn, phòng, khách thuê, hợp đồng, tiền cọc, tiền điện, các khoản phải thu, thanh toán, công nợ, chi phí và tình hình kinh doanh.
   Tại mỗi căn có thể có một khách thuê được giao thêm nhiệm vụ hỗ trợ quản lý căn. Người này vẫn là khách thuê bình thường và không có vai trò hệ thống riêng.
   Người quản lý căn có thể hỗ trợ các công việc thực tế như mở khóa, hỗ trợ khi thợ sửa chữa đến hoặc nhận tiền trong một số trường hợp. Chủ trọ có thể áp dụng khoản giảm tiền phòng cho người này; khoản giảm được ghi nhận là khoản giảm trừ và tính trực tiếp vào số tiền phải thanh toán của kỳ (không ghi trùng thành chi phí quản lý căn).
   3.2. Tình trạng hiện tại
   Hiện tại khách hàng chưa sử dụng phần mềm quản lý phòng trọ chuyên biệt.
   Quản lý bằng Excel
   Mỗi căn đang được quản lý bằng một file Excel riêng để ghi nhận tiền phòng, thanh toán, chi phí và các khoản phát sinh.
   Việc sử dụng nhiều file riêng biệt khiến:
   • Dữ liệu bị phân tán.
   • Khó đối chiếu giữa các căn.
   • Khó tổng hợp công nợ.
   • Khó xác định doanh thu, chi phí và lợi nhuận toàn chuỗi.
   • Tăng nguy cơ nhập sai hoặc thiếu dữ liệu.
   Quản lý hợp đồng
   Hợp đồng hiện được lập và lưu trữ chủ yếu bằng giấy.
   Việc này gây khó khăn trong:
   • Tra cứu thông tin hợp đồng.
   • Theo dõi thời hạn.
   • Theo dõi tiền cọc.
   • Theo dõi thay đổi đơn giá.
   • Theo dõi các thông tin phát sinh liên quan đến hợp đồng (vi phạm, thay đổi đơn giá).
   • Xử lý gia hạn và trả phòng.
   Ghi nhận chỉ số điện
   Hàng tháng chủ trọ phải ghi nhận chỉ số điện từng phòng để tính tiền.
   Quy trình hiện tại:
   Ghi chỉ số điện → Đối chiếu phòng → Tính lượng sử dụng → Tính tiền điện → Ghi vào Excel.
   Đây là một trong những công việc tốn nhiều thời gian.
   Hệ thống tương lai cho phép khách thuê chụp hình công tơ điện. Hệ thống sử dụng OCR để nhận dạng chỉ số, khách thuê kiểm tra kết quả trước khi gửi và Chủ trọ là người xác nhận chỉ số cuối cùng. Trong trường hợp chưa có dữ liệu từ khách thuê, Chủ trọ có thể tự thêm chỉ số bằng hình ảnh hoặc nhập trực tiếp.
   Quản lý thanh toán
   Hiện tại Chủ trọ phải tự theo dõi:
   • Tổng số tiền phải thanh toán.
   • Số tiền khách đã thanh toán.
   • Số tiền còn thiếu.
   • Các phòng chưa thanh toán.
   • Các phòng thanh toán một phần.
   • Công nợ chưa xử lý.
   Khi số lượng phòng tăng, việc theo dõi thủ công dễ gây nhầm lẫn và khó đối chiếu.
   Quản lý phiếu thu
   Việc lập và gửi thông tin tiền phải thanh toán chưa được tự động hóa hoàn toàn.
   Hệ thống tương lai cho phép Chủ trọ:
   • Xem các phiếu thu đã lập.
   • Chỉnh sửa phiếu thu.
   • Tạo thủ công phiếu thu còn thiếu.
   • Thiết lập thời gian để hệ thống tự động lập và gửi phiếu thu theo kỳ.
   Quản lý sự cố và chi phí
   Sự cố hiện được trao đổi và xử lý chủ yếu thông qua giao tiếp trực tiếp hoặc các kênh liên lạc riêng.
   Các khoản chi phí như:
   • Chi phí sửa chữa.
   • Chi phí quản lý căn.
   • Hoa hồng giới thiệu khách.
   • Chi phí thay thế thiết bị.
   • Các chi phí khác.
   cần được tập trung và phân loại để phục vụ báo cáo.
   3.3. Các vấn đề khách hàng gặp phải
   Các vấn đề chính gồm:
   • Dữ liệu quản lý bị phân tán trong nhiều file Excel.
   • Ghi nhận và tính tiền điện hàng tháng mất nhiều thời gian.
   • Hợp đồng được quản lý chủ yếu bằng giấy.
   • Khó theo dõi số tiền đã thanh toán và số tiền còn nợ của từng phòng.
   • Khó theo dõi các trường hợp thanh toán một phần.
   • Khó kiểm soát công nợ quá hạn.
   • Việc lập và gửi phiếu thu còn phụ thuộc nhiều vào thao tác thủ công.
   • Khó theo dõi thời hạn hợp đồng và các yêu cầu gia hạn hoặc trả phòng.
   • Khó quản lý tình trạng xử lý sự cố.
   • Khó xác định trách nhiệm chi phí sửa chữa.
   • Khó quản lý và phân loại chi phí theo từng căn.
   • Khó xác định doanh thu, chi phí và lợi nhuận từng căn và toàn chuỗi.
   • Khó đối chiếu tiền cọc, công nợ và các khoản khấu trừ khi khách trả phòng.
   3.4. Định hướng hệ thống tương lai
   Hệ thống tương lai tập trung hóa các thông tin và quy trình nghiệp vụ hiện đang được quản lý thủ công.
   Quy trình tổng quát đối với Chủ trọ
   Quản lý căn → Quản lý phòng → Quản lý khách thuê → Quản lý hợp đồng và cọc → Quản lý tài khoản → Quản lý tiền điện → Hình thành khoản phải thu → Lập phiếu thu → Quản lý thanh toán và công nợ → Quản lý sự cố và chi phí → Phê duyệt yêu cầu → Xử lý trả phòng → Thống kê báo cáo.
   Quy trình tổng quát đối với Khách thuê
   Đăng nhập (hoặc đặt lại mật khẩu khi quên) → Xem hợp đồng → Theo dõi thanh toán và nộp minh chứng → Nhập chỉ số điện → Gửi yêu cầu gia hạn/trả phòng → Gửi thông báo sự cố → Theo dõi trạng thái.
   Hệ thống không thay thế các hoạt động thực tế mà tập trung quản lý dữ liệu, trạng thái và kết quả nghiệp vụ.
4. Phân tích yêu cầu
   4.1. Xác định các quy trình nghiệp vụ
   Quy trình 1. Quản lý căn, phòng và khách thuê
   Chủ trọ tạo căn trọ → Tạo phòng thuộc căn → Ghi nhận hồ sơ khách thuê → Liên kết khách thuê với phòng và hợp đồng (thực hiện khi tạo hợp đồng) → Theo dõi trạng thái phòng và lịch sử thuê.
   • Căn trọ được lưu với tên căn, địa chỉ, mô tả, quy định chung, hình ảnh tổng quan; hệ thống tạo mã căn duy nhất và đặt trạng thái “Đang hoạt động”. Chủ trọ có thể chuyển căn sang “Ngừng hoạt động”; dữ liệu phòng, hợp đồng và lịch sử thanh toán của căn được giữ nguyên.
   • Phòng được tạo trong một căn với diện tích, giá thuê, số người tối đa, nội thất và trạng thái khởi tạo là “Trống”; hệ thống khởi tạo mã/số phòng.
   • Hồ sơ khách thuê gồm mã khách thuê (do hệ thống tạo), họ tên, số điện thoại, CCCD/CMND và các thông tin cần thiết khác. Chủ trọ có thể xem lịch sử thuê gồm căn, phòng, mã hợp đồng, thời gian thuê và trạng thái hợp đồng.
   • Trạng thái phòng được cập nhật theo quá trình sử dụng (BR-10) để phục vụ các chức năng hợp đồng, thanh toán và trả phòng.
   Quy trình 2. Quản lý hợp đồng và tiền cọc
   Chủ trọ tạo hợp đồng → Nhập thông tin phòng, khách thuê, thời hạn, giá thuê, tiền cọc, đơn giá điện, đơn giá nước, phí dịch vụ, số người ở và các điều khoản → Hệ thống kiểm tra → Lưu hợp đồng và thông tin tiền cọc → Phòng chuyển “Đang thuê” → Theo dõi trạng thái và thời hạn hợp đồng.
   Hợp đồng là nguồn dữ liệu để xác định:
   • Giá thuê.
   • Tiền cọc.
   • Đơn giá điện.
   • Đơn giá nước.
   • Phí dịch vụ.
   • Số người ở.
   • Các điều khoản liên quan.
   Hệ thống kiểm tra hợp đồng trước khi lưu: thông tin bắt buộc đầy đủ; ngày kết thúc phải lớn hơn ngày bắt đầu; số tiền cọc hợp lệ. Việc nhận tiền cọc diễn ra ngoài hệ thống; Chủ trọ cập nhật trạng thái tiền cọc trên hợp đồng (BR-33). Khi hợp đồng chưa có xác nhận đã nhận cọc, hệ thống thông báo chưa hoàn tất thanh toán tiền cọc và yêu cầu Chủ trọ cập nhật.
   Khi thay đổi đơn giá hoặc phí dịch vụ, việc thương lượng được thực hiện ngoài hệ thống. Sau khi hai bên thống nhất, Chủ trọ cập nhật thông tin trong hợp đồng; dữ liệu các kỳ trước được giữ nguyên (BR-11). Mọi thay đổi cần thiết được lưu lịch sử.
   Sau khi hợp đồng và tiền cọc được ghi nhận, Chủ trọ có thể cấp tài khoản cho khách thuê (BR-01). Hệ thống cảnh báo Chủ trọ và Khách thuê khi hợp đồng sắp hết hạn (BR-02).
   Quy trình 3. Gia hạn, trả phòng và phê duyệt yêu cầu
   Khách thuê xem hợp đồng → Gửi yêu cầu gia hạn hoặc yêu cầu trả phòng → Yêu cầu được lưu ở trạng thái “Chờ phê duyệt” và Chủ trọ nhận thông tin → Chủ trọ xem danh sách, xem chi tiết và phê duyệt yêu cầu → Hệ thống cập nhật trạng thái “Đã phê duyệt”, cập nhật dữ liệu theo loại yêu cầu và thông báo kết quả cho Khách thuê.
   Chức năng Phê duyệt yêu cầu chỉ xử lý hai loại yêu cầu: gia hạn và trả phòng. Trong phạm vi hiện tại không có luồng từ chối.
   Đối với yêu cầu gia hạn:
   Phê duyệt → Cập nhật ngày kết thúc của hợp đồng hiện tại theo thời gian gia hạn đã đề nghị → Lưu lịch sử gia hạn → Cập nhật trạng thái hợp đồng theo thời hạn mới.
   Không tạo hợp đồng mới khi khách tiếp tục thuê cùng phòng. Trường hợp hai bên thỏa thuận ngày kết thúc khác với đề nghị, hoặc gia hạn không xuất phát từ yêu cầu của khách, Chủ trọ gia hạn trực tiếp trên hợp đồng bằng chức năng Gia hạn hợp đồng (ngày kết thúc mới phải lớn hơn ngày kết thúc hiện tại; hợp đồng chưa thanh lý) và hệ thống vẫn lưu lịch sử gia hạn theo BR-21.
   Đối với yêu cầu trả phòng:
   Phê duyệt → Phòng chuyển “Đang xử lý trả phòng” → Chủ trọ thực hiện Quy trình 8 (Xử lý trả phòng và thanh lý hợp đồng).
   Yêu cầu đặt lại mật khẩu không đi qua phê duyệt của Chủ trọ; xem Quy trình 10.
   Quy trình 4. Quản lý và tính tiền điện
   Luồng do Khách thuê gửi chỉ số:
   Khách thuê chụp hình công tơ → Hệ thống kiểm tra định dạng và chất lượng hình ảnh → OCR nhận dạng chỉ số → So sánh với chỉ số kỳ trước (chỉ số nhỏ hơn kỳ trước bị từ chối) → Hiển thị hình ảnh và kết quả → Khách thuê xác nhận (hoặc tải lại ảnh nếu kết quả chưa chính xác) → Lưu chỉ số và hình ảnh minh chứng → Dữ liệu chuyển trạng thái “Chờ xác nhận” và Chủ trọ được thông báo → Chủ trọ kiểm tra → Chủ trọ xác nhận → Hệ thống tính lượng điện sử dụng và tiền điện → Lưu lịch sử.
   Luồng do Chủ trọ thêm chỉ số khi chưa có dữ liệu của kỳ:
   Chủ trọ chọn kỳ, căn, phòng chưa có chỉ số → Tải ảnh công tơ → Hệ thống kiểm tra ảnh và gửi dịch vụ OCR nhận dạng → Hiển thị ảnh và chỉ số đọc được → Chủ trọ xác nhận → Lưu chỉ số của phòng trong kỳ → Hệ thống tính lượng điện sử dụng và tiền điện.
   Chủ trọ cũng có thể xem thông tin điện theo kỳ và căn, chỉnh sửa chỉ số chưa chính xác (hệ thống tính lại lượng điện và tiền điện) hoặc xóa bản ghi chỉ số theo quy định tại BR-36.
   Công thức:
   • Lượng điện sử dụng = Chỉ số kỳ hiện tại − Chỉ số kỳ trước.
   • Tiền điện = Lượng điện sử dụng × Đơn giá điện theo hợp đồng.
   Đơn giá điện được lấy từ hợp đồng còn hiệu lực. Chỉ số kỳ trước của kỳ đầu tiên là chỉ số ban đầu tại thời điểm bắt đầu thuê (BR-41).
   Hệ thống không quản lý chỉ số đồng hồ nước.
   Tiền nước = Đơn giá nước theo hợp đồng × Số người đang ở trong phòng (BR-23, BR-34).
   Quy trình 5. Hình thành khoản phải thu và lập phiếu thu
   Sau khi các dữ liệu của kỳ đã đầy đủ (trong đó chỉ số điện của phòng đã được Chủ trọ xác nhận):
   Lấy thông tin hợp đồng → Tiền phòng → Tiền điện → Tiền nước → Phí dịch vụ → Phí phát sinh → Khoản giảm trừ → Xác định khoản phải thu.
   Công thức:
   Khoản phải thu = Tiền phòng + Tiền điện + Tiền nước + Phí dịch vụ + Phí phát sinh − Khoản giảm trừ
   • Phí phát sinh gồm phí sửa chữa do khách thuê chịu được cộng từ chức năng Quản lý sự cố (BR-37) và các phí phát sinh khác do Chủ trọ nhập.
   • Khoản giảm trừ gồm khoản giảm tiền phòng cho người quản lý căn (BR-09) và các khoản giảm khác do Chủ trọ nhập kèm ghi chú.
   Sau khi khoản phải thu được xác định, hệ thống sử dụng dữ liệu này để lập phiếu thu. Khoản phải thu của phòng trong kỳ là cơ sở để hình thành thông tin thanh toán mà Chủ trọ quản lý và Khách thuê theo dõi (Quy trình 6).
   Tại chức năng Lập phiếu thu, Chủ trọ có thể:
   • Xem danh sách phiếu thu đã lập theo căn và kỳ.
   • Xem thông tin chi tiết và chỉnh sửa phiếu thu đã lập.
   • Thiết lập thời gian lập và gửi phiếu thu tự động.
   • Tạo phiếu thu thủ công đối với các phòng chưa có phiếu thu (chọn một hoặc nhiều phòng).
   Việc hệ thống tự động lập và gửi phiếu thu khi đến thời gian đã thiết lập được quy định bằng Business Rule (BR-28, BR-29), không mô tả như một luồng thao tác trực tiếp của Chủ trọ trong Use Case. Phiếu thu chỉ được gửi đến Khách thuê sau khi đã được tạo và lưu thành công.
   Quy trình 6. Quản lý thanh toán và công nợ
   Khách thuê thực hiện thanh toán ngoài hệ thống.
   Khách thuê có thể tải minh chứng thanh toán lên hệ thống; minh chứng ở trạng thái “Chờ xác nhận” cho đến khi Chủ trọ kiểm tra và cập nhật thông tin thanh toán (BR-25).
   Chủ trọ quản lý thanh toán theo từng căn và kỳ (tháng, năm). Hệ thống hiển thị:
   • Tổng tiền phải thanh toán.
   • Số tiền đã thanh toán.
   • Số tiền còn nợ.
   • Trạng thái thanh toán.
   • Thông tin chi tiết khoản phải thanh toán của từng phòng.
   Chủ trọ cập nhật tổng số tiền thực tế khách thuê đã thanh toán trong kỳ; hệ thống kiểm tra số tiền, tính lại số tiền còn nợ và trạng thái thanh toán. Trường hợp ghi nhận sai, Chủ trọ có thể xóa thông tin thanh toán của phòng trong kỳ để đưa số tiền đã thanh toán về 0 (BR-36).
   Để thao tác nhanh khi toàn bộ phòng đã thanh toán, Chủ trọ có thể sử dụng chức năng “Tất cả đã đóng”; nếu một phòng chưa thanh toán đủ, Chủ trọ bỏ tích “Đã đóng” và cập nhật số tiền thực tế đã thanh toán. Đây là yêu cầu của khách hàng, hiện chưa có Use Case đặc tả.
   Trạng thái được xác định:
   • Số tiền đã thanh toán bằng 0 → Chưa thanh toán.
   • Số tiền đã thanh toán lớn hơn 0 nhưng nhỏ hơn tổng phải thanh toán → Thanh toán một phần.
   • Số tiền đã thanh toán bằng tổng phải thanh toán → Đã thanh toán.
   Nếu đã quá hạn và vẫn còn số tiền phải thanh toán, hệ thống ghi nhận số tiền còn thiếu vào công nợ (BR-19, BR-35).
   Khách thuê theo dõi: khoản phải thanh toán của kỳ hiện tại hoặc kỳ khác (tiền phòng, tiền điện nước, phí dịch vụ, công nợ cũ, tổng tiền, đã thanh toán, còn lại), lịch sử giao dịch và trạng thái xác nhận minh chứng.
   Quy trình 7. Quản lý sự cố và sửa chữa
   Khách thuê gửi sự cố (loại sự cố, mức độ ưu tiên, mô tả, hình ảnh; phòng/căn được xác định theo hợp đồng đang hiệu lực) → Hệ thống lưu với trạng thái “Chờ tiếp nhận” và thông báo Chủ trọ → Chủ trọ xem danh sách và chi tiết → Chủ trọ tiếp nhận (xác nhận hoặc điều chỉnh loại sự cố và mức độ ưu tiên; hệ thống lưu người tiếp nhận, thời điểm tiếp nhận) → Trạng thái chuyển “Đang xử lý” → Xác định thiết bị hoặc tài sản liên quan → Tiến hành xử lý thực tế (ngoài hệ thống) → Ghi nhận kết quả xử lý, thiết bị thay thế (nếu có), chi phí và đối tượng chịu chi phí → Hoàn tất → Trạng thái chuyển “Đã xử lý” và thông báo kết quả cho khách thuê đã báo.
   Chủ trọ cũng có thể tự tạo sự cố khi tự phát hiện mà không cần báo cáo từ khách thuê. Sự cố do Chủ trọ tự tạo được xem là đã tiếp nhận nên bắt đầu ở trạng thái “Đang xử lý”.
   Nếu sự cố vẫn ở trạng thái “Chờ tiếp nhận”, khách thuê có thể chỉnh sửa loại sự cố, mức độ ưu tiên, mô tả và hình ảnh; hệ thống ghi nhận thời điểm chỉnh sửa. Nếu sự cố đã chuyển sang “Đang xử lý” hoặc “Đã xử lý”, khách thuê chỉ theo dõi trạng thái và kết quả.
   Đối với báo cáo không hợp lý, trùng lặp hoặc không liên quan khi còn “Chờ tiếp nhận” và chưa có dữ liệu xử lý hay khoản tài chính liên kết, Chủ trọ xóa sự cố kèm lý do; báo cáo được đánh dấu đã xóa (xóa mềm), không còn trong danh sách thông thường và hệ thống lưu lý do, người xóa, thời điểm xóa.
   Về chi phí: nếu chi phí sửa chữa thuộc trách nhiệm Chủ trọ, khoản chi được ghi cho căn/phòng liên quan và chuyển sang Quản lý thu chi; nếu thuộc trách nhiệm khách thuê gây hư hỏng, khoản chi phí được cộng vào kỳ thanh toán gần nhất chưa hoàn thành của khách đó (BR-18, BR-37).
   Quy trình 8. Xử lý trả phòng và thanh lý hợp đồng
   Yêu cầu trả phòng được phê duyệt → Phòng chuyển “Đang xử lý trả phòng” → Chủ trọ mở màn hình xử lý trả phòng (thông tin khách thuê, phòng, hợp đồng, tiền cọc, điện, tài sản, công nợ) → Nhập chỉ số điện cuối kỳ và chốt tiền điện → Xác định tiền nước kỳ cuối → Kiểm tra phòng và tài sản (ghi nhận hư hỏng, mất mát và chi phí bồi thường nếu thuộc trách nhiệm khách) → Kiểm tra công nợ → Đối chiếu vi phạm và điều khoản hợp đồng → Xác định khoản khấu trừ → Tính tiền cọc còn được hoàn (BR-38) → Thanh lý hợp đồng (trạng thái “Đã thanh lý”) → Phòng chuyển “Trống” → Khóa quyền truy cập của khách thuê → Giữ lại lịch sử thuê.
   Tiền nước không được chốt bằng chỉ số đồng hồ mà được xác định theo quy tắc tính tiền nước đang áp dụng (BR-23).
   Công nợ của khách thuê được khấu trừ vào tiền cọc; hệ thống không chặn thanh lý chỉ vì còn công nợ nhưng không cho thanh lý khi thông tin bắt buộc chưa đầy đủ (BR-06).
   Trong trường hợp hợp đồng được thanh lý ngoài luồng yêu cầu trả phòng (ví dụ chấm dứt hợp đồng theo thỏa thuận), Chủ trọ sử dụng chức năng Thanh lý hợp đồng trong Quản lý hợp đồng, áp dụng cùng quy tắc tại BR-06 và BR-38. Việc hoàn tiền cọc thực tế được thực hiện ngoài hệ thống.
   Quy trình 9. Quản lý thu chi và báo cáo
   Hệ thống tổng hợp các khoản thu đã được ghi nhận từ quá trình thanh toán (BR-39).
   Chi phí gồm:
   • Chi phí sửa chữa được ghi nhận từ Quản lý sự cố khi Chủ trọ chịu chi phí.
   • Chi phí quản lý căn.
   • Hoa hồng.
   • Chi phí thay thế thiết bị.
   • Chi phí phát sinh khác do Chủ trọ nhập.
   Khoản chi liên quan trực tiếp đến căn nào được gắn với căn đó. Khoản chi chung được ghi nhận ở cấp toàn chuỗi (BR-07).
   Hệ thống tổng hợp:
   Doanh thu → Chi phí → Lợi nhuận → Lọc theo tháng/quý/năm → Xem theo toàn chuỗi hoặc một căn → Xem chi tiết khoản thu, khoản chi → So sánh giữa các căn đang hoạt động.
   Công thức:
   Lợi nhuận = Tổng doanh thu − Tổng chi phí
   Phạm vi toàn chuỗi gồm cả chi phí chung; phạm vi một căn chỉ gồm chi phí gắn với căn đó. Lợi nhuận âm được hiển thị là lỗ. Khi so sánh các căn, chi phí chung toàn chuỗi không chia cho từng căn mà hiển thị riêng.
   Quy trình 10. Tài khoản, đăng nhập và đặt lại mật khẩu
   Chủ trọ chọn khách thuê cần cấp tài khoản → Hệ thống kiểm tra thông tin và điều kiện cấp tài khoản (BR-01) → Tạo tài khoản với số điện thoại làm tên đăng nhập, mật khẩu mặc định “1” → Lưu tài khoản và thông báo thành công.
   Khi cần ngừng quyền truy cập, Chủ trọ khóa tài khoản đang “Đang hoạt động”: hệ thống vô hiệu hóa quyền đăng nhập, cập nhật trạng thái “Đã khóa” và vẫn giữ lại thông tin tài khoản. Tài khoản không bị xóa (BR-17). Khi khách thuê quay lại thuê theo hợp đồng mới và đáp ứng BR-01, Chủ trọ cập nhật trạng thái tài khoản về “Đang hoạt động”.
   Đặt lại mật khẩu (tự động, không cần Chủ trọ phê duyệt):
   Khách thuê chọn “Quên mật khẩu” → Nhập số điện thoại đã đăng ký → Hệ thống kiểm tra số điện thoại → Tạo yêu cầu đặt lại mật khẩu → Cập nhật mật khẩu tạm thời “1” → Thông báo thành công → Khách thuê đăng nhập bằng mật khẩu tạm thời → Hệ thống yêu cầu khởi tạo mật khẩu mới → Khách thuê nhập mật khẩu tạm thời, mật khẩu mới và xác nhận mật khẩu mới → Hệ thống kiểm tra, lưu mật khẩu mới và thông báo đổi mật khẩu thành công.
   Nếu số điện thoại không tồn tại, hệ thống từ chối tạo yêu cầu. Nếu mật khẩu mới và xác nhận không khớp, hệ thống yêu cầu nhập lại. Việc đặt lại mật khẩu không mở khóa tài khoản đã bị khóa (BR-40).
   Quy trình 11. Đề xuất bạn cùng phòng
   Khách thuê chọn chức năng → Hệ thống kiểm tra phòng còn khả năng tiếp nhận thêm người → Khách thuê nhập họ tên, số điện thoại và thông tin cần thiết của người được đề xuất → Hệ thống kiểm tra tính hợp lệ, đầy đủ và người được đề xuất chưa ở trong phòng → Hiển thị thông tin để khách thuê xác nhận → Lưu đề xuất ở trạng thái “Chờ xử lý” và thông báo Chủ trọ.
   Chủ trọ xem và xử lý đề xuất (chấp nhận hoặc từ chối). Khi chấp nhận, Chủ trọ cập nhật số người ở của phòng (BR-34), tạo hồ sơ khách thuê/tài khoản khi cần, cập nhật thông tin hợp đồng liên quan; hệ thống thông báo kết quả cho khách thuê đã đề xuất. Số người ở ảnh hưởng trực tiếp đến tiền nước của kỳ.
   4.2. Xác định yêu cầu chức năng
   Mỗi yêu cầu chức năng (FR) được đánh mã theo nhóm: FR-CT-xx (chức năng của Chủ trọ), FR-KT-xx (chức năng của Khách thuê), FR-CM-xx (chức năng chung). Cột “UC tham chiếu” cho biết yêu cầu được đặc tả tại Use Case nào; yêu cầu ghi “Ngoài UC” là yêu cầu của bài toán nhưng chưa có đặc tả Use Case trong giai đoạn này (do giới hạn thời gian thực hiện).
   4.2.1. Yêu cầu chức năng của Chủ trọ
   FR-CT-01. Quản lý tài khoản khách thuê
   Mã Nội dung yêu cầu UC tham chiếu
   FR-CT-01.1 Xem danh sách khách thuê và trạng thái tài khoản tương ứng. UC02.R
   FR-CT-01.2 Xem chi tiết: mã khách thuê, họ tên, số điện thoại, CCCD/CMND, trạng thái tài khoản. UC02.R
   FR-CT-01.3 Tạo tài khoản khách thuê: dùng số điện thoại làm tên đăng nhập, khởi tạo mật khẩu mặc định “1”, lưu tài khoản. UC02.C
   FR-CT-01.4 Kiểm tra trùng thông tin đăng nhập; nếu đã tồn tại thì từ chối tạo và thông báo “Tài khoản đã tồn tại.” UC02.C
   FR-CT-01.5 Kiểm tra điều kiện cấp tài khoản (hợp đồng và tiền cọc) và liên kết tài khoản với hồ sơ khách thuê theo BR-01. Ngoài UC (UC02.C chưa thể hiện)
   FR-CT-01.6 Khóa tài khoản đang “Đang hoạt động”: vô hiệu hóa quyền đăng nhập, lưu trạng thái “Đã khóa”, không xóa tài khoản; có bước hủy thao tác; không khóa lại tài khoản đã khóa. UC02.U
   FR-CT-01.7 Mở khóa tài khoản (Đã khóa → Đang hoạt động) khi khách thuê thuê lại theo hợp đồng mới, thực hiện tại chức năng cập nhật trạng thái tài khoản. Ngoài UC (mở rộng UC02.U)
   FR-CT-01.8 Lưu lịch sử trạng thái tài khoản (trạng thái, người thao tác, thời điểm). Ngoài UC

FR-CT-02. Quản lý căn trọ
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-02.1 Xem danh sách căn trọ (tên căn, địa chỉ, trạng thái hoạt động); thông báo “Hiện chưa có căn trọ nào” khi chưa có dữ liệu. UC03.R
FR-CT-02.2 Tìm kiếm căn trọ theo tên hoặc địa chỉ; lọc theo trạng thái hoạt động. UC03.R
FR-CT-02.3 Xem chi tiết căn: tên căn, địa chỉ, mô tả, quy định chung, hình ảnh tổng quan. UC03.R
FR-CT-02.4 Thêm căn trọ: kiểm tra dữ liệu, tạo mã căn duy nhất, lưu với trạng thái “Đang hoạt động”; cho phép hủy thêm. UC03.C
FR-CT-02.5 Chỉnh sửa thông tin căn trọ; cho phép hủy chỉnh sửa; lỗi lưu thì giữ nguyên dữ liệu cũ. UC03.U
FR-CT-02.6 Cập nhật trạng thái hoạt động (Đang hoạt động / Ngừng hoạt động); dữ liệu phòng, hợp đồng và lịch sử thanh toán của căn không bị mất hoặc thay đổi. UC03.U
FR-CT-02.7 Căn “Ngừng hoạt động” không nằm trong phạm vi so sánh các căn. UC03.U, UC19.4
FR-CT-02.8 Hệ thống không cung cấp thao tác xóa căn trọ đã phát sinh dữ liệu. Ngoài UC

FR-CT-03. Quản lý phòng
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-03.1 Xem danh sách căn, chọn căn để xem danh sách phòng thuộc căn; thông báo “Không có phòng trong căn trọ” khi căn chưa có phòng. UC04.R
FR-CT-03.2 Xem chi tiết phòng: thông tin phòng, giá thuê, trạng thái, nội thất. UC04.R
FR-CT-03.3 Thêm phòng: nhập diện tích, giá thuê, số người tối đa, nội thất, trạng thái khởi tạo (mặc định “Trống”); hệ thống khởi tạo mã/số phòng; dữ liệu không hợp lệ hoặc lưu lỗi thì không lưu. UC04.C
FR-CT-03.4 Chỉnh sửa thông tin phòng, giá thuê, nội thất; cho phép hủy; lỗi lưu thì giữ nguyên dữ liệu cũ. UC04.U
FR-CT-03.5 Quản lý nội thất của phòng (danh mục thiết bị/tài sản) làm cơ sở xác định tài sản khi báo sự cố và kiểm tra khi trả phòng. UC04.C, UC04.U; chi tiết danh mục: Ngoài UC
FR-CT-03.6 Theo dõi trạng thái phòng theo BR-10 (Trống, Đã giữ, Đang thuê, Đang xử lý trả phòng); trạng thái được cập nhật khi lưu hợp đồng (UC06.1), phê duyệt trả phòng (UC16), thanh lý/trả phòng (UC15, UC06.4). UC04.R; Ngoài UC (giữ phòng/hủy giữ)
FR-CT-03.7 Giá thuê của phòng là giá tham chiếu khi tạo hợp đồng mới; giá áp dụng cho khách đang thuê lấy từ hợp đồng (BR-11). Thay đổi giá phòng không làm thay đổi hợp đồng đang hiệu lực. Ngoài UC
FR-CT-03.8 Không xóa phòng đã phát sinh lịch sử hợp đồng, thuê hoặc giao dịch (BR-15); ngừng sử dụng phòng bằng trạng thái phù hợp. Ngoài UC

FR-CT-04. Quản lý khách thuê
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-04.1 Xem danh sách khách thuê; thông báo khi chưa có khách thuê. UC05.R, UC05.C
FR-CT-04.2 Tìm kiếm khách thuê theo họ tên, số điện thoại hoặc CCCD. UC05.R
FR-CT-04.3 Xem hồ sơ khách thuê. UC05.R
FR-CT-04.4 Xem lịch sử thuê: căn trọ, phòng, mã hợp đồng, thời gian thuê, trạng thái hợp đồng. UC05.R
FR-CT-04.5 Thêm hồ sơ khách thuê: kiểm tra dữ liệu, tạo mã khách thuê, lưu hồ sơ; lỗi thì giữ lại thông tin đã nhập. UC05.C
FR-CT-04.6 Chỉnh sửa hồ sơ khách thuê; cho phép hủy; lỗi thì giữ nguyên hồ sơ đã lưu. UC05.U
FR-CT-04.7 Liên kết khách thuê với phòng và hợp đồng thông qua việc chọn phòng, khách thuê khi tạo hợp đồng. UC06.1
FR-CT-04.8 Giữ lại hồ sơ và lịch sử thuê sau khi khách trả phòng (BR-17). UC15

FR-CT-05. Quản lý hợp đồng
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-05.1 Tạo hợp đồng: chọn phòng thuê, khách thuê; nhập ngày bắt đầu, ngày kết thúc, giá thuê và các điều khoản liên quan. UC06.1
FR-CT-05.2 Nhập và lưu tiền cọc, đơn giá điện, đơn giá nước, phí dịch vụ, số người ở của hợp đồng. UC06.1 (tiền cọc); Ngoài UC (đơn giá, phí, số người ở)
FR-CT-05.3 Kiểm tra trước khi lưu: thông tin bắt buộc; ngày kết thúc lớn hơn ngày bắt đầu (“Thời gian hợp đồng không hợp lệ.”); số tiền cọc hợp lệ (“Số tiền cọc không hợp lệ.”). UC06.1
FR-CT-05.4 Khi lưu thành công: cập nhật trạng thái hợp đồng, lưu thông tin tiền cọc; phòng chuyển “Đang thuê”. UC06.1; phòng: Ngoài UC
FR-CT-05.5 Cập nhật trạng thái tiền cọc (Chưa nhận/Đã nhận…); thông báo “Chưa hoàn tất thanh toán tiền cọc.” khi hợp đồng chưa có xác nhận đã nhận cọc (BR-33). UC06.1, UC06.2
FR-CT-05.6 Xem danh sách hợp đồng và thông tin cơ bản; xem chi tiết hợp đồng. UC06.3, UC06.4 (bước chọn hợp đồng)
FR-CT-05.7 Cập nhật hợp đồng (kể cả đơn giá điện, nước, phí dịch vụ sau khi hai bên thống nhất ngoài hệ thống); dữ liệu các kỳ trước được giữ nguyên (BR-11, BR-20). UC06.2
FR-CT-05.8 Gia hạn hợp đồng trực tiếp: nhập ngày kết thúc mới (phải lớn hơn ngày kết thúc hiện tại), hợp đồng chưa thanh lý; lưu thời hạn mới, cập nhật trạng thái; lưu lịch sử gia hạn (BR-21); cho phép hủy gia hạn. UC06.3 (lưu lịch sử gia hạn: Ngoài UC)
FR-CT-05.9 Thanh lý hợp đồng ngoài luồng yêu cầu trả phòng: nhập ngày thanh lý, tình trạng phòng, công nợ, số tiền hoàn cọc hoặc thu thêm; công nợ được khấu trừ vào tiền cọc (BR-38); số tiền hoàn cọc không âm và không lớn hơn số tiền cọc còn được hoàn; lỗi lưu thì không cập nhật dở dang. UC06.4
FR-CT-05.10 Theo dõi trạng thái và thời hạn hợp đồng (BR-33); cảnh báo Chủ trọ khi hợp đồng sắp hết hạn tối thiểu 1 tháng (BR-02). UC06.3; cảnh báo: Ngoài UC
FR-CT-05.11 Lưu lịch sử thay đổi thông tin hợp đồng cần thiết (giá, đơn giá, phí, thời hạn). Ngoài UC
FR-CT-05.12 Ghi nhận vi phạm hợp đồng gắn với nội dung và điều khoản liên quan (BR-24); thông tin này hiển thị cho khách thuê và dùng khi xử lý trả phòng. UC07, UC15 (sử dụng); ghi nhận: Ngoài UC
FR-CT-05.13 Chuyển phòng theo thỏa thuận: cập nhật thông tin thuê và giá phòng, bảo toàn lịch sử (BR-16). Ngoài UC
FR-CT-05.14 Không xóa hợp đồng đã hết hiệu lực hoặc đã thanh lý (BR-22). Ngoài UC

FR-CT-06. Quản lý tiền điện
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-06.1 Xem thông tin điện theo kỳ và căn: danh sách phòng và tình trạng ghi nhận chỉ số trong kỳ. UC10.1
FR-CT-06.2 Xem chi tiết điện của phòng: chỉ số kỳ trước, chỉ số kỳ chọn, ảnh minh chứng, trạng thái xác nhận, đơn giá điện, lượng điện tiêu thụ, tiền điện; khi chưa có dữ liệu kỳ hiện tại hiển thị “Không tìm thấy dữ liệu kỳ hiện tại”. UC10.1
FR-CT-06.3 Tiếp nhận chỉ số do khách thuê gửi (trạng thái “Chờ xác nhận”), nhận thông báo có chỉ số mới. UC09 (phía khách thuê); tiếp nhận phía Chủ trọ: Ngoài UC
FR-CT-06.4 Xem hình ảnh minh chứng và kiểm tra chỉ số do khách gửi. UC10.1
FR-CT-06.5 Xác nhận chỉ số điện do khách thuê gửi; chỉ số trở thành chính thức, hệ thống tính lượng điện và tiền điện, lưu lịch sử (BR-04). Ngoài UC
FR-CT-06.6 Thêm chỉ số cho phòng chưa có chỉ số trong kỳ bằng ảnh công tơ: kiểm tra ảnh, gửi OCR nhận dạng, hiển thị ảnh và chỉ số, lưu sau khi Chủ trọ xác nhận; thông báo khi ảnh không hợp lệ hoặc không nhận diện được. UC10.2
FR-CT-06.7 Chỉnh sửa chỉ số chưa chính xác: kiểm tra hợp lệ, tính lại lượng điện tiêu thụ và tiền điện, lưu khi xác nhận; lỗi thì giữ nguyên dữ liệu cũ. UC10.3
FR-CT-06.8 Xóa bản ghi chỉ số của phòng trong kỳ sau khi xác nhận; phòng hiển thị “Chưa có chỉ số điện” (BR-36). UC10.4
FR-CT-06.9 Tính lượng điện sử dụng = chỉ số kỳ hiện tại − chỉ số kỳ trước; tiền điện = lượng điện × đơn giá điện theo hợp đồng còn hiệu lực. UC10.1, UC10.3
FR-CT-06.10 Ghi nhận chỉ số ban đầu của hợp đồng làm chỉ số kỳ trước của kỳ đầu tiên (BR-41). Ngoài UC
FR-CT-06.11 Lưu lịch sử chỉ số và tiền điện. UC10.2, UC10.3

FR-CT-07. Quản lý thanh toán và công nợ
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-07.1 Xem thông tin thanh toán theo kỳ (tháng, năm) và căn: danh sách phòng; thông báo “Chưa có thông tin thanh toán trong kỳ được chọn” khi chưa có dữ liệu. UC11.1
FR-CT-07.2 Xem chi tiết khoản phải thanh toán của từng phòng: tên phòng, kỳ, các khoản phải thanh toán, tổng tiền, số tiền đã thanh toán, số tiền còn nợ, trạng thái thanh toán. UC11.1
FR-CT-07.3 Cập nhật tổng số tiền thực tế khách thuê đã thanh toán trong kỳ; kiểm tra số tiền hợp lệ (“Số tiền nhập không hợp lệ”). UC11.2
FR-CT-07.4 Tự động tính lại số tiền còn nợ và trạng thái thanh toán (Chưa thanh toán / Thanh toán một phần / Đã thanh toán) theo BR-19; hiển thị kết quả để Chủ trọ kiểm tra trước khi xác nhận; có thể hủy. UC11.2
FR-CT-07.5 Xóa thông tin ghi nhận thanh toán của phòng trong kỳ sau khi xác nhận; số tiền đã thanh toán trở về 0; lỗi thì giữ nguyên dữ liệu (BR-36). UC11.3
FR-CT-07.6 Xem minh chứng thanh toán do khách thuê tải lên; xác nhận minh chứng và cập nhật thông tin thanh toán chính thức (BR-25). Ngoài UC
FR-CT-07.7 Chức năng “Tất cả đã đóng” và ô tích “Đã đóng” để đánh dấu nhanh các phòng đã thanh toán đầy đủ (BR-19). Ngoài UC
FR-CT-07.8 Ghi nhận công nợ đối với phòng quá hạn còn nợ; theo dõi công nợ các kỳ trước (BR-19, BR-35). Ngoài UC (kết quả hiển thị tại UC11.1, UC12)
FR-CT-07.9 Lưu thông tin thanh toán và lịch sử cập nhật. UC11.2

FR-CT-08. Lập phiếu thu
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-08.1 Xem danh sách phiếu thu đã lập theo căn và kỳ. Ngoài UC
FR-CT-08.2 Xem thông tin phiếu thu: phòng, kỳ, tiền phòng, tiền điện, tiền nước, phí dịch vụ, phí phát sinh, khoản giảm trừ, khoản phải thu. Ngoài UC
FR-CT-08.3 Chỉnh sửa phiếu thu đã lập; không tạo thêm phiếu thu hợp lệ khác cho cùng phòng và cùng kỳ (BR-27). Ngoài UC
FR-CT-08.4 Tạo phiếu thu thủ công đối với phòng chưa có phiếu trong kỳ; cho phép chọn một hoặc nhiều phòng; chỉ hiển thị các phòng chưa có phiếu (BR-26). Ngoài UC
FR-CT-08.5 Nhập phí phát sinh và khoản giảm trừ (kèm ghi chú) khi lập hoặc chỉnh sửa phiếu thu. Ngoài UC
FR-CT-08.6 Tính khoản phải thu = tiền phòng + tiền điện + tiền nước + phí dịch vụ + phí phát sinh − khoản giảm trừ (BR-03); khoản phải thu là cơ sở của thông tin thanh toán ở FR-CT-07 và FR-KT-05. Ngoài UC
FR-CT-08.7 Thiết lập thời gian lập và gửi phiếu thu tự động theo kỳ (BR-28). Ngoài UC
FR-CT-08.8 Khi tự động lập: chỉ lập cho phòng chưa có phiếu và đã đủ dữ liệu của kỳ; phiếu lỗi không được gửi và các phòng còn lại vẫn được xử lý; Chủ trọ lập thủ công phiếu chưa tạo được (BR-29). Ngoài UC
FR-CT-08.9 Gửi phiếu thu đến khách thuê sau khi lưu thành công. Ngoài UC

FR-CT-09. Phê duyệt yêu cầu
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-09.1 Xem danh sách yêu cầu ở trạng thái “Chờ phê duyệt”; thông báo “Không có yêu cầu chờ phê duyệt nào” khi không có. UC16
FR-CT-09.2 Xem chi tiết nội dung yêu cầu. UC16
FR-CT-09.3 Phê duyệt yêu cầu: cập nhật trạng thái “Đã phê duyệt”; lỗi thì giữ nguyên trạng thái trước đó. UC16
FR-CT-09.4 Phê duyệt gia hạn: cập nhật ngày kết thúc của hợp đồng hiện tại và lưu lịch sử gia hạn, không tạo hợp đồng mới (BR-21). Ngoài UC (UC16 chưa thể hiện); UC13
FR-CT-09.5 Phê duyệt trả phòng: chuyển phòng sang “Đang xử lý trả phòng”, mở luồng xử lý trả phòng. Ngoài UC (UC16 chưa thể hiện); điều kiện đầu vào UC15
FR-CT-09.6 Gửi thông báo kết quả phê duyệt cho khách thuê. Ngoài UC
FR-CT-09.7 Chỉ xử lý yêu cầu gia hạn và trả phòng; không xử lý yêu cầu đặt lại mật khẩu; không có luồng từ chối trong phạm vi hiện tại (BR-30). UC16

FR-CT-10. Xử lý trả phòng
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-10.1 Tiếp nhận yêu cầu trả phòng đã “Đã phê duyệt” (phòng ở “Đang xử lý trả phòng”); hiển thị thông tin khách thuê, phòng, hợp đồng, tiền cọc, điện, tài sản, công nợ liên quan. UC15
FR-CT-10.2 Nhập chỉ số điện cuối kỳ và tính tiền điện cuối kỳ theo đơn giá điện trong hợp đồng. UC15
FR-CT-10.3 Xác định tiền nước kỳ cuối theo quy tắc tiền nước đang áp dụng (BR-23). Ngoài UC
FR-CT-10.4 Ghi nhận tình trạng phòng và tài sản; lưu kết quả kiểm tra. UC15
FR-CT-10.5 Ghi nhận hư hỏng hoặc mất mát: hạng mục, mô tả, chi phí bồi thường nếu thuộc trách nhiệm khách thuê. UC15 (5.1)
FR-CT-10.6 Ghi nhận vi phạm hợp đồng và khoản khấu trừ theo điều khoản hợp đồng liên quan (BR-24). UC15 (5.2)
FR-CT-10.7 Tổng hợp công nợ và các khoản được phép khấu trừ; tính số tiền cọc còn được hoàn theo BR-38. UC15
FR-CT-10.8 Không cho thanh lý khi thông tin bắt buộc chưa đầy đủ; hiển thị nội dung cần hoàn tất (BR-06). UC15 (14.1)
FR-CT-10.9 Thanh lý hợp đồng (“Đã thanh lý”), cập nhật phòng về “Trống”, khóa quyền truy cập của khách thuê. UC15
FR-CT-10.10 Giữ lại lịch sử thuê và dữ liệu liên quan; việc hoàn tiền cọc thực tế thực hiện ngoài hệ thống. UC15

FR-CT-11. Quản lý sự cố
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-11.1 Xem danh sách sự cố, lọc theo trạng thái. UC17 (Xem sự cố – chưa có đặc tả), UC17.2
FR-CT-11.2 Xem chi tiết sự cố gồm nội dung, hình ảnh, người gửi, thời điểm. UC17.1, UC17.2
FR-CT-11.3 Tiếp nhận (phê duyệt) sự cố “Chờ tiếp nhận”: xác nhận hoặc điều chỉnh loại sự cố và mức độ ưu tiên; lưu người tiếp nhận, thời điểm tiếp nhận; chuyển “Đang xử lý”; không phát sinh khoản chi hay khoản phải thu từ thao tác này. UC17.1
FR-CT-11.4 Tạo sự cố khi Chủ trọ tự phát hiện (không có báo cáo từ khách thuê); sự cố bắt đầu ở trạng thái “Đang xử lý”. Ngoài UC
FR-CT-11.5 Xác định thiết bị hoặc tài sản liên quan đến sự cố. Ngoài UC
FR-CT-11.6 Cập nhật kết quả xử lý cho sự cố “Đang xử lý”: kết quả xử lý (bắt buộc), thiết bị thay thế (nếu có), chi phí sửa chữa (số không âm), đối tượng chịu chi phí (mặc định “Chủ trọ”); chuyển “Đã xử lý”, ghi ngày hoàn tất. UC17.2
FR-CT-11.7 Chi phí do Chủ trọ chịu và lớn hơn 0: ghi khoản chi vận hành cho căn/phòng liên quan, chuyển sang thu chi và báo cáo. UC17.2
FR-CT-11.8 Chi phí do khách thuê chịu: xác định khách thuê gây hư hỏng, nhập căn cứ trách nhiệm, cộng khoản phí sửa chữa vào kỳ thanh toán gần nhất chưa hoàn thành của khách đó và cập nhật tổng số tiền phải thanh toán (BR-37); chi phí bằng 0 thì không phát sinh khoản tài chính. UC17.2 (7.1)
FR-CT-11.9 Gửi thông báo kết quả xử lý cho khách thuê đã báo sự cố. UC17.2
FR-CT-11.10 Xóa sự cố không hợp lý, trùng lặp hoặc không liên quan khi còn “Chờ tiếp nhận” và chưa có dữ liệu xử lý hay tài chính liên kết: bắt buộc nhập lý do; đánh dấu xóa; lưu lý do, người xóa, thời điểm xóa; không thay đổi dữ liệu tài chính. UC17.3
FR-CT-11.11 Các thao tác tiếp nhận, cập nhật kết quả, xóa được thực hiện trong một giao dịch; lỗi thì hủy toàn bộ và giữ nguyên trạng thái trước đó. UC17.1, UC17.2, UC17.3

FR-CT-12. Thống kê báo cáo và ghi nhận chi
Mã Nội dung yêu cầu UC tham chiếu
FR-CT-12.1 Xem doanh thu theo kỳ (tháng, quý, năm; mặc định tháng hiện tại) và phạm vi (toàn chuỗi hoặc một căn; mặc định toàn chuỗi): tổng doanh thu, theo loại khoản thu, theo từng căn. UC19.1
FR-CT-12.2 Xem chi tiết khoản thu: căn, phòng liên quan, loại khoản thu, số tiền, ngày ghi nhận. UC19.1
FR-CT-12.3 Xem chi phí theo kỳ và phạm vi: tổng chi phí, theo loại, theo từng căn, chi phí chung toàn chuỗi. UC19.2
FR-CT-12.4 Xem chi tiết khoản chi: căn hoặc toàn chuỗi, loại chi phí, số tiền, ngày phát sinh, ghi chú; khoản sửa chữa kèm sự cố liên quan. UC19.2
FR-CT-12.5 Xem lợi nhuận = tổng doanh thu − tổng chi phí (BR-08), lợi nhuận từng căn; lợi nhuận âm hiển thị là lỗ; xem chi tiết khoản thu, khoản chi cấu thành. UC19.3
FR-CT-12.6 So sánh doanh thu, chi phí, lợi nhuận giữa các căn đang hoạt động trong cùng kỳ (sắp xếp theo lợi nhuận giảm dần); chi phí chung toàn chuỗi hiển thị riêng; xem hiệu quả của một căn được chọn. UC19.4
FR-CT-12.7 Kiểm tra kỳ báo cáo hợp lệ (không nằm hoàn toàn trong tương lai); hiển thị báo cáo bằng 0 khi không có dữ liệu; thông báo khi không tổng hợp được. UC19.1 – UC19.4
FR-CT-12.8 Tự động tiếp nhận chi phí sửa chữa do Chủ trọ chịu từ Quản lý sự cố. UC17.2, UC19.2
FR-CT-12.9 Ghi nhận khoản chi thủ công: loại chi (quản lý căn, hoa hồng, thay thế thiết bị, chi phí khác), số tiền, ngày phát sinh, ghi chú; gắn với căn hoặc ghi ở cấp toàn chuỗi (BR-07). Ngoài UC (UC19 nêu “use case riêng”)
FR-CT-12.10 Doanh thu được tổng hợp theo quy tắc BR-39. UC19.1; Ngoài UC

4.2.2. Yêu cầu chức năng của Khách thuê
FR-KT-01. Đặt lại mật khẩu
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-01.1 Từ màn hình đăng nhập, chọn “Quên mật khẩu / Yêu cầu đặt lại mật khẩu” và hiển thị form khôi phục. UC01
FR-KT-01.2 Nhập số điện thoại đã đăng ký; hệ thống kiểm tra sự tồn tại; nếu không tồn tại thì từ chối và thông báo “Số điện thoại không tồn tại.” UC01
FR-KT-01.3 Hệ thống tạo yêu cầu, cập nhật mật khẩu tạm thời “1” cho tài khoản và thông báo đặt lại thành công; xử lý tự động, không cần Chủ trọ phê duyệt. UC01
FR-KT-01.4 Đăng nhập bằng mật khẩu tạm thời; hệ thống yêu cầu khởi tạo mật khẩu mới. UC01
FR-KT-01.5 Nhập mật khẩu tạm thời, mật khẩu mới và xác nhận mật khẩu mới; kiểm tra hai mật khẩu trùng nhau (nếu không khớp: “Mật khẩu xác nhận không khớp.”), lưu mật khẩu mới và thông báo đổi mật khẩu thành công. UC01
FR-KT-01.6 Tài khoản đã bị khóa không được đăng nhập; việc đặt lại mật khẩu không mở khóa tài khoản (BR-40). Ngoài UC

FR-KT-02. Xem hợp đồng
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-02.1 Xem trạng thái hợp đồng (đang còn hiệu lực, sắp hết hạn), mã hợp đồng, phòng thuê. UC07
FR-KT-02.2 Xem chi tiết: phòng thuê, ngày bắt đầu, ngày kết thúc, giá thuê và các điều khoản liên quan. UC07
FR-KT-02.3 Xem thông tin tiền cọc: số tiền cọc, ngày nhận cọc, trạng thái, số tiền đã hoàn hoặc bị khấu trừ (nếu có). UC07 (3.1)
FR-KT-02.4 Xem thông tin phát sinh liên quan hợp đồng: vi phạm nội quy, thay đổi đơn giá điện, nước; thông báo khi không có thông tin phát sinh. UC07 (5, 5.1)
FR-KT-02.5 Xem đơn giá điện, đơn giá nước, phí dịch vụ hiện hành theo hợp đồng. Ngoài UC
FR-KT-02.6 Nhận cảnh báo khi hợp đồng sắp hết hạn tối thiểu 1 tháng (BR-02). Ngoài UC
FR-KT-02.7 Lỗi truy xuất thì thông báo và không hiển thị dữ liệu không đầy đủ. UC07

FR-KT-03. Đề xuất bạn cùng phòng
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-03.1 Kiểm tra phòng còn khả năng tiếp nhận thêm người; nếu đã đủ số người thì thông báo “Phòng hiện không còn khả năng tiếp nhận thêm người.” và không cho gửi đề xuất. UC08
FR-KT-03.2 Nhập thông tin người được đề xuất: họ tên, số điện thoại và các thông tin cần thiết khác. UC08
FR-KT-03.3 Kiểm tra tính hợp lệ, đầy đủ; kiểm tra người được đề xuất chưa là thành viên của phòng (“Người được đề xuất đã ở trong phòng.”). UC08
FR-KT-03.4 Hiển thị thông tin đề xuất để khách thuê xác nhận gửi hoặc hủy. UC08
FR-KT-03.5 Lưu đề xuất ở trạng thái “Chờ xử lý” và gửi thông báo cho Chủ trọ; lỗi lưu thì không chuyển trạng thái. UC08
FR-KT-03.6 Theo dõi trạng thái xử lý của đề xuất (Chờ xử lý, Đã chấp nhận, Đã từ chối) và nhận thông báo kết quả. Ngoài UC

FR-KT-04. Nhập chỉ số điện
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-04.1 Chỉ thực hiện khi đã đến thời gian nhập chỉ số điện của kỳ, khách có phòng thuê hợp lệ và chỉ số kỳ trước đã tồn tại. UC09
FR-KT-04.2 Hiển thị thông tin phòng, chỉ số điện kỳ trước và chức năng tải ảnh công tơ. UC09
FR-KT-04.3 Tải hình ảnh công tơ điện; hệ thống kiểm tra định dạng và chất lượng; ảnh không hợp lệ thì thông báo lỗi và yêu cầu chọn ảnh khác. UC09
FR-KT-04.4 OCR nhận dạng chỉ số từ hình ảnh. UC09
FR-KT-04.5 So sánh chỉ số nhận dạng với chỉ số kỳ trước; nếu nhỏ hơn thì thông báo “Chỉ số điện không hợp lệ. Vui lòng kiểm tra lại hoặc tải ảnh khác.” và không cho xác nhận. UC09
FR-KT-04.6 Hiển thị hình ảnh cùng chỉ số đã nhận dạng để khách thuê kiểm tra; tải lại hình ảnh khi kết quả chưa chính xác. UC09
FR-KT-04.7 Xác nhận và gửi: lưu chỉ số và hình ảnh minh chứng, đặt trạng thái “Chờ xác nhận”, thông báo Chủ trọ; lỗi lưu thì thông báo “Gửi chỉ số điện không thành công”. UC09
FR-KT-04.8 Không cho gửi chỉ số mới khi kỳ đó đã ở trạng thái “Chờ xác nhận” hoặc đã được xác nhận (tránh dữ liệu trùng). Ngoài UC

FR-KT-05. Theo dõi thanh toán
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-05.1 Chỉ thực hiện khi khách có hợp đồng còn hiệu lực và hệ thống đã phát sinh khoản phải trả. UC12
FR-KT-05.2 Xem chi tiết khoản phải thanh toán của kỳ hiện tại: tiền phòng, tiền điện nước, phí dịch vụ, công nợ cũ, tổng tiền, số tiền đã thanh toán, số tiền còn lại. UC12
FR-KT-05.3 Xem khoản phải trả của kỳ khác (chọn tháng/năm). UC12 (2.1)
FR-KT-05.4 Xem lịch sử giao dịch: khoản đã trả, tổng phải trả, đã thanh toán, còn lại (công nợ). UC12
FR-KT-05.5 Nộp minh chứng thanh toán: tải ảnh biên lai, kiểm tra hợp lệ, lưu biên lai; minh chứng ở trạng thái “Chờ xác nhận”; lỗi thì không lưu và giữ nguyên trạng thái. UC12 (2.2)
FR-KT-05.6 Theo dõi trạng thái xác nhận minh chứng (Chờ xác nhận / Đã xác nhận). UC12
FR-KT-05.7 Hiển thị phí phát sinh và khoản giảm trừ của kỳ (nếu có) để đối chiếu với tổng phải thanh toán. Ngoài UC

FR-KT-06. Yêu cầu gia hạn hợp đồng
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-06.1 Chỉ thực hiện khi khách có hợp đồng còn hiệu lực và chưa thanh lý. UC13
FR-KT-06.2 Xem hợp đồng hiện tại (thời hạn, trạng thái) và chọn “Yêu cầu gia hạn hợp đồng”. UC13
FR-KT-06.3 Nhập thời gian muốn gia hạn và nội dung đề nghị; có thể thay đổi thời gian trước khi gửi. UC13
FR-KT-06.4 Kiểm tra tính hợp lệ (thiếu thông tin bắt buộc hoặc thời gian gia hạn không hợp lệ thì không lưu). UC13
FR-KT-06.5 Gửi yêu cầu: lưu với trạng thái “Chờ phê duyệt”, thông báo Chủ trọ và thông báo gửi thành công. UC13
FR-KT-06.6 Theo dõi kết quả phê duyệt và nhận thông báo. Ngoài UC
FR-KT-06.7 Không gửi trùng khi hợp đồng đang có yêu cầu gia hạn “Chờ phê duyệt”. Ngoài UC

FR-KT-07. Yêu cầu trả phòng
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-07.1 Xem hợp đồng hiện tại và chọn “Yêu cầu trả phòng”. Ngoài UC
FR-KT-07.2 Nhập ngày dự kiến trả phòng và nội dung yêu cầu; kiểm tra tính hợp lệ (ngày hợp lệ, hợp đồng còn hiệu lực). Ngoài UC
FR-KT-07.3 Gửi yêu cầu: lưu với trạng thái “Chờ phê duyệt”, thông báo Chủ trọ. Ngoài UC
FR-KT-07.4 Theo dõi kết quả phê duyệt; không gửi trùng khi đã có yêu cầu trả phòng “Chờ phê duyệt”. Ngoài UC

FR-KT-08. Gửi thông báo sự cố
Mã Nội dung yêu cầu UC tham chiếu
FR-KT-08.1 Xem danh sách sự cố đã gửi: mã sự cố, loại sự cố, mức độ ưu tiên, ngày gửi, trạng thái. UC18.1, UC18.2
FR-KT-08.2 Gửi sự cố mới: hệ thống tự xác định phòng/căn theo hợp đồng đang hiệu lực; chọn loại sự cố, mức độ ưu tiên, nhập mô tả, đính kèm hình ảnh (nếu có). UC18.1
FR-KT-08.3 Kiểm tra thông tin; lưu sự cố “Chờ tiếp nhận” kèm thời gian gửi, người gửi, phòng/căn; gửi thông báo cho Chủ trọ trong một giao dịch; lỗi thì không tạo sự cố. UC18.1
FR-KT-08.4 Chỉnh sửa loại sự cố, mức độ ưu tiên, mô tả, hình ảnh khi sự cố còn “Chờ tiếp nhận”; ghi nhận thời điểm chỉnh sửa; trạng thái giữ nguyên. UC18.2
FR-KT-08.5 Theo dõi trạng thái và kết quả xử lý; sau khi sự cố được tiếp nhận chỉ được xem, không chỉnh sửa (BR-32). UC18.2
FR-KT-08.6 Nhận thông báo kết quả xử lý sự cố. UC17.2

4.2.3. Yêu cầu chức năng chung
FR-CM. Chức năng chung
Mã Nội dung yêu cầu UC tham chiếu
FR-CM.1 Đăng nhập bằng tên đăng nhập (số điện thoại) và mật khẩu; phân quyền theo vai trò Chủ trọ / Khách thuê; từ chối tài khoản “Đã khóa”. Ngoài UC
FR-CM.2 Đăng xuất. Ngoài UC
FR-CM.3 Quản lý thông báo: gửi đúng đối tượng, hạn chế trùng lặp, người dùng xem được thông báo của mình (chỉ số điện mới, yêu cầu mới, kết quả phê duyệt, phiếu thu, kết quả sự cố, cảnh báo hết hạn…). Ngoài UC
FR-CM.4 Cảnh báo hợp đồng sắp hết hạn tối thiểu 1 tháng trước ngày hết hạn cho cả Chủ trọ và Khách thuê (BR-02). Ngoài UC
FR-CM.5 Nhật ký thao tác đối với dữ liệu quan trọng (sửa/xóa chỉ số điện, thông tin thanh toán, hợp đồng, trạng thái tài khoản): người thao tác, thời điểm, giá trị trước và sau. Ngoài UC

4.2.4. Ma trận đối chiếu Use Case và yêu cầu chức năng
Bảng dưới đây cho biết mỗi Use Case đã đặc tả được thể hiện ở nhóm FR nào; các FR ghi “Ngoài UC” trong các bảng trên là phần bài toán yêu cầu nhưng chưa có đặc tả Use Case.
UC Tên Use Case Actor chính Nhóm FR
UC01 Đặt lại mật khẩu Khách thuê FR-KT-01
UC02.C/R/U Quản lý tài khoản khách thuê Chủ trọ FR-CT-01
UC03.C/R/U Quản lý căn trọ Chủ trọ FR-CT-02
UC04.C/R/U Quản lý phòng Chủ trọ FR-CT-03
UC05.C/R/U Quản lý khách thuê Chủ trọ FR-CT-04
UC06.1 – 06.4 Tạo, cập nhật, gia hạn, thanh lý hợp đồng Chủ trọ FR-CT-05
UC07 Xem hợp đồng Khách thuê FR-KT-02
UC08 Đề xuất bạn cùng phòng Khách thuê FR-KT-03
UC09 Nhập chỉ số điện Khách thuê FR-KT-04, FR-CT-06
UC10.1 – 10.4 Quản lý tiền điện Chủ trọ (actor phụ: OCR cho UC10.2) FR-CT-06
UC11.1 – 11.3 Quản lý thanh toán Chủ trọ FR-CT-07
UC12 Theo dõi thanh toán Khách thuê FR-KT-05
UC13 Yêu cầu gia hạn Khách thuê (actor phụ: Chủ trọ) FR-KT-06, FR-CT-09
UC14 Yêu cầu trả phòng Khách thuê FR-KT-07 (chưa có đặc tả)
UC15 Xử lý trả phòng Chủ trọ FR-CT-10
UC16 Phê duyệt yêu cầu Chủ trọ FR-CT-09
UC17 (Xem), 17.1 – 17.3 Quản lý sự cố Chủ trọ FR-CT-11
UC18.1 – 18.2 Gửi thông báo sự cố Khách thuê FR-KT-08
UC19.1 – 19.4 Thống kê báo cáo Chủ trọ FR-CT-12
Chưa có UC Lập phiếu thu Chủ trọ FR-CT-08
Chưa có UC Ghi nhận khoản chi; xử lý đề xuất bạn cùng phòng; xác nhận chỉ số/minh chứng; giữ phòng; chuyển phòng; ghi nhận vi phạm; đăng nhập; thông báo Chủ trọ / chung FR-CT-05, 06, 07, 12; FR-CM

4.3. Xác định yêu cầu phi chức năng
Hiệu năng
• Hệ thống phải phản hồi trong thời gian phù hợp đối với các thao tác thông thường.
• Các chức năng tính tiền (tiền điện, khoản phải thu, tiền cọc hoàn) phải trả kết quả nhanh chóng.
• Báo cáo phải được tổng hợp trong thời gian phù hợp.
• OCR phải trả kết quả trong thời gian phù hợp để người dùng có thể kiểm tra trước khi gửi.
Bảo mật
• Người dùng phải đăng nhập trước khi sử dụng các chức năng yêu cầu xác thực.
• Hệ thống phân biệt quyền Chủ trọ và Khách thuê.
• Khách thuê chỉ được truy cập dữ liệu thuộc phạm vi của mình.
• Dữ liệu cá nhân, hợp đồng và tài chính phải được bảo vệ.
• Mật khẩu phải được lưu trữ an toàn (mã hóa/băm một chiều).
• Tài khoản đã bị khóa không được phép đăng nhập.
• Mật khẩu mặc định “1” và mật khẩu tạm thời chỉ được dùng cho lần đăng nhập đầu sau khi cấp hoặc đặt lại; hệ thống buộc đặt mật khẩu mới trong luồng đặt lại mật khẩu. Vì việc đặt lại chỉ dựa trên số điện thoại đã đăng ký, hệ thống nên giới hạn số lần yêu cầu đặt lại trong một khoảng thời gian để hạn chế lạm dụng (đề xuất của nhóm, chưa được khách hàng xác nhận).
• Hình ảnh công tơ điện và minh chứng thanh toán chỉ được truy cập bởi Chủ trọ và đúng Khách thuê liên quan.
Toàn vẹn dữ liệu
• Dữ liệu hợp đồng, tiền cọc, tiền điện, khoản phải thu, phiếu thu, thanh toán và công nợ phải nhất quán.
• Không được tạo dữ liệu trùng lặp gây sai lệch nghĩa vụ thanh toán (ví dụ một phiếu thu hợp lệ cho một phòng trong một kỳ; một chỉ số điện cho một phòng trong một kỳ; một yêu cầu đang chờ cho một loại yêu cầu).
• Khi thao tác lưu thất bại, dữ liệu trước đó phải được giữ nguyên.
• Không được lưu một phần trong các nghiệp vụ cần tính nhất quán (tiếp nhận sự cố, cập nhật kết quả sự cố, thanh lý hợp đồng, xóa sự cố).
• Các thao tác sửa, xóa dữ liệu quan trọng phải để lại nhật ký truy vết.
Sao lưu và khôi phục
• Dữ liệu phải được sao lưu định kỳ.
• Hệ thống phải hỗ trợ khôi phục dữ liệu khi xảy ra sự cố.
Dễ sử dụng
• Giao diện đơn giản và dễ hiểu.
• Giảm thao tác tính toán thủ công.
• Các trạng thái phòng, hợp đồng, điện, thanh toán, minh chứng, công nợ và sự cố phải được hiển thị rõ ràng.
• Giao diện dành cho khách thuê phải thuận tiện trên thiết bị di động (đặc biệt khi chụp và tải ảnh công tơ, ảnh minh chứng).
• Các thao tác xóa phải có bước xác nhận trước khi thực hiện.
Thông báo
• Thông báo phải được gửi đúng đối tượng.
• Hạn chế thông báo trùng lặp.
• Hợp đồng sắp hết hạn phải được cảnh báo trước ít nhất 1 tháng.
• Phiếu thu chỉ được gửi sau khi được tạo và lưu thành công.
• Kết quả xử lý yêu cầu và sự cố phải được thông báo cho khách thuê tương ứng.
• Chủ trọ phải được thông báo khi có chỉ số điện mới, yêu cầu mới, đề xuất bạn cùng phòng mới hoặc sự cố mới.
Khả năng mở rộng và bảo trì
• Hệ thống có khả năng mở rộng từ 3 căn lên nhiều căn và nhiều phòng hơn.
• Cấu trúc hệ thống phải rõ ràng để thuận tiện sửa lỗi và phát triển chức năng mới.
• Dịch vụ OCR được tách khỏi nghiệp vụ chính để có thể thay thế hoặc nâng cấp độc lập.
Tương thích và tin cậy
• Hệ thống web hoạt động trên các trình duyệt phổ biến.
• Khi xảy ra lỗi, hệ thống phải thông báo rõ ràng.
• Dữ liệu đầu vào (kể cả định dạng và chất lượng hình ảnh) phải được kiểm tra trước khi lưu.
• Các mức thời gian phản hồi cụ thể như 3 giây hoặc 5 giây chỉ được xem là mục tiêu kỹ thuật của nhóm nếu chưa được khách hàng xác nhận chính thức.
4.4. Quy tắc nghiệp vụ
BR-01. Điều kiện cấp tài khoản — Khách thuê chỉ được cấp tài khoản sau khi hoàn tất các điều kiện thuê phòng theo quy định, bao gồm hợp đồng và tiền cọc. Tài khoản được liên kết với hồ sơ khách thuê tương ứng. Tên đăng nhập là số điện thoại của khách thuê và phải duy nhất trong hệ thống; mật khẩu mặc định khi cấp là “1”. Điều kiện này cũng áp dụng khi mở khóa tài khoản cho khách thuê quay lại thuê theo hợp đồng mới.
BR-02. Cảnh báo hết hạn hợp đồng — Hệ thống phải cảnh báo Chủ trọ và Khách thuê khi hợp đồng sắp hết hạn, tối thiểu 1 tháng trước ngày hết hạn. Hợp đồng trong giai đoạn này có trạng thái hiển thị “Sắp hết hạn” (BR-33).
BR-03. Công thức khoản phải thu và mốc thời gian của kỳ —
• Khoản phải thu của một kỳ được xác định theo công thức: Tiền phòng + Tiền điện + Tiền nước + Phí dịch vụ + Phí phát sinh − Khoản giảm trừ.
• Tiền phòng lấy theo giá thuê trong hợp đồng; tiền điện theo BR-04; tiền nước theo BR-23; phí dịch vụ theo BR-20; phí phát sinh gồm phí sửa chữa do khách thuê chịu (BR-37) và phí phát sinh khác do Chủ trọ nhập; khoản giảm trừ gồm khoản giảm tiền phòng của người quản lý căn (BR-09) và các khoản giảm khác do Chủ trọ nhập kèm ghi chú.
• Công nợ các kỳ trước không nằm trong công thức này mà được hiển thị riêng (BR-35) để tránh tính trùng.
• Ngày 01 hàng tháng thực hiện ghi nhận chỉ số điện. Hạn thanh toán là ngày 05 và hệ thống tiếp tục ghi nhận tình hình thanh toán theo quy trình đến ngày 10.
• Không áp dụng tiền phạt chậm thanh toán trong phạm vi hiện tại.
BR-04. Minh chứng và xác nhận chỉ số điện — Khách thuê gửi hình ảnh công tơ điện để hệ thống OCR nhận dạng. Hệ thống kiểm tra định dạng và chất lượng ảnh; chỉ số nhận dạng phải được so sánh với chỉ số kỳ trước và chỉ số nhỏ hơn chỉ số kỳ trước không được chấp nhận. Khách thuê kiểm tra kết quả trước khi gửi (có thể tải lại ảnh). Chỉ số sau khi gửi ở trạng thái “Chờ xác nhận” và chỉ được xem là chính thức sau khi Chủ trọ xác nhận. Khi Chủ trọ tự thêm chỉ số cho phòng chưa có dữ liệu (bằng ảnh qua OCR hoặc nhập trực tiếp) và xác nhận, chỉ số được lưu là chính thức. Mỗi phòng chỉ có một chỉ số hiệu lực trong một kỳ.
BR-05. Xử lý quá hạn giữ phòng — Nếu phòng đã được giữ nhưng quá thời hạn mà khách không tiếp tục thuê, Chủ trọ có thể hủy trạng thái giữ và đưa phòng về trạng thái Trống. Việc xử lý khoản cọc phải căn cứ vào thỏa thuận áp dụng.
BR-06. Trình tự trả phòng — Việc thanh lý hợp đồng chỉ được thực hiện sau khi đã xử lý các nội dung cần thiết gồm chốt tiền điện, kiểm tra phòng và tài sản, kiểm tra công nợ và xác định các khoản khấu trừ hợp lệ. Nếu một trong các nội dung bắt buộc chưa đầy đủ, hệ thống hiển thị các nội dung cần hoàn tất và không cho thanh lý. Công nợ còn lại của khách thuê không chặn việc thanh lý mà được khấu trừ vào tiền cọc theo BR-38. Quy tắc này áp dụng cho cả thanh lý trong luồng trả phòng và thanh lý hợp đồng ngoài luồng yêu cầu trả phòng.
BR-07. Phân loại chi phí — Khoản chi liên quan trực tiếp đến căn nào phải được gắn với căn đó. Khoản chi chung cho toàn chuỗi được ghi nhận ở cấp toàn chuỗi.
BR-08. Công thức lợi nhuận — Lợi nhuận = Tổng doanh thu − Tổng chi phí. Doanh thu theo BR-39; phạm vi toàn chuỗi gồm cả chi phí chung, phạm vi một căn chỉ gồm chi phí gắn với căn đó; lợi nhuận âm được hiển thị là lỗ.
BR-09. Người quản lý căn — Người quản lý căn không phải actor riêng. Người này sử dụng tài khoản khách thuê và các công việc hỗ trợ quản lý căn được thực hiện ngoài hệ thống. Khoản giảm tiền phòng nếu có được ghi nhận như một khoản giảm trừ trong khoản phải thu của kỳ. Khoản giảm trừ này không được ghi nhận thêm thành chi phí quản lý căn để tránh tính trùng; chi phí quản lý căn chỉ dùng cho các khoản chi khác thực tế phát sinh.
BR-10. Luồng trạng thái phòng — Luồng trạng thái chính của phòng là: Trống → Đã giữ → Đang thuê → Đang xử lý trả phòng → Trống. Điều kiện chuyển: (a) Trống → Đã giữ khi Chủ trọ ghi nhận giữ phòng; (b) Đã giữ hoặc Trống → Đang thuê khi hợp đồng được lưu thành công; (c) Đang thuê → Đang xử lý trả phòng khi yêu cầu trả phòng được phê duyệt; (d) Đang xử lý trả phòng → Trống khi hợp đồng được thanh lý; (e) Đã giữ → Trống khi hủy giữ theo BR-05. Phòng mới tạo có trạng thái khởi tạo là Trống. Phòng ngừng sử dụng được xử lý bằng trạng thái riêng, không xóa (BR-15).
BR-11. Quản lý đơn giá — Đơn giá điện và đơn giá nước được lưu trong hợp đồng. Sau khi Chủ trọ và Khách thuê thống nhất thay đổi ngoài hệ thống, Chủ trọ cập nhật thông tin trên hệ thống. Dữ liệu các kỳ trước phải được giữ nguyên để phục vụ lịch sử. Giá thuê của phòng chỉ là giá tham chiếu khi tạo hợp đồng; giá áp dụng cho khách đang thuê lấy từ hợp đồng.
BR-12. Quyền kiểm soát tài chính — Chủ trọ là actor có quyền quản lý chính thức các thông tin thanh toán, công nợ, thu, chi, doanh thu, chi phí và lợi nhuận.
BR-13. Phạm vi dữ liệu của khách thuê — Khách thuê chỉ được truy cập thông tin thuộc bản thân, phòng đang thuê, hợp đồng và các giao dịch liên quan đến mình.
BR-14. Quyền thao tác của khách thuê — Khách thuê chỉ được thực hiện các chức năng được hệ thống cho phép như đặt lại mật khẩu, xem hợp đồng, theo dõi thanh toán và nộp minh chứng, nhập chỉ số điện, gửi yêu cầu gia hạn hoặc trả phòng, đề xuất bạn cùng phòng và báo sự cố.
BR-15. Bảo toàn lịch sử phòng — Không được xóa dữ liệu phòng nếu việc xóa làm mất lịch sử hợp đồng, thuê hoặc giao dịch liên quan. Khi cần ngừng sử dụng một phòng, phải xử lý bằng trạng thái phù hợp thay vì xóa lịch sử.
BR-16. Chuyển phòng — Khi khách thuê chuyển sang phòng khác theo thỏa thuận, thông tin thuê và giá phòng phải được cập nhật phù hợp, đồng thời bảo toàn lịch sử dữ liệu trước đó. Phòng cũ chuyển về Trống và phòng mới chuyển sang Đang thuê theo BR-10; việc cập nhật thực hiện thông qua cập nhật hợp đồng và được lưu lịch sử thay đổi.
BR-17. Tài khoản sau trả phòng — Sau khi hoàn tất trả phòng, tài khoản khách thuê không bị xóa. Quyền truy cập được khóa (trạng thái “Đã khóa”) và lịch sử thuê vẫn được lưu. Khi khách thuê thuê lại, Chủ trọ cập nhật trạng thái tài khoản về “Đang hoạt động” sau khi đáp ứng BR-01.
BR-18. Trách nhiệm chi phí hư hỏng — Chi phí sửa chữa thông thường do Chủ trọ chịu và được ghi nhận là chi phí vận hành của căn/phòng liên quan. Nếu xác định khách thuê gây ra hư hỏng, Chủ trọ chọn đối tượng chịu chi phí là khách thuê, xác định khách thuê và nhập căn cứ trách nhiệm; khoản chi phí được cộng vào kỳ thanh toán gần nhất chưa hoàn thành của khách đó theo BR-37. Việc ghi nhận trách nhiệm không tự động tạo khoản phạt; số tiền khách chịu chỉ bằng chi phí sửa chữa thực tế đã nhập, không phát sinh thêm khoản phạt nếu chưa có quy định nghiệp vụ tương ứng.
BR-19. Thanh toán và công nợ — Trạng thái thanh toán được xác định dựa trên số tiền thực tế Chủ trọ cập nhật:
• Số tiền đã thanh toán bằng 0 → trạng thái “Chưa thanh toán”.
• Số tiền đã thanh toán lớn hơn 0 nhưng nhỏ hơn tổng phải thanh toán → “Thanh toán một phần”.
• Số tiền đã thanh toán bằng tổng phải thanh toán → “Đã thanh toán”, số tiền còn nợ bằng 0.
• Số tiền còn nợ = Tổng phải thanh toán − Số tiền đã thanh toán. Số tiền nhập vào phải hợp lệ (không âm, không vượt tổng phải thanh toán).
• Khi Chủ trọ dùng chức năng “Tất cả đã đóng” hoặc đánh dấu “Đã đóng” cho một phòng, số tiền đã thanh toán được đặt bằng tổng phải thanh toán; khi bỏ tích “Đã đóng”, trạng thái được xác định lại theo số tiền thực tế do Chủ trọ cập nhật.
• Nếu đã quá hạn và số tiền còn nợ lớn hơn 0, hệ thống ghi nhận phần còn thiếu vào công nợ theo BR-35.
• Điều kiện quá hạn dùng để xác định việc ghi nhận công nợ và không làm mất thông tin khách đang “Chưa thanh toán” hay “Thanh toán một phần”.
BR-20. Phí dịch vụ — Phí dịch vụ được quy định trong hợp đồng. Việc thương lượng thay đổi được thực hiện ngoài hệ thống và Chủ trọ cập nhật kết quả sau khi hai bên thống nhất.
BR-21. Gia hạn hợp đồng — Khi yêu cầu gia hạn được phê duyệt và khách tiếp tục thuê cùng phòng, hệ thống cập nhật ngày kết thúc của hợp đồng hiện tại (theo thời gian gia hạn khách đề nghị) và lưu lịch sử gia hạn. Không tạo hợp đồng mới. Khi Chủ trọ gia hạn trực tiếp trên hợp đồng, ngày kết thúc mới phải lớn hơn ngày kết thúc hiện tại, hợp đồng chưa thanh lý và hệ thống cũng lưu lịch sử gia hạn; trạng thái hợp đồng được cập nhật theo thời hạn mới.
BR-22. Bảo toàn lịch sử hợp đồng — Hợp đồng đã hết hiệu lực hoặc đã thanh lý phải được giữ lại để phục vụ lịch sử và truy vết; không xóa dữ liệu hợp đồng đã phát sinh nghiệp vụ liên quan.
BR-23. Tiền nước — Hệ thống không quản lý chỉ số đồng hồ nước. Tiền nước = Đơn giá nước theo hợp đồng × Số người đang ở trong phòng (xác định theo BR-34). Khi trả phòng, tiền nước kỳ cuối được xác định theo quy tắc này, không chốt bằng chỉ số.
BR-24. Ghi nhận vi phạm hợp đồng — Vi phạm nếu được ghi nhận phải gắn với nội dung và điều khoản liên quan. Việc ghi nhận vi phạm không mặc nhiên đồng nghĩa với mất tiền cọc; việc khấu trừ phải căn cứ vào hợp đồng. Vi phạm được ghi nhận hiển thị cho khách thuê trong thông tin phát sinh của hợp đồng.
BR-25. Minh chứng thanh toán — Việc chuyển tiền thực tế diễn ra ngoài hệ thống. Khách thuê có thể tải minh chứng thanh toán lên hệ thống. Minh chứng sau khi gửi ở trạng thái “Chờ xác nhận”. Trạng thái minh chứng (Chờ xác nhận, Đã xác nhận) là trạng thái riêng, độc lập với trạng thái thanh toán của BR-19. Chỉ sau khi Chủ trọ xác nhận và cập nhật thông tin thanh toán thì số tiền thanh toán chính thức và công nợ mới được cập nhật.
BR-26. Một phiếu thu cho một phòng trong một kỳ — Mỗi phòng chỉ được tồn tại một phiếu thu hợp lệ cho cùng một kỳ thanh toán. Chức năng tạo phiếu thu thủ công chỉ hiển thị các phòng chưa có phiếu thu trong kỳ.
BR-27. Chỉnh sửa phiếu thu — Khi phiếu thu đã tồn tại và cần điều chỉnh, Chủ trọ chỉnh sửa phiếu thu hiện tại thay vì tạo thêm một phiếu thu hợp lệ khác cho cùng phòng và cùng kỳ. Khi dữ liệu nguồn của phiếu (chỉ số điện, phí phát sinh, khoản giảm trừ) thay đổi sau khi phiếu đã lập, Chủ trọ điều chỉnh phiếu hiện tại để đồng bộ (BR-36).
BR-28. Thiết lập lịch lập và gửi phiếu thu tự động — Chủ trọ có thể thiết lập thời gian định kỳ để hệ thống tự động lập và gửi phiếu thu. Khi đến thời gian đã thiết lập, hệ thống xác định các phòng chưa có phiếu thu trong kỳ và đã đủ dữ liệu của kỳ (chỉ số điện đã được Chủ trọ xác nhận), sử dụng khoản phải thu đã được xác định để tạo phiếu và lưu phiếu trước khi gửi đến khách thuê.
BR-29. Xử lý lỗi khi tự động lập phiếu thu — Chỉ phiếu thu được tạo và lưu thành công mới được gửi đến khách thuê. Nếu một phiếu thu không thể tạo hoặc lưu, hệ thống không gửi phiếu đó và tiếp tục xử lý các phòng còn lại. Các phòng chưa đủ dữ liệu hoặc lập lỗi được liệt kê để Chủ trọ lập thủ công.
BR-30. Phê duyệt yêu cầu — Chỉ yêu cầu đang ở trạng thái “Chờ phê duyệt” mới được xử lý tại chức năng Phê duyệt yêu cầu. Chức năng này chỉ áp dụng cho hai loại yêu cầu: gia hạn và trả phòng. Sau khi phê duyệt, yêu cầu chuyển “Đã phê duyệt”, khách thuê được thông báo kết quả và:
• Gia hạn → cập nhật ngày kết thúc của hợp đồng hiện tại và lưu lịch sử (BR-21).
• Trả phòng → chuyển phòng sang “Đang xử lý trả phòng” và chuyển sang xử lý trả phòng.
• Yêu cầu đặt lại mật khẩu không thuộc chức năng này; hệ thống xử lý tự động theo BR-40.
• Trong phạm vi hiện tại, chức năng Phê duyệt yêu cầu không triển khai luồng từ chối.
BR-31. Trạng thái sự cố — Sự cố được quản lý theo các trạng thái chính: Chờ tiếp nhận → Đang xử lý → Đã xử lý. Sự cố do Chủ trọ tự tạo bắt đầu ở “Đang xử lý”. Báo cáo không hợp lệ, trùng lặp hoặc không liên quan, khi còn “Chờ tiếp nhận” và chưa có dữ liệu xử lý hay khoản tài chính liên kết, được Chủ trọ xóa (xóa mềm) kèm lý do bắt buộc; hệ thống lưu lý do, người xóa, thời điểm xóa, báo cáo không còn trong danh sách thông thường và không thuộc danh sách cần Chủ trọ xử lý. Sự cố đã “Đã xử lý” được hiển thị ở chế độ chỉ xem.
BR-32. Quyền chỉnh sửa sự cố của khách thuê — Khách thuê chỉ được chỉnh sửa sự cố (loại sự cố, mức độ ưu tiên, mô tả, hình ảnh) khi sự cố còn ở trạng thái “Chờ tiếp nhận”; sau khi chỉnh sửa trạng thái vẫn là “Chờ tiếp nhận” và thời điểm chỉnh sửa được ghi nhận. Khi sự cố đã được tiếp nhận, khách thuê chỉ được theo dõi trạng thái và kết quả xử lý. Khách thuê không tự xóa hoặc hủy báo cáo; báo cáo không hợp lý do Chủ trọ xử lý theo BR-31.
Các quy tắc nghiệp vụ bổ sung (BR-33 đến BR-41)
Các quy tắc dưới đây được bổ sung để làm rõ logic giữa các nghiệp vụ; nhiều quy tắc xuất phát từ yêu cầu thực tế của bài toán mà Use Case chưa thể hiện hết.
BR-33. Trạng thái hợp đồng và tiền cọc —
• Trạng thái hợp đồng gồm: “Đang hiệu lực”; “Sắp hết hạn” (còn tối đa 1 tháng đến ngày kết thúc, theo BR-02); “Hết hạn” (quá ngày kết thúc mà chưa gia hạn hoặc thanh lý); “Đã thanh lý” (không thể chuyển ngược).
• Hợp đồng mới lưu ở “Đang hiệu lực”; gia hạn làm hệ thống xác định lại trạng thái theo thời hạn mới; thanh lý chuyển sang “Đã thanh lý”. Hợp đồng đã thanh lý không được gia hạn.
• Trạng thái tiền cọc gồm: “Chưa nhận”, “Đã nhận”, “Đã hoàn” (hoàn một phần hoặc toàn bộ) và “Đã khấu trừ”. Việc nhận và hoàn cọc diễn ra ngoài hệ thống; Chủ trọ cập nhật trạng thái.
• Số tiền cọc phải hợp lệ; số tiền hoàn cọc không được âm và không được lớn hơn số tiền cọc còn được hoàn.
BR-34. Số người ở và bạn cùng phòng —
• Số người đang ở trong phòng gồm khách thuê trên hợp đồng và các bạn cùng phòng đã được Chủ trọ chấp nhận; số này không được vượt số người tối đa của phòng.
• Khách thuê chỉ được đề xuất bạn cùng phòng khi phòng còn khả năng tiếp nhận thêm người và người được đề xuất chưa ở trong phòng. Đề xuất ở trạng thái “Chờ xử lý” cho đến khi Chủ trọ xử lý (chấp nhận hoặc từ chối).
• Khi chấp nhận, Chủ trọ cập nhật số người ở; số người ở là căn cứ tính tiền nước (BR-23). Thay đổi số người ở áp dụng từ kỳ thanh toán chưa lập phiếu thu gần nhất; nếu phiếu thu đã lập, Chủ trọ chỉnh sửa phiếu thu theo BR-27.
BR-35. Công nợ mang sang và tổng cần thanh toán —
• Công nợ phát sinh khi đã quá hạn thanh toán (sau ngày 05) mà số tiền còn nợ của kỳ lớn hơn 0; phần còn thiếu của kỳ được ghi nhận là công nợ của kỳ đó.
• Kỳ gốc vẫn giữ trạng thái “Chưa thanh toán” hoặc “Thanh toán một phần” theo BR-19. Khi Chủ trọ cập nhật thanh toán cho kỳ cũ, công nợ giảm tương ứng.
• Công nợ các kỳ trước hiển thị riêng là “công nợ cũ” cho khách thuê; không cộng vào công thức khoản phải thu của kỳ sau (BR-03). Tổng số tiền khách thuê cần thanh toán khi theo dõi = khoản phải thu của kỳ + công nợ cũ.
• Khi trả phòng, công nợ còn lại được khấu trừ vào tiền cọc (BR-38).
BR-36. Sửa, xóa chỉ số điện và thông tin thanh toán —
• Chỉ Chủ trọ được sửa hoặc xóa chỉ số điện và thông tin thanh toán; thao tác xóa phải có xác nhận trước khi thực hiện.
• Sau khi xóa chỉ số điện, phòng hiển thị “Chưa có chỉ số điện” của kỳ tương ứng. Sau khi xóa thông tin thanh toán, số tiền đã thanh toán trở về 0, số tiền còn nợ, trạng thái và công nợ được tính lại.
• Nếu kỳ đã có phiếu thu, hệ thống cảnh báo Chủ trọ và Chủ trọ chỉnh sửa phiếu thu hiện tại để đồng bộ, không tạo phiếu mới (BR-26, BR-27).
• Mọi thao tác sửa, xóa được ghi nhật ký (người thao tác, thời điểm, giá trị trước và sau). Khi lưu thất bại, dữ liệu cũ được giữ nguyên.
BR-37. Phí sửa chữa do khách thuê chịu —
• Khi cập nhật kết quả sự cố với đối tượng chịu chi phí là khách thuê và chi phí lớn hơn 0, Chủ trọ phải xác định khách thuê gây hư hỏng và nhập căn cứ trách nhiệm. Chi phí bằng 0 thì không phát sinh khoản tài chính.
• Hệ thống thêm khoản phí sửa chữa vào “Phí phát sinh” của kỳ thanh toán gần nhất chưa hoàn thành của khách thuê đó (kỳ gần nhất chưa ở trạng thái “Đã thanh toán”) và cập nhật tổng số tiền phải thanh toán; nếu kỳ đã có phiếu thu thì chỉnh sửa phiếu thu hiện tại (BR-27).
• Trong trường hợp này hệ thống không ghi chi phí vận hành của Chủ trọ cho sự cố. Khoản phí sửa chữa do khách chịu là khoản hoàn lại chi phí đã bỏ ra, nên không được tính vào doanh thu và không tính vào chi phí trong báo cáo, để lợi nhuận không bị sai lệch (BR-39).
BR-38. Tính tiền cọc còn được hoàn khi trả phòng hoặc thanh lý —
• Tiền cọc còn được hoàn = Tiền cọc đã nhận − (Tiền điện cuối kỳ và tiền nước kỳ cuối chưa thu + Công nợ các kỳ trước còn lại + Chi phí bồi thường hư hỏng hoặc mất mát thuộc trách nhiệm khách thuê + Khoản khấu trừ vi phạm theo hợp đồng).
• Khoản đã được cộng vào kỳ thanh toán theo BR-37 chỉ được tính một lần, không tính lại trong chi phí bồi thường.
• Nếu kết quả nhỏ hơn 0, số tiền cọc hoàn bằng 0 và phần thiếu được ghi nhận là khoản khách thuê còn phải trả (thu thêm ngoài hệ thống). Số tiền hoàn không được lớn hơn số tiền cọc.
• Việc khấu trừ vi phạm phải căn cứ điều khoản hợp đồng (BR-24). Việc hoàn tiền cọc thực tế diễn ra ngoài hệ thống; hệ thống cập nhật trạng thái tiền cọc (BR-33).
BR-39. Ghi nhận doanh thu —
• Doanh thu được ghi nhận theo số tiền khách thuê đã thanh toán thực tế do Chủ trọ xác nhận và cập nhật (BR-12, BR-25); khoản phải thu chưa thanh toán không tính vào doanh thu.
• Doanh thu được nhóm theo loại khoản thu: tiền phòng, tiền điện, tiền nước, phí dịch vụ, phí phát sinh và khoản khấu trừ từ tiền cọc. Khi thanh toán một phần, số tiền đã thanh toán được phân bổ cho từng loại theo tỷ lệ của khoản phải thu trong kỳ (đề xuất của nhóm).
• Khoản giảm trừ làm giảm khoản phải thu nên không phải là chi phí. Tiền cọc không phải doanh thu khi nhận; phần cọc được khấu trừ để bù công nợ hoặc bồi thường được ghi nhận là doanh thu tại thời điểm thanh lý.
• Phí sửa chữa do khách thuê chịu (BR-37) không tính vào doanh thu. Chi phí sửa chữa do Chủ trọ chịu được tính vào chi phí của căn/phòng liên quan.
BR-40. Đăng nhập và đặt lại mật khẩu —
• Khách thuê đăng nhập bằng số điện thoại và mật khẩu; tài khoản “Đã khóa” không được đăng nhập.
• Đặt lại mật khẩu chỉ áp dụng khi số điện thoại tồn tại trong hệ thống; hệ thống xử lý tự động, không cần Chủ trọ phê duyệt, cấp mật khẩu tạm thời “1”.
• Sau khi đăng nhập bằng mật khẩu tạm thời, khách thuê phải nhập mật khẩu tạm thời, mật khẩu mới và xác nhận mật khẩu mới; hệ thống chỉ lưu khi mật khẩu mới trùng khớp xác nhận.
• Đặt lại mật khẩu không làm thay đổi trạng thái khóa của tài khoản. Mật khẩu được lưu trữ an toàn.
BR-41. Chỉ số điện ban đầu —
• Chỉ số kỳ trước của kỳ đầu tiên của hợp đồng là chỉ số công tơ tại thời điểm bắt đầu thuê, do Chủ trọ ghi nhận khi bắt đầu hợp đồng.
• Khách thuê chỉ nhập chỉ số điện khi chỉ số kỳ trước của phòng đã tồn tại trong hệ thống.
4.5. Mô tả một số chức năng phức tạp
Nhóm tập trung vào các chức năng phức tạp sau:

1. Ghi nhận và tính tiền điện
   Khách thuê tải ảnh công tơ → Hệ thống kiểm tra ảnh → OCR nhận dạng → So sánh với chỉ số kỳ trước → Khách kiểm tra (tải lại nếu sai) → Gửi chỉ số → Trạng thái Chờ xác nhận → Chủ trọ kiểm tra → Xác nhận → Tính lượng điện sử dụng → Áp đơn giá hợp đồng → Tính tiền điện → Lưu lịch sử.
   Trường hợp khách thuê chưa gửi: Chủ trọ chọn phòng chưa có chỉ số → Tải ảnh → OCR → Xác nhận → Lưu → Tính tiền điện. Sửa hoặc xóa chỉ số theo BR-36.
2. Tính khoản phải thu và lập phiếu thu
   Lấy hợp đồng → Tiền phòng → Tiền điện → Tiền nước → Phí dịch vụ → Phí phát sinh → Khoản giảm trừ → Xác định khoản phải thu → Lập phiếu thu.
   Đối với phiếu thu:
   • Phiếu đã có → Chủ trọ có thể xem/chỉnh sửa.
   • Phiếu chưa có → Chủ trọ có thể tạo thủ công.
   • Chủ trọ thiết lập lịch → Hệ thống tự động lập và gửi phiếu theo BR-28 và BR-29.
3. Quản lý thanh toán và công nợ
   Xem thanh toán theo căn/kỳ → Xem chi tiết từng phòng → Cập nhật số tiền thực tế (hoặc xác nhận minh chứng của khách) → Tính số tiền còn nợ → Xác định Chưa thanh toán/Thanh toán một phần/Đã thanh toán → Nếu quá hạn còn nợ thì ghi nhận công nợ → Lưu lịch sử. Khi ghi nhận sai, Chủ trọ xóa thông tin thanh toán và nhập lại.
4. Quản lý hợp đồng và yêu cầu
   Tạo hợp đồng → Theo dõi thời hạn → Cảnh báo sắp hết hạn → Khách gửi yêu cầu → Chủ trọ phê duyệt → Cập nhật dữ liệu theo loại yêu cầu → Thông báo kết quả.
   Gia hạn:
   Yêu cầu gia hạn → Phê duyệt → Cập nhật ngày kết thúc hợp đồng hiện tại → Lưu lịch sử. (Chủ trọ cũng có thể gia hạn trực tiếp trên hợp đồng.)
   Trả phòng:
   Yêu cầu trả phòng → Phê duyệt → Phòng chuyển Đang xử lý trả phòng → Thực hiện chức năng Xử lý trả phòng.
5. Xử lý trả phòng
   Yêu cầu đã được phê duyệt → Chốt tiền điện → Xác định tiền nước kỳ cuối → Kiểm tra phòng/tài sản → Kiểm tra công nợ → Xác định khoản khấu trừ → Tính tiền cọc còn hoàn (BR-38) → Thanh lý hợp đồng → Phòng về Trống → Khóa quyền truy cập tài khoản → Giữ lịch sử.
6. Xử lý sự cố và sửa chữa
   Khách báo sự cố hoặc Chủ trọ tự ghi nhận → Phân loại → Tiếp nhận → Đang xử lý → Ghi nhận kết quả sửa chữa → Ghi nhận chi phí → Xác định người chịu chi phí → Hoàn tất → Thông báo kết quả.
   Báo cáo không hợp lý khi còn Chờ tiếp nhận → Chủ trọ xóa kèm lý do.
   Chi phí do Chủ trọ chịu → Ghi chi phí vận hành căn/phòng → Báo cáo. Chi phí do khách thuê chịu → Cộng vào Phí phát sinh của kỳ gần nhất chưa hoàn thành → Phiếu thu/Thanh toán (BR-37).
7. Tổng hợp thu chi và báo cáo
   Ghi nhận khoản thu → Tiếp nhận chi phí sửa chữa → Ghi nhận chi phí khác → Phân loại theo căn/toàn chuỗi → Tổng hợp doanh thu → Tổng hợp chi phí → Tính lợi nhuận → Lọc theo tháng/quý/năm → So sánh hiệu quả giữa các căn.
8. Xác định tiền cọc hoàn trả
   Tiền cọc đã nhận → Trừ tiền điện cuối kỳ, tiền nước kỳ cuối → Trừ công nợ còn lại → Trừ bồi thường hư hỏng/mất mát → Trừ khoản khấu trừ vi phạm theo hợp đồng → Tiền cọc còn được hoàn (không âm, không lớn hơn tiền cọc) → Nếu thiếu thì ghi nhận khoản khách còn phải trả → Cập nhật trạng thái tiền cọc.
