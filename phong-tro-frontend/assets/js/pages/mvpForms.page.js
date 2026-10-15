document.addEventListener("DOMContentLoaded", () => {
  if (!window.ApiClient) return;
  const notify = (message) => window.alert(message);
  const addCard = (html) => {
    const main = document.querySelector("main");
    if (!main) return null;
    const wrapper = document.createElement("section");
    wrapper.className = "panel-grid reveal";
    wrapper.innerHTML = html;
    main.appendChild(wrapper);
    return wrapper;
  };

  if (document.querySelector("[data-active-page='thong-tin-thue']")) {
    const card = addCard(`<article class="form-card" data-co-tenant-form>
      <div class="form-card__head"><div><div class="eyebrow">Hồ sơ</div><h2 class="section-title">Đề xuất người ở cùng</h2></div></div>
      <form class="form-grid">
        <div class="field"><label>Họ tên</label><input name="name" required></div>
        <div class="field"><label>Số điện thoại</label><input name="phone" required></div>
        <div class="field"><label>Số giấy tờ</label><input name="identityNumber" required></div>
        <div class="field"><label>Ngày sinh</label><input type="date" name="birthDate" required></div>
        <div class="field"><label>Giới tính</label><input name="gender" required></div>
        <div class="field"><label>Quan hệ</label><input name="relationship" required></div>
        <div class="field"><label>Địa chỉ thường trú</label><input name="permanentAddress" required></div>
        <div class="field"><label>Ngày bắt đầu ở</label><input type="date" name="startDate" required></div>
        <div class="form-actions" style="grid-column:1/-1"><button class="btn btn--primary" type="submit">Gửi đề xuất</button></div>
      </form></article>`);
    card?.querySelector("form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(event.currentTarget));
        await ApiClient.post("/v1/co-tenants", payload);
        notify("Đã gửi hồ sơ người ở cùng.");
        event.currentTarget.reset();
      } catch (error) { notify(error.message); }
    });
  }

  if (document.querySelector("[data-active-page='cong-no']")) {
    const card = addCard(`<article class="form-card" data-bill-adjustment-form>
      <div class="form-card__head"><div><div class="eyebrow">Điều chỉnh</div><h2 class="section-title">Điều chỉnh phiếu thu</h2></div></div>
      <form class="form-grid">
        <div class="field"><label>Mã phiếu</label><input name="billId" type="number" required></div>
        <div class="field"><label>Version hiện tại</label><input name="expectedVersion" type="number" value="1" required></div>
        <div class="field"><label>Chênh lệch VND (+/-)</label><input name="delta" type="number" required></div>
        <div class="field" style="grid-column:1/-1"><label>Lý do</label><textarea name="reason" required></textarea></div>
        <div class="form-actions" style="grid-column:1/-1"><button class="btn btn--primary" type="submit">Lưu điều chỉnh</button></div>
      </form></article>`);
    card?.querySelector("form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(event.currentTarget));
        const billId = payload.billId;
        delete payload.billId;
        payload.delta = Number(payload.delta);
        payload.expectedVersion = Number(payload.expectedVersion);
        await ApiClient.post(`/v1/bills/${billId}/adjustments`, payload);
        notify("Đã lưu điều chỉnh và audit.");
        event.currentTarget.reset();
      } catch (error) { notify(error.message); }
    });
  }

  if (document.querySelector("[data-active-page='tra-phong']")) {
    const card = addCard(`<article class="form-card" data-liquidation-form>
      <div class="form-card__head"><div><div class="eyebrow">Thanh lý</div><h2 class="section-title">Chốt trả phòng</h2></div></div>
      <form class="form-grid">
        <div class="field"><label>Mã hợp đồng</label><input name="contractId" type="number" required></div>
        <div class="field"><label>Chỉ số điện cuối</label><input name="finalElectricityReading" type="number" min="0" required></div>
        <div class="field"><label>Khấu trừ cọc</label><input name="deduction" type="number" min="0" value="0" required></div>
        <div class="field"><label>Tiền nước</label><input name="waterAmount" type="number" min="0" value="0"></div>
        <div class="field"><label>Tiền phòng hoàn lại</label><input name="rentRefund" type="number" min="0" value="0"></div>
        <div class="field" style="grid-column:1/-1"><label>Lý do</label><textarea name="reason" required></textarea></div>
        <div class="form-actions" style="grid-column:1/-1"><button class="btn btn--primary" type="submit">Thanh lý hợp đồng</button></div>
      </form></article>`);
    card?.querySelector("form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const values = Object.fromEntries(new FormData(event.currentTarget));
        const contractId = values.contractId;
        delete values.contractId;
        for (const key of ["finalElectricityReading", "deduction", "waterAmount", "rentRefund"]) values[key] = Number(values[key] || 0);
        await ApiClient.post(`/v1/move-outs/${contractId}/settle`, values);
        notify("Đã thanh lý hợp đồng.");
        event.currentTarget.reset();
      } catch (error) { notify(error.message); }
    });
  }
});
