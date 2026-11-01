/*
 * lessons.js — Bài học chiến thuật cơ bản và bài tập.
 * Mỗi bài tập: fen, solution (danh sách nước UCI xen kẽ người chơi / đối phương),
 * hint (gợi ý), explain (giải thích sau khi giải xong).
 * Một nước chiếu hết luôn được chấp nhận dù khác đáp án.
 */
(function (root) {
  'use strict';

  const LESSONS = [
    {
      id: 'values',
      icon: '⚖',
      title: 'Giá trị quân & quân treo',
      summary: 'Biết quân nào đáng giá bao nhiêu và luôn kiểm tra quân không được bảo vệ.',
      theory: [
        'Mỗi quân cờ có một giá trị tương đối: <b>Tốt = 1</b>, <b>Mã = 3</b>, <b>Tượng = 3</b>, <b>Xe = 5</b>, <b>Hậu = 9</b>. Vua là vô giá — mất Vua là thua.',
        'Một quân gọi là <b>"treo"</b> khi nó bị tấn công mà không được bảo vệ, hoặc bị một quân rẻ hơn tấn công. Ăn quân treo là cách đơn giản nhất để giành lợi thế.',
        'Trước <b>mỗi nước đi</b>, hãy tự hỏi 3 câu: (1) Đối phương vừa đe dọa gì? (2) Có quân nào của đối phương đang treo không? (3) Nước mình định đi có để quân nào bị treo không?',
      ],
      tips: ['Đếm số quân tấn công và số quân bảo vệ trên một ô.', 'Đổi quân rẻ lấy quân đắt luôn có lợi.'],
      puzzles: [
        {
          title: 'Hậu bị bỏ quên',
          fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
          solution: ['f3h4'],
          hint: 'Quân Đen nào đang không được bảo vệ? Mã của bạn nhảy được tới đâu?',
          explain: 'Hậu Đen ở h4 không được quân nào bảo vệ, và Mã f3 tấn công đúng ô h4. Nxh4 ăn miễn phí 9 điểm.',
        },
        {
          title: 'Mã tham ăn (cầm quân Đen)',
          fen: 'r1bqkbnr/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
          solution: ['c6e5'],
          hint: 'Trắng vừa dùng Mã ăn Tốt e5. Mã đó có được bảo vệ không?',
          explain: 'Mã e5 không có quân Trắng nào bảo vệ. Nxe5 ăn Mã (3 điểm) — Trắng chỉ được 1 Tốt. Luôn kiểm tra: quân vừa ăn có bị ăn lại không?',
        },
      ],
    },
    {
      id: 'fork',
      icon: '⑂',
      title: 'Đánh đôi (Fork)',
      summary: 'Một quân tấn công hai mục tiêu cùng lúc.',
      theory: [
        '<b>Đánh đôi</b> (còn gọi là chĩa đôi) là khi một quân tấn công <b>hai hay nhiều quân</b> của đối phương cùng một lúc. Đối phương chỉ cứu được một, quân còn lại sẽ mất.',
        '<b>Mã</b> là chuyên gia đánh đôi vì nó nhảy theo hình chữ L và không thể bị chặn. Đánh đôi mạnh nhất là khi một mục tiêu là <b>Vua</b> (chiếu) — đối phương bắt buộc phải lo cho Vua.',
        'Tốt cũng đánh đôi rất hiệu quả: một Tốt (1 điểm) tấn công hai quân nhẹ (3 điểm) là lời lớn.',
      ],
      tips: ['Tìm các ô mà từ đó Mã chạm tới cả Vua lẫn Hậu/Xe.', 'Vua và Hậu đứng cách nhau một bước Mã là dấu hiệu nguy hiểm.'],
      puzzles: [
        {
          title: 'Mã hoàng gia',
          fen: 'r3kb1r/pp3ppp/8/3N4/8/8/PPP2PPP/R3KB1R w KQkq - 0 1',
          solution: ['d5c7', 'e8d7', 'c7a8'],
          hint: 'Tìm ô mà Mã chiếu Vua và đồng thời tấn công Xe a8.',
          explain: 'Nc7+ chiếu Vua e8 và tấn công Xe a8. Vua phải đi, Trắng ăn Xe — thắng 5 điểm.',
        },
        {
          title: 'Tốt đánh đôi',
          fen: '4k3/pp3ppp/3b1n2/8/3PP3/8/PP3PPP/4K3 w - - 0 1',
          solution: ['e4e5', 'd6e7', 'e5f6'],
          hint: 'Một quân Tốt có thể tấn công hai quân nhẹ cùng lúc.',
          explain: 'e5! tấn công cả Tượng d6 lẫn Mã f6. Tốt e5 được Tốt d4 bảo vệ nên Đen không ăn được miễn phí. Đen sẽ mất một quân nhẹ.',
        },
        {
          title: 'Hậu cũng đánh đôi',
          fen: 'r3k2r/ppp2ppp/8/8/7n/2P5/PP3PPP/3Q1RK1 w kq - 0 1',
          solution: ['d1a4', 'c7c6', 'a4h4'],
          hint: 'Mã h4 không được bảo vệ. Có ô nào Hậu vừa chiếu Vua vừa tấn công Mã?',
          explain: 'Qa4+! chiếu Vua theo đường chéo a4–e8 và đồng thời tấn công Mã h4 theo hàng ngang. Đen phải đỡ chiếu, Trắng ăn Mã.',
        },
      ],
    },
    {
      id: 'pin',
      icon: '📌',
      title: 'Ghim (Pin)',
      summary: 'Khóa chặt một quân vì phía sau là quân giá trị hơn.',
      theory: [
        '<b>Ghim</b> xảy ra khi một quân trượt (Tượng, Xe, Hậu) tấn công một quân của đối phương, mà <b>phía sau</b> nó trên cùng đường là một quân giá trị hơn.',
        '<b>Ghim tuyệt đối</b>: phía sau là Vua — quân bị ghim không được phép di chuyển theo luật. <b>Ghim tương đối</b>: phía sau là Hậu/Xe — di chuyển được nhưng sẽ mất quân giá trị hơn.',
        'Khi đã ghim được một quân, hãy <b>dồn thêm quân tấn công</b> nó (ví dụ đẩy Tốt đến đuổi), vì nó không thể chạy.',
      ],
      tips: ['Quân đứng thẳng hàng với Vua/Hậu là mục tiêu ghim.', 'Đừng để Mã của bạn bị ghim vào Hậu ở khai cuộc.'],
      puzzles: [
        {
          title: 'Hậu bị ghim',
          fen: '4k3/pp3ppp/4q3/8/8/8/PP3PPP/R4K2 w - - 0 1',
          solution: ['a1e1', 'e6e1', 'f1e1'],
          hint: 'Hậu Đen và Vua Đen đứng trên cùng một cột.',
          explain: 'Re1! ghim Hậu e6 vào Vua e8. Hậu không thể rời cột e, nên Đen buộc phải đổi Hậu (9) lấy Xe (5).',
        },
        {
          title: 'Tấn công quân bị ghim',
          fen: 'r1bqk1nr/pp3ppp/2n5/1B6/3P4/5N2/PPP2PPP/RNBQK2R w KQkq - 0 1',
          solution: ['d4d5'],
          hint: 'Mã c6 đang bị Tượng b5 ghim vào Vua e8 — nó không thể chạy. Hãy tấn công nó bằng quân rẻ nhất.',
          explain: 'd5! Tốt tấn công Mã c6 đang bị ghim. Mã không thể rời đi vì Vua e8 sẽ bị chiếu, nên Đen mất Mã đổi lấy Tốt.',
        },
      ],
    },
    {
      id: 'skewer',
      icon: '➶',
      title: 'Xiên (Skewer)',
      summary: 'Tấn công quân giá trị lớn, ăn quân đứng sau nó.',
      theory: [
        '<b>Xiên</b> là "ghim ngược": quân trượt tấn công một quân <b>giá trị lớn</b> (thường là Vua hoặc Hậu) đứng trước, khi quân đó tránh đi thì quân phía sau bị ăn.',
        'Đòn xiên hay gặp nhất là <b>chiếu Vua</b> theo đường chéo hoặc hàng ngang/cột dọc, khi phía sau Vua có Xe hoặc Hậu không được bảo vệ.',
      ],
      tips: ['Vua và Hậu/Xe thẳng hàng trên đường trống = cơ hội xiên.', 'Ở tàn cuộc, xiên bằng Xe rất phổ biến.'],
      puzzles: [
        {
          title: 'Tượng xiên Xe',
          fen: 'r7/5ppp/8/3k4/8/8/4BPPP/6K1 w - - 0 1',
          solution: ['e2f3', 'd5d4', 'f3a8'],
          hint: 'Vua d5 và Xe a8 nằm trên cùng một đường chéo.',
          explain: 'Bf3+ chiếu Vua theo đường chéo f3–a8. Vua tránh đi, Tượng ăn Xe a8.',
        },
        {
          title: 'Xe xiên Hậu',
          fen: '8/pp6/8/q4k2/8/8/5PP1/6KR w - - 0 1',
          solution: ['h1h5', 'f5e4', 'h5a5'],
          hint: 'Vua f5 và Hậu a5 cùng nằm trên hàng 5.',
          explain: 'Rh5+ chiếu Vua theo hàng 5. Vua phải rời hàng, Xe ăn Hậu a5.',
        },
      ],
    },
    {
      id: 'discovered',
      icon: '◎',
      title: 'Tấn công mở',
      summary: 'Di chuyển một quân để mở đường cho quân phía sau.',
      theory: [
        '<b>Tấn công mở</b>: một quân di chuyển và <b>để lộ</b> đường tấn công của Tượng, Xe hoặc Hậu phía sau. Như vậy bạn tạo ra <b>hai đe dọa</b> chỉ với một nước.',
        '<b>Chiếu mở</b> (quân phía sau chiếu Vua) cực kỳ mạnh: đối phương phải lo đỡ chiếu, trong khi quân vừa di chuyển được tự do ăn quân.',
        '<b>Chiếu đôi</b>: cả quân di chuyển lẫn quân phía sau cùng chiếu — đối phương chỉ còn cách chạy Vua.',
      ],
      tips: ['Tìm quân của mình đang "chắn" đường của Xe/Tượng/Hậu hướng về Vua đối phương.'],
      puzzles: [
        {
          title: 'Chiếu mở bắt Hậu',
          fen: '3qk2r/ppp2ppp/8/4N3/8/8/PPP2PPP/4R1K1 w k - 0 1',
          solution: ['e5c6', 'e8f8', 'c6d8'],
          hint: 'Mã e5 đang chắn đường Xe e1 tới Vua e8. Mã có thể đi đâu để tấn công Hậu?',
          explain: 'Nc6+! là chiếu mở: Xe e1 chiếu Vua, còn Mã c6 tấn công Hậu d8. Đen lo đỡ chiếu, Trắng ăn Hậu.',
          alt: ['e5f7'],
        },
        {
          title: 'Chiếu mở theo đường chéo',
          fen: '5r2/pp2qpkp/6p1/8/3N4/8/PB3PPP/6K1 w - - 0 1',
          solution: ['d4f5', 'g7g8', 'f5e7'],
          hint: 'Tượng b2 nhắm thẳng vào Vua g7, chỉ bị Mã d4 chắn.',
          explain: 'Nf5+ là chiếu đôi (Mã và Tượng cùng chiếu) đồng thời Mã tấn công Hậu e7. Đen chỉ có thể chạy Vua và mất Hậu.',
          alt: ['d4c6', 'd4e6'],
        },
      ],
    },
    {
      id: 'backrank',
      icon: '♜',
      title: 'Chiếu hết hàng cuối',
      summary: 'Vua bị nhốt sau hàng Tốt của chính mình.',
      theory: [
        'Khi Vua nhập thành và các Tốt phía trước chưa di chuyển, Vua có thể bị <b>nhốt</b> ở hàng cuối. Một Xe hoặc Hậu xâm nhập hàng cuối sẽ <b>chiếu hết</b>.',
        'Để phòng thủ: tạo "lỗ thở" bằng cách đẩy một Tốt (h3/h6), hoặc giữ một Xe canh hàng cuối.',
        'Khi tấn công: nếu hàng cuối chỉ có một quân canh giữ, hãy tìm cách <b>đổi</b> hoặc <b>dụ</b> quân đó đi (thí quân).',
      ],
      tips: ['Vua g8 + Tốt f7, g7, h7 chưa đi = nguy cơ hàng cuối.'],
      puzzles: [
        {
          title: 'Chiếu hết một nước',
          fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
          solution: ['d1d8'],
          hint: 'Vua Đen không có lỗ thở.',
          explain: 'Rd8# — Vua g8 bị chính các Tốt f7, g7, h7 chặn đường thoát.',
        },
        {
          title: 'Hai Xe chồng nhau',
          fen: 'r5k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1',
          solution: ['e2e8', 'a8e8', 'e1e8'],
          hint: 'Xe a8 là quân duy nhất canh hàng cuối. Hãy đổi nó đi.',
          explain: 'Re8+! Rxe8 Rxe8#. Hai Xe chồng trên cột e: Xe thứ nhất dụ Xe Đen, Xe thứ hai chiếu hết.',
        },
      ],
    },
    {
      id: 'removedef',
      icon: '⚔',
      title: 'Loại bỏ quân phòng thủ',
      summary: 'Ăn hoặc đuổi quân đang bảo vệ mục tiêu.',
      theory: [
        'Nếu một quân của đối phương chỉ được <b>một quân</b> bảo vệ, hãy <b>loại bỏ quân phòng thủ</b> đó (ăn, đổi, hoặc đuổi nó đi). Sau đó mục tiêu trở thành quân treo.',
        'Kỹ thuật này thường đi kèm với đổi quân: bạn đổi ngang một quân nhưng cuối cùng thắng thêm một quân khác.',
      ],
      tips: ['Hỏi: "Quân nào đang giữ cho mục tiêu an toàn?"'],
      puzzles: [
        {
          title: 'Ăn người gác',
          fen: '6k1/pp3ppp/5n2/3b2B1/8/8/PP3PPP/3R2K1 w - - 0 1',
          solution: ['g5f6', 'g7f6', 'd1d5'],
          hint: 'Tượng d5 bị Xe d1 tấn công. Ai đang bảo vệ nó?',
          explain: 'Mã f6 là quân duy nhất bảo vệ Tượng d5. Bxf6! loại bỏ quân phòng thủ; sau gxf6, Rxd5 ăn Tượng.',
        },
      ],
    },
    {
      id: 'mates',
      icon: '♚',
      title: 'Các thế chiếu hết cơ bản',
      summary: 'Chiếu hết Mục đồng, chiếu hết bằng Hậu + Vua.',
      theory: [
        '<b>Chiếu hết Mục đồng</b> (Scholar\'s mate): Hậu và Tượng cùng tấn công ô <b>f7</b> (f2) — ô yếu nhất ở đầu ván vì chỉ được Vua bảo vệ.',
        '<b>Hậu + Vua</b>: Hậu đứng sát Vua đối phương, được Vua mình bảo vệ — Vua đối phương không thể ăn Hậu.',
        'Nguyên tắc chung: chiếu hết cần (1) chiếu Vua, (2) mọi ô thoát đều bị kiểm soát, (3) không thể chặn hay ăn quân chiếu.',
      ],
      tips: ['Ở đầu ván, luôn để ý ô f7/f2.'],
      puzzles: [
        {
          title: 'Chiếu hết Mục đồng',
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
          solution: ['h5f7'],
          hint: 'Ô f7 chỉ được Vua bảo vệ, nhưng bạn có hai quân tấn công nó.',
          explain: 'Qxf7# — Hậu được Tượng c4 bảo vệ nên Vua không ăn được, và không còn ô nào để chạy.',
        },
        {
          title: 'Hậu hôn Vua',
          fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1',
          solution: ['g6g7'],
          hint: 'Đặt Hậu sát Vua đối phương, ở ô được Vua mình bảo vệ.',
          explain: 'Qg7# — Hậu kiểm soát g8, h7, h6... và được Vua f6 bảo vệ.',
        },
        {
          title: 'Mã ngạt thở',
          fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
          solution: ['g5f7'],
          hint: 'Vua Đen bị chính quân mình bao vây. Mã có thể chiếu ở đâu?',
          explain: 'Nf7# — "chiếu hết ngạt thở": Vua h8 bị Xe g8 và Tốt g7, h7 của chính mình chặn kín.',
        },
      ],
    },
    {
      id: 'opening',
      icon: '♞',
      title: 'Nguyên tắc khai cuộc',
      summary: 'Chiếm trung tâm, phát triển quân, nhập thành sớm.',
      theory: [
        '<b>1. Chiếm trung tâm</b>: các ô d4, e4, d5, e5 là quan trọng nhất. Tốt e4/d4 giúp quân của bạn có không gian.',
        '<b>2. Phát triển quân nhẹ</b>: đưa Mã và Tượng ra trước Xe và Hậu. "Mã trước Tượng" là kinh nghiệm hay.',
        '<b>3. Nhập thành sớm</b>: đưa Vua vào nơi an toàn và kết nối hai Xe.',
        '<b>4. Đừng đi một quân hai lần</b> ở khai cuộc nếu không cần, và <b>đừng đưa Hậu ra quá sớm</b>.',
      ],
      tips: ['Sau ~10 nước, hãy cố gắng đã nhập thành và phát triển hết quân nhẹ.'],
      puzzles: [
        {
          title: 'Phạt đưa Hậu sớm',
          fen: 'rnb1kbnr/pppp1ppp/8/4p1q1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 2 3',
          solution: ['d2d4'],
          hint: 'Hậu Đen ra quá sớm. Có nước nào vừa chiếm trung tâm vừa mở đường cho Tượng tấn công Hậu?',
          explain: 'd4! chiếm trung tâm và mở đường cho Tượng c1 tấn công Hậu g5 (Bxg5). Đen phải mất thời gian đưa Hậu đi, Trắng phát triển nhanh hơn.',
          alt: ['g1f3', 'd2d3', 'b1c3'],
        },
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = { LESSONS };
  else root.LESSONS = LESSONS;
})(typeof self !== 'undefined' ? self : this);
