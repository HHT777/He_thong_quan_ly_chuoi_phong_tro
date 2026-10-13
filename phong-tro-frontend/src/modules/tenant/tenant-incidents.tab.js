import { renderFormPage } from "../../shared/components/view.js";

const INCIDENT_PRIORITIES = ["THAP", "TRUNG_BINH", "CAO", "KHAN_CAP"];

export default {
  id: "tenant-incidents",
  route: "/tenant/incidents",
  title: "Báo sự cố",
  tabLabel: "Báo sự cố",
  group: "tenant-operations",
  order: 31,
  roles: ["KHACH_THUE"],
  render(context) {
    renderFormPage(context, {
      title: "Báo sự cố",
      description: "Mô tả sự cố để chủ trọ tiếp nhận và xử lý.",
      fields: [
        { name: "roomId", label: "Mã phòng", required: true },
        { name: "type", label: "Loại sự cố", required: true },
        {
          name: "priority",
          label: "Mức độ ưu tiên",
          required: true,
          value: "TRUNG_BINH",
          options: [
            { value: "THAP", label: "Thấp" },
            { value: "TRUNG_BINH", label: "Trung bình" },
            { value: "CAO", label: "Cao" },
            { value: "KHAN_CAP", label: "Khẩn cấp" },
          ],
        },
        { name: "description", label: "Mô tả", required: true },
      ],
      submitLabel: "Gửi sự cố",
      submit: (values) => {
        if (!INCIDENT_PRIORITIES.includes(values.priority)) {
          throw new Error("Mức độ ưu tiên sự cố không hợp lệ");
        }
        return context.api.post("/v1/incidents", values);
      },
    });
  },
};
