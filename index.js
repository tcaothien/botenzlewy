require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');

// Thiết lập strictQuery để tránh cảnh báo
mongoose.set('strictQuery', true);  // Hoặc false nếu bạn muốn truy vấn không nghiêm ngặt

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Đã kết nối MongoDB"))
  .catch(err => console.log(err));

// Tạo schema và model MongoDB
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  xu: { type: Number, default: 1000 },
  marriedTo: { type: String, default: null },
  lovePoints: { type: Number, default: 0 },
  lastLove: { type: Date, default: null },
  marriedImage: { type: String, default: null },
});

const autoReplySchema = new mongoose.Schema({
  keyword: { type: String, required: true, unique: true },
  reply: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);
const AutoReply = mongoose.model('AutoReply', autoReplySchema);

// Khởi tạo bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('ready', () => {
  console.log(`${client.user.tag} đã sẵn sàng!`);
});

// Bộ nhớ đệm (cache) người dùng
const userCache = new Map();

async function getUser(userId) {
  let user = userCache.get(userId);
  if (!user) {
    user = await User.findOne({ userId }) || await User.create({ userId });
    userCache.set(userId, user);
  }
  return user;
}

// Hàm kiểm tra quyền admin
function isAdmin(member) {
  return member.permissions.has(PermissionsBitField.Flags.Administrator);
}

