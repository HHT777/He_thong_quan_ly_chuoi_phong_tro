import { renderBillsV2 } from "./bills-v2.js";

export default {
  id: "bills",
  route: "/finance/bills",
  title: "Phiếu thu",
  tabLabel: "Phiếu thu",
  group: "finance",
  order: 40,
  roles: ["CHU_TRO"],
  render: renderBillsV2,
};