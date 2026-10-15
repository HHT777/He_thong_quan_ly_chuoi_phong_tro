(function () {
  const form = (title, fields, submit) => {
    const wrap = document.createElement("div");
    wrap.className = "card management-inline-form";
    wrap.innerHTML = `<h3>${title}</h3><form>${fields.map((f) => `<label>${f.label}<input name="${f.name}" type="${f.type || "text"}" ${f.required ? "required" : ""}></label>`).join("")}<button class="btn btn--primary" type="submit">Lưu</button><span data-form-error role="alert"></span></form>`;
    document.querySelector("main")?.prepend(wrap);
    wrap.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = wrap.querySelector("button");
      const error = wrap.querySelector("[data-form-error]");
      button.disabled = true;
      error.textContent = "";
      try {
        const body = Object.fromEntries(new FormData(event.target));
        await submit(body);
        event.target.reset();
        window.location.reload();
      } catch (e) {
        error.textContent = e.message || "Không thể lưu dữ liệu";
      } finally {
        button.disabled = false;
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.activePage;
    if (page === "tai-san") {
      form("Thêm căn trọ", [
        { name: "ten_can", label: "Tên căn", required: true },
        { name: "dia_chi", label: "Địa chỉ", required: true },
      ], (body) => window.ApiClient.post("/management/can-tro", body));
    }
    if (page === "phong") {
      form("Thêm phòng", [
        { name: "ma_can", label: "Mã căn", required: true },
        { name: "so_phong", label: "Số phòng", required: true },
        { name: "dien_tich", label: "Diện tích (m²)", type: "number", required: true },
        { name: "gia_thue", label: "Giá thuê", type: "number", required: true },
        { name: "so_nguoi_toi_da", label: "Số người tối đa", type: "number", required: true },
        { name: "noi_that_mo_ta", label: "Mô tả nội thất" },
      ], (body) => window.ApiClient.post("/phong", {
        ma_can: body.ma_can,
        so_phong: body.so_phong,
        dien_tich: Number(body.dien_tich),
        gia_thue: Number(body.gia_thue),
        so_nguoi_toi_da: Number(body.so_nguoi_toi_da),
        noi_that_mo_ta: body.noi_that_mo_ta || null,
      }));
    }
    if (page === "cu-dan") {
      form("Thêm khách thuê", [
        { name: "ho_ten", label: "Họ tên", required: true },
        { name: "so_dien_thoai", label: "Số điện thoại", required: true },
        { name: "cccd_giay_to", label: "CCCD/Giấy tờ", required: true },
      ], (body) => window.ApiClient.post("/management/khach-thue", body));
    }
  });
})();