// Xử lý lệnh và tin nhắn
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const prefix = 'e';
  if (!message.content.startsWith(prefix)) {
    // Kiểm tra trả lời tự động
    const autoReplies = await AutoReply.find();
    for (const reply of autoReplies) {
      if (message.content.toLowerCase() === reply.keyword.toLowerCase()) {
        message.reply(reply.reply);
        return;
      }
    }
    return;
  }

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const userId = message.author.id;
  const user = await getUser(userId);

  try {
    switch (command) {
      case 'xu': {
        message.reply(`Số dư của bạn: ${user.xu} xu.`);
        break;
      }

      case 'tx': {
  const bet = parseInt(args[0]); // Số tiền cược
  const choice = args[1]?.toLowerCase(); // "tai" hoặc "xiu"

  if (isNaN(bet) || bet <= 0) {
    message.reply("Hãy nhập số xu hợp lệ để cược: `e tx số_xu tai/xiu`");
    break;
  }

  if (!["tai", "xiu"].includes(choice)) {
    message.reply("Vui lòng chọn `tai` hoặc `xiu`: `e tx số_xu tai/xiu`");
    break;
  }

  if (user.xu < bet) {
    message.reply("Bạn không đủ xu để thực hiện cược!");
    break;
  }

  // Tạo hàm chuyển điểm thành emoji xúc xắc
  const diceToEmoji = (value) => {
    const diceEmojis = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    return diceEmojis[value - 1];
  };

  // Xúc xắc ngẫu nhiên
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const dice3 = Math.floor(Math.random() * 6) + 1;
  const total = dice1 + dice2 + dice3;

  // Tổng điểm để xác định kết quả
  const result = total > 10 ? "tai" : "xiu";

  // Hiển thị xúc xắc bằng emoji
  const diceDisplay = `${diceToEmoji(dice1)} ${diceToEmoji(dice2)} ${diceToEmoji(dice3)}`;

  if (choice === result) {
    user.xu += bet; // Thắng
    await user.save();
    message.reply(
      `🎲 Kết quả: ${diceDisplay} (Tổng: ${total} - ${result.toUpperCase()})\n🎉 Bạn đã thắng ${bet} xu! Số xu hiện tại: ${user.xu}`
    );
  } else {
    user.xu -= bet; // Thua
    await user.save();
    message.reply(
      `🎲 Kết quả: ${diceDisplay} (Tổng: ${total} - ${result.toUpperCase()})\n😢 Bạn đã thua ${bet} xu! Số xu hiện tại: ${user.xu}`
    );
  }
  break;
}
        
      case 'daily': {
        const reward = Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000;
        user.xu += reward;
        await user.save();
        message.reply(`Bạn đã nhận được ${reward} xu! Số xu hiện tại: ${user.xu}`);
        break;
      }

      case 'addimage': {
  if (!user.marriedTo) {
    message.reply("Bạn hiện chưa có marry! Không thể thêm ảnh marry.");
    break;
  }

  // Kiểm tra nếu người dùng đã có ảnh kết hôn
  if (user.marriedImage) {
    message.reply("Bạn đã thêm ảnh marry rồi. Bạn chỉ có thể thay đổi ảnh khi đã xóa ảnh trước đó.");
    break;
  }

  // Kiểm tra xem có file đính kèm (ảnh) trong tin nhắn không
  if (!message.attachments.size) {
    message.reply("Vui lòng đính kèm một ảnh để làm ảnh marry.");
    break;
  }

  // Lấy ảnh đính kèm đầu tiên trong tin nhắn
  const marriageImageUrl = message.attachments.first().url;

  // Cập nhật ảnh kết hôn cho người dùng
  user.marriedImage = marriageImageUrl;
  await user.save();

  message.reply("Ảnh marry đã được thêm thành công!");
  break;
}

      case 'delimage': {
  if (!user.marriedTo) {
    message.reply("Bạn hiện chưa marry! Không thể xóa ảnh marry.");
    break;
  }

  // Kiểm tra nếu người dùng không có ảnh kết hôn
  if (!user.marriedImage) {
    message.reply("Bạn không có ảnh để xóa.");
    break;
  }

  // Xóa ảnh kết hôn của người dùng
  user.marriedImage = null;
  await user.save();

  message.reply("Ảnh marry đã được xóa.");
  break;
}
        
      case 'gives': {
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) {
          message.reply("Hãy nhập đúng định dạng: `e egives @user số_xu`");
          break;
        }

        const receiver = await getUser(target.id);
        if (userId === target.id) {
          message.reply("Bạn không thể chuyển xu cho chính mình!");
          break;
        }

        if (user.xu < amount) {
          message.reply("Bạn không đủ xu để thực hiện giao dịch!");
          break;
        }

        user.xu -= amount;
        receiver.xu += amount;

        await user.save();
        await receiver.save();

        message.reply(`Bạn đã chuyển ${amount} xu cho ${target.tag}. Số xu hiện tại của bạn: ${user.xu}`);
        break;
      }

      case 'love': {
        const now = new Date();
        if (user.lastLove && now - user.lastLove < 3600000) {
          const timeLeft = Math.ceil((3600000 - (now - user.lastLove)) / 60000);
          message.reply(`Bạn chỉ có thể sử dụng lệnh này sau ${timeLeft} phút nữa.`);
          break;
        }

        user.lastLove = now;
        user.lovePoints += 1;
        await user.save();
        message.reply(`Bạn đã tăng 1 điểm yêu thương! Điểm yêu thương hiện tại: ${user.lovePoints}`);
        break;
      }

      case 'pmarry': {
  if (!user.marriedTo) {
    message.reply("Bạn hiện chưa kết hôn với ai!");
    break;
  }

  const partner = await getUser(user.marriedTo);
  const partnerName = partner ? `<@${partner.userId}>` : "Không xác định";
  const marriedDate = user.marriedDate ? user.marriedDate.toLocaleDateString() : "Chưa xác định"; // Ngày kết hôn
  const marriedImage = user.marriedImage; // Lấy ảnh kết hôn nếu có
  const lovePoints = user.lovePoints + (partner ? partner.lovePoints : 0); // Tính điểm yêu thương chung

  // Tạo embed thông điệp với thông tin kết hôn và ảnh
  const embed = {
    color: 0xFF0000, // Màu đỏ
    title: "Marry",
    description: `
**Chúc mừng!** Bạn đang kết hôn với ${partnerName}.
Ngày kết hôn: ${marriedDate}
Điểm yêu thương chung: ${lovePoints}`,
    image: marriedImage ? { url: marriedImage } : null, // Nếu có ảnh, thêm vào
    timestamp: new Date(),
    footer: { text: "Thông tin kết hôn" }
  };

  // Gửi embed thông điệp
  message.channel.send({ embeds: [embed] });
  break;
}

        case 'divorce': {
  if (!user.marriedTo) {
    message.reply("Bạn chưa kết hôn với ai!");
    break;
  }

  const partner = await getUser(user.marriedTo);

  if (!partner) {
    message.reply(
      "Không thể thực hiện ly hôn vì không tìm thấy thông tin của người mà bạn đã kết hôn. Vui lòng kiểm tra lại sau hoặc liên hệ quản trị viên!"
    );
    break;
  }

  // Gửi yêu cầu ly hôn đến đối phương
  const confirmationMessage = await message.channel.send(
    `<@${partner.userId}>, ${message.author.tag} muốn ly hôn với bạn. Bạn có đồng ý không?\n\n✅ Đồng ý\n❌ Từ chối`
  );

  // Thêm reaction
  await confirmationMessage.react("✅");
  await confirmationMessage.react("❌");

  // Bộ lọc chỉ chấp nhận phản hồi từ đối phương
  const filter = (reaction, user) =>
    ["✅", "❌"].includes(reaction.emoji.name) && user.id === partner.userId;

  try {
    const collected = await confirmationMessage.awaitReactions({
      filter,
      max: 1,
      time: 30000, // 30 giây
      errors: ["time"],
    });

    const reaction = collected.first();

    if (reaction.emoji.name === "✅") {
      // Xác nhận ly hôn
      if (user.xu < 500000) {
        message.reply({
          embeds: [
            {
              color: 0xFF0000, // Màu đỏ
              description: "Bạn cần ít nhất 500,000 xu để ly hôn!"
            }
          ]
        });
        break;
      }

      user.xu -= 500000;
      user.marriedTo = null;
      partner.marriedTo = null;

      await user.save();
      await partner.save();

      message.reply({
        embeds: [
          {
            color: 0xFF0000, // Màu đỏ
            description: `Ly hôn thành công! Bạn và ${partner.userId} không còn là gì của nhau.`
          }
        ]
      });
    } else {
      // Từ chối ly hôn
      message.reply({
        embeds: [
          {
            color: 0xFF0000, // Màu đỏ
            description: `${partner.userId} đã từ chối yêu cầu ly hôn.`
          }
        ]
      });
    }
  } catch (error) {
    message.reply({
      embeds: [
        {
          color: 0xFF0000, // Màu đỏ
          description: "Không nhận được phản hồi. Yêu cầu ly hôn đã bị hủy."
        }
      ]
    });
  }
  break;
}
        
      case 'marry': {
  const target = message.mentions.users.first();
  if (!target) {
    message.reply("Hãy đề cập đến người bạn muốn cầu hôn!");
    break;
  }

  const partner = await getUser(target.id);

  if (userId === target.id) {
    message.reply("Bạn không thể kết hôn với chính mình!");
    break;
  }

  if (user.marriedTo) {
    message.reply("Bạn đã kết hôn với người khác!");
    break;
  }

  if (partner.marriedTo) {
    message.reply(`${target.tag} đã kết hôn với người khác!`);
    break;
  }

  if (user.xu < 5000000) {
    message.reply("Bạn cần ít nhất 5,000,000 xu để cầu hôn!");
    break;
  }

  // Gửi yêu cầu cầu hôn với thông báo embedded
  const proposalMessage = await message.channel.send({
    embeds: [
      {
        color: 16711680, // Màu đỏ
        title: `Cầu hôn từ ${message.author.tag}`,
        description: `${target}, bạn có đồng ý kết hôn với ${message.author.tag}?`,
        fields: [
          {
            name: 'Thời gian phản hồi',
            value: 'Phản hồi trong vòng 30 giây!',
          },
          {
            name: 'Lựa chọn',
            value: '❤️ Đồng ý | 💔 Từ chối',
          },
        ],
        timestamp: new Date(),
      },
    ],
  });

  // Thêm react để trả lời
  await proposalMessage.react("❤️");
  await proposalMessage.react("💔");

  const filter = (reaction, userReact) =>
    ["❤️", "💔"].includes(reaction.emoji.name) && userReact.id === target.id;

  const collector = proposalMessage.createReactionCollector({ filter, time: 30000 });

  collector.on("collect", async (reaction) => {
    if (reaction.emoji.name === "❤️") {
      collector.stop();

      user.xu -= 5000000;
      user.marriedTo = target.id;
      partner.marriedTo = userId;

      await user.save();
      await partner.save();

      // Thông báo thành công
      message.reply({
        embeds: [
          {
            color: 3066993, // Màu xanh lá (thành công)
            title: "Cầu hôn thành công!",
            description: `Chúc mừng! ${message.author.tag} và ${target.tag} đã chính thức kết hôn!`,
            timestamp: new Date(),
          },
        ],
      });
    } else if (reaction.emoji.name === "💔") {
      collector.stop();

      // Thông báo khi từ chối
      message.reply({
        embeds: [
          {
            color: 15158332, // Màu đỏ (từ chối)
            title: "Lời cầu hôn bị từ chối",
            description: `${target.tag} đã từ chối lời cầu hôn của bạn.`,
            timestamp: new Date(),
          },
        ],
      });
    }
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      message.reply({
        embeds: [
          {
            color: 16711680, // Màu đỏ (hết hạn)
            title: "Yêu cầu cầu hôn đã hết hạn",
            description: "Yêu cầu cầu hôn đã hết hạn. Vui lòng thử lại sau.",
            timestamp: new Date(),
          },
        ],
      });
    }
  });
  break;
}

      case 'delreply': {
        if (!isAdmin(message.member)) {
          message.reply("Bạn không có quyền sử dụng lệnh này!");
          break;
        }
        const keyword = args[0];
        if (!keyword) {
          message.reply("Hãy nhập từ khóa cần xóa: `e delreply từ_khóa`");
          break;
        }
        const deleted = await AutoReply.findOneAndDelete({ keyword });
        message.reply(deleted ? `Đã xóa trả lời tự động cho từ khóa "${keyword}".` : "Không tìm thấy từ khóa!");
        break;
      }

      case 'addreply': {
        if (!isAdmin(message.member)) {
          message.reply("Bạn không có quyền sử dụng lệnh này!");
          break;
        }
        const keyword = args[0];
        const reply = args.slice(1).join(' ');

        if (!keyword || !reply) {
          message.reply("Hãy nhập đúng định dạng: `e addreply từ_khóa nội_dung_trả_lời`");
          break;
        }

        const exists = await AutoReply.findOne({ keyword });
        if (exists) {
          message.reply("Từ khóa đã tồn tại!");
          break;
        }

        await AutoReply.create({ keyword, reply });
        message.reply(`Đã thêm trả lời tự động: Khi gặp "${keyword}", bot sẽ trả lời "${reply}".`);
        break;
      }

      case 'listreply': {
        if (!isAdmin(message.member)) {
          message.reply("Bạn không có quyền sử dụng lệnh này!");
          break;
        }
        const replies = await AutoReply.find();
        if (replies.length === 0) {
          message.reply("Chưa có trả lời tự động nào.");
          break;
        }

        const replyList = replies.map(r => `- "${r.keyword}" → "${r.reply}"`).join('\n');
        const chunks = replyList.match(/[\s\S]{1,1900}/g); // Chia nhỏ nếu quá dài
        chunks.forEach(chunk => message.channel.send(chunk));
        break;
      }

      case 'delxu': {
        if (!isAdmin(message.member)) {
          message.reply("Bạn không có quyền sử dụng lệnh này!");
          break;
        }
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) {
          message.reply("Hãy nhập đúng định dạng: `e delxu @user số_xu`");
          break;
        }

        const receiver = await getUser(target.id);
        if (receiver.xu < amount) {
          message.reply("Người dùng này không có đủ xu để trừ!");
          break;
        }

        receiver.xu -= amount;
        await receiver.save();

        message.reply(`Đã trừ ${amount} xu từ ${target.tag}. Số xu hiện tại của họ: ${receiver.xu}`);
        break;
      }

      case 'addxu': {
        if (!isAdmin(message.member)) {
          message.reply("Bạn không có quyền sử dụng lệnh này!");
          break;
        }
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) {
          message.reply("Hãy nhập đúng định dạng: `e addxu @user số_xu`");
          break;
        }

        const receiver = await getUser(target.id);

        receiver.xu += amount;
        await receiver.save();

        message.reply(`Đã thêm ${amount} xu cho ${target.tag}. Số xu hiện tại của họ: ${receiver.xu}`);
        break;
      }

      case 'helps': {
        const helpMessage = `
**Danh sách lệnh hiện có:**
- \`exu\`: Kiểm tra số dư xu của bạn.
- \`etx\`: chơi tài xỉu cách chơi etx xu tai/xiu
- \`edaily\`: Nhận xu ngẫu nhiên từ 10,000 đến 50,000 mỗi ngày.
- \`egives\`: Chuyển xu cho người dùng khác.
- \`elove\`: Tăng 1 điểm yêu thương (mỗi giờ sử dụng được 1 lần).
- \`epmarry\`: Hiển thị thông tin hôn nhân của bạn.
- \`emarry\`: Cầu hôn một người dùng khác (cần 5,000,000 xu và cả hai phải đồng ý).
- \`edivorce\`: Ly hôn ( cần 500,000 xu để ly hôn )
- \`eaddreply\`: Thêm trả lời tự động (admin).
- \`edelreply\`: Xóa trả lời tự động (admin).
- \`elistreply\`: Xem danh sách trả lời tự động (admin).
- \`eaddxu\`: Thêm xu cho người dùng (admin).
- \`edelxu\`: Trừ xu của người dùng (admin).
        `;
        message.reply(helpMessage);
        break;
      }
    } // Đóng switch

  } catch (err) {
    console.error(err);
    message.reply('Đã xảy ra lỗi khi xử lý lệnh.');
  }
}); // Đóng messageCreate

client.login(process.env.BOT_TOKEN);
