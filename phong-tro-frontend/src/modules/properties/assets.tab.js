import { listTab } from "../../shared/components/tab-factory.js";
import { showToast } from "../../shared/components/toast.js";

const conditions = ["Mới", "Tốt", "Cũ", "Cần sửa", "Hỏng"];
const conditionOptions = [{ value: "", label: "Chọn tình trạng" }, ...conditions.map((value) => ({ value, label: value }))];

export default listTab({ id: "assets", route: "/properties/assets", title: "Nội thất & tài sản", tabLabel: "Nội thất & tài sản", group: "properties", order: 22, roles: ["CHU_TRO"] }, {
  title: "Nội thất & tài sản",
  description: "",
  endpoint: "/v1/assets",
  beforeLoad: async (api) => {
    const buildings = [];
    for (let page = 1; ; page += 1) {
      const response = await api.get(`/management/can-tro?limit=100&page=${page}`);
      buildings.push(...(response.data || []));
      if (!response.pagination?.hasNext) return buildings;
    }
  },
  buildingOptions: (_rows, buildings) => buildings.map((building) => ({ value: building.ma_can, label: building.ten_can })),
  buildingValue: (row) => row.phongTro?.ma_can,
  statusOptions: conditions.map((value) => ({ value, label: value })),
  statusValue: (row) => row.tinh_trang,
  statusFilterLabel: "Tất cả tình trạng",
  statusChipLabel: "Tình trạng",
  columns: [{ label: "Tài sản", key: "ten_tai_san" }, { label: "Phòng", format: (row) => row.phongTro?.so_phong ? `Phòng ${row.phongTro.so_phong}` : "Không rõ phòng" }, { label: "Số lượng", key: "so_luong" }, { label: "Tình trạng", key: "tinh_trang" }, { label: "Ghi chú", key: "ghi_chu" }],
  create: {
    label: "Thêm tài sản",
    fields: [
      { name: "name", label: "Tên tài sản", required: true },
      { name: "buildingId", label: "Căn", options: [{ value: "", label: "Đang tải danh sách căn..." }], required: true },
      { name: "roomId", label: "Phòng", options: [{ value: "", label: "Chọn căn trước" }], required: true },
      { name: "quantity", label: "Số lượng", type: "number", required: true },
      { name: "condition", label: "Tình trạng", options: conditionOptions, required: true },
      { name: "note", label: "Ghi chú" },
    ],
    onOpen: async ({ context, form }) => {
      const buildingSelect = form.elements.namedItem("buildingId");
      const roomSelect = form.elements.namedItem("roomId");
      buildingSelect.disabled = true;
      roomSelect.disabled = true;
      try {
        const [buildingResponse, ...roomResponses] = await Promise.all([
          context.api.get("/management/can-tro?limit=100&page=1"),
          (async () => {
            const rows = [];
            for (let page = 1; ; page += 1) {
              const response = await context.api.get(`/phong?limit=100&page=${page}`);
              rows.push(...(Array.isArray(response.data) ? response.data : []));
              if (!response.pagination?.hasNext) return { data: rows };
            }
          })(),
        ]);
        const buildings = Array.isArray(buildingResponse.data) ? buildingResponse.data : [];
        const rooms = roomResponses.flatMap((response) => Array.isArray(response.data) ? response.data : []);
        buildingSelect.replaceChildren(new Option("Chọn căn", ""));
        buildings.forEach((building) => buildingSelect.add(new Option(building.ten_can, building.ma_can)));
        if (!buildings.length) buildingSelect.replaceChildren(new Option("Chưa có căn", ""));

        const updateRooms = () => {
          const buildingId = buildingSelect.value;
          const matchingRooms = rooms.filter((room) => String(room.ma_can) === String(buildingId));
          roomSelect.replaceChildren(new Option(buildingId ? "Chọn phòng" : "Chọn căn trước", ""));
          matchingRooms.forEach((room) => roomSelect.add(new Option(`Phòng ${room.so_phong}`, room.ma_phong)));
          if (buildingId && !matchingRooms.length) roomSelect.replaceChildren(new Option("Căn này chưa có phòng", ""));
          roomSelect.disabled = !buildingId || !matchingRooms.length;
        };
        buildingSelect.addEventListener("change", updateRooms);
        updateRooms();
      } catch (error) {
        buildingSelect.replaceChildren(new Option("Không tải được danh sách căn", ""));
        roomSelect.replaceChildren(new Option("Không tải được danh sách phòng", ""));
        showToast(`Không tải được danh sách căn/phòng: ${error.message}`, "error");
      } finally {
        buildingSelect.disabled = false;
      }
    },
    map: (raw) => {
      const { buildingId, ...values } = raw;
      return { ...values, quantity: Number(raw.quantity) };
    },
  },
  rowActions: [
    {
      id: "edit",
      label: "Sửa",
      fields: [
        { name: "name", label: "Tên tài sản", required: true },
        { name: "quantity", label: "Số lượng", type: "number", required: true },
        { name: "condition", label: "Tình trạng", options: conditionOptions, required: true },
        { name: "note", label: "Ghi chú" },
      ],
      initial: (row) => ({ name: row.ten_tai_san, quantity: row.so_luong, condition: row.tinh_trang, note: row.ghi_chu }),
      map: (raw) => ({ ...raw, quantity: Number(raw.quantity) }),
      run: (context, row, values) => context.api.put(`/v1/assets/${row.ma_tai_san}`, values),
    },
    {
      id: "delete",
      label: "Xóa",
      confirm: (row) => `Xóa tài sản ${row.ten_tai_san}?`,
      run: (context, row) => context.api.del(`/v1/assets/${row.ma_tai_san}`),
    },
  ],
});
