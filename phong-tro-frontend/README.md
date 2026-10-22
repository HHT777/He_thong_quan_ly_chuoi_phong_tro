# Frontend ISK19

Frontend hiện hành là ứng dụng Vite SPA. Điểm vào là `index.html` → `src/main.js`; các màn hình ở `src/modules/`. Chạy bằng Node.js 20+:

```bash
npm ci
npm run dev
```

Vite phục vụ trên cổng 4173 và proxy `/api`, `/health` sang backend ở cổng 3001. Build bản phát hành:

```bash
npm run build
```

Chạy test frontend:

```bash
node --test tests/*.test.mjs
```

Các đường dẫn trong ứng dụng dùng hash router, ví dụ `/#/residents-contracts/contracts`. Trang giới thiệu nhóm `member.html` độc lập với ứng dụng quản lý phòng trọ.
