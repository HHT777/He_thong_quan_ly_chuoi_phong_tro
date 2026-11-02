const net = require("node:net");

function assertApiPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`Cổng API ${port} đã được sử dụng. Kiểm tra backend đang chạy tại http://127.0.0.1:${port}/health; dừng đúng tiến trình cũ trước khi khởi động lại.`));
      } else {
        reject(error);
      }
    });
    probe.listen(port, () => probe.close(resolve));
  });
}

module.exports = { assertApiPortAvailable };
