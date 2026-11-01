# ♞ Cờ Vua Học Tập

Nền tảng luyện cờ vua cho người mới: học **chiến thuật cơ bản**, giải bài tập, đấu với máy và nhận **gợi ý nước đi tốt nhất kèm giải thích tại sao**.
Chạy hoàn toàn trên trình duyệt: không cần server, không cần cài đặt.

## Chạy

Mở `index.html` bằng trình duyệt, hoặc chạy server tĩnh:

```bash
npm start          # http://localhost:8080
```

## Tính năng

### 📚 Bài học chiến thuật
9 chủ đề, mỗi chủ đề có lý thuyết ngắn, mẹo và bài tập trên bàn cờ:

| Chủ đề | Nội dung |
|---|---|
| Giá trị quân & quân treo | Đếm quân tấn công/bảo vệ, ăn quân không được bảo vệ |
| Đánh đôi (Fork) | Mã, Tốt, Hậu tấn công hai mục tiêu |
| Ghim (Pin) | Ghim tuyệt đối/tương đối, tấn công quân bị ghim |
| Xiên (Skewer) | Chiếu Vua để ăn quân phía sau |
| Tấn công mở | Chiếu mở, chiếu đôi |
| Chiếu hết hàng cuối | Vua bị nhốt sau hàng Tốt |
| Loại bỏ quân phòng thủ | Ăn quân đang bảo vệ mục tiêu |
| Các thế chiếu hết cơ bản | Mục đồng, Hậu + Vua, chiếu hết ngạt thở |
| Nguyên tắc khai cuộc | Trung tâm, phát triển quân, nhập thành |

- Đi sai → máy phân tích và giải thích **vì sao nước đó chưa tốt** (ví dụ: "Mã ở f6 có thể bị Tốt g7 ăn").
- Gợi ý 2 cấp (đánh dấu quân cần đi → hiện mũi tên), xem đáp án, lưu tiến độ trên trình duyệt.

### ⚔️ Đấu với máy
- 4 cấp độ (Mới tập → Khó), chọn cầm Trắng/Đen.
- **Huấn luyện viên** chấm từng nước của bạn: Tốt nhất ★ / Xuất sắc ! / Tốt ✓ / Thiếu chính xác ?! / Sai lầm ? / Sai lầm nghiêm trọng ??,
  kèm lý do và nước tốt hơn.
- Nút **💡 Gợi ý**: top 3 nước, mũi tên trên bàn cờ, giải thích và diễn biến dự kiến.

### 🔍 Phân tích
Tự xếp/đi quân cho cả hai bên hoặc dán FEN. Máy chỉ ra 3 nước tốt nhất và giải thích.

## Cách máy giải thích nước đi

`js/explain.js` nhận diện các mô-típ trong thế cờ:
chiếu hết, chiếu đôi, chiếu mở, đánh đôi, ghim, xiên, tấn công mở, ăn quân treo, đổi quân có lợi, thí quân,
loại bỏ quân phòng thủ, đe dọa chiếu hết, chặn đe dọa chiếu hết, cứu/bảo vệ quân, phát triển quân, chiếm trung tâm, nhập thành…
và cảnh báo: để quân bị treo, để đối phương chiếu hết, đưa Hậu ra sớm, đi Vua ở khai cuộc.
Kết hợp với đánh giá và biến chính của engine để nói *vì sao* một nước tốt hay xấu.

## Cấu trúc

```
index.html        Giao diện
css/style.css     Giao diện (sáng/tối, điện thoại)
js/chess.js       Luật cờ (0x88): nước hợp lệ, SAN, FEN, nhập thành, bắt tốt qua đường, phong cấp, các luật hòa
js/engine.js      Máy cờ: alpha-beta, quiescence, đào sâu lặp, multi-PV
js/explain.js     Nhận diện chiến thuật & giải thích tiếng Việt
js/lessons.js     Bài học và bài tập
js/board.js       Bàn cờ tương tác (bấm / kéo-thả, mũi tên)
js/app.js         Điều khiển các chế độ
tests/            perft (kiểm tra luật), bộ chấm điểm, xác minh mọi bài tập bằng engine
```

## Kiểm thử

```bash
npm test
```
- `perft`: so số nước đi với giá trị chuẩn trên 5 thế cờ (kể cả nhập thành, bắt tốt qua đường, phong cấp).
- `puzzles`: engine xác nhận lời giải của mọi bài tập là nước tốt nhất.
- `explain`: các nước sai lầm/tốt được phân loại đúng.
