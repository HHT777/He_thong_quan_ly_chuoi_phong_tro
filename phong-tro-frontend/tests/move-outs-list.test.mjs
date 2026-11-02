import test from "node:test";
import assert from "node:assert/strict";
import { actionableMoveOutRequests } from "../src/modules/operations/move-outs.model.mjs";

test("only approved requests for contracts awaiting settlement are actionable", () => {
  const requests = [
    { ma_yeu_cau: "104", ma_hop_dong: "contract-104", trang_thai: "DA_PHE_DUYET", trang_thai_hop_dong: "DA_THANH_LY" },
    { ma_yeu_cau: "206", ma_hop_dong: "contract-206", trang_thai: "DA_PHE_DUYET", trang_thai_hop_dong: "DA_THANH_LY" },
    { ma_yeu_cau: "107", ma_hop_dong: "contract-107", trang_thai: "DA_PHE_DUYET", trang_thai_hop_dong: "DA_THANH_LY" },
    { ma_yeu_cau: "open", ma_hop_dong: "contract-open", trang_thai: "DA_PHE_DUYET", trang_thai_hop_dong: "DANG_HIEU_LUC" },
    { ma_yeu_cau: "pending", ma_hop_dong: "contract-pending", trang_thai: "CHO_XU_LY", trang_thai_hop_dong: "DANG_HIEU_LUC" },
  ];

  assert.deepEqual(actionableMoveOutRequests(requests).map((row) => row.ma_yeu_cau), ["open"]);
  assert.equal(requests.length, 5);
  assert.deepEqual(actionableMoveOutRequests(requests.slice(0, 3)), []);
});
