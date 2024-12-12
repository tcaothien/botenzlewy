require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, MessageEmbed } = require('discord.js');  // Đã thêm MessageEmbed
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

  let embed = new MessageEmbed()
    .setTitle("Kết quả cược xúc xắc")
    .setDescription(`🎲 Kết quả: ${diceDisplay} (Tổng: ${total} - ${result.toUpperCase()})`)
    .setFooter(`Số xu hiện tại: ${user.xu}`);

  if (choice === result) {
    user.xu += bet; // Thắng
    await user.save();
    embed.setColor("GREEN") // Màu xanh lá cây cho thắng
      .setDescription(`🎉 Bạn đã thắng ${bet} xu! ${embed.description}`);
    message.reply({ embeds: [embed] });
  } else {
    user.xu -= bet; // Thua
    await user.save();
    embed.setColor("RED") // Màu đỏ cho thua
      .setDescription(`😢 Bạn đã thua ${bet} xu! ${embed.description}`);
    message.reply({ embeds: [embed] });
  }
  break;
}
        
      case 'daily': {
  const reward = Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000;
  user.xu += reward;
  await user.save();

  let embed = new MessageEmbed()
    .setTitle("Nhận xu hàng ngày")
    .setDescription(`🎉 Bạn đã nhận được ${reward} xu!`)
    .setColor("GREEN") // Màu xanh lá cây cho phần thưởng
    .setFooter(`Số xu hiện tại: ${user.xu}`);

  message.reply({ embeds: [embed] });
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

  // Tạo thông báo thành công với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Ảnh Marry đã được thêm thành công!")
    .setDescription("Ảnh kết hôn của bạn đã được cập nhật.")
    .setImage(marriageImageUrl)
    .setColor("GREEN")
    .setFooter(`Số xu hiện tại: ${user.xu}`);

  message.reply({ embeds: [embed] });
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

  // Tạo thông báo xóa ảnh với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Ảnh Marry đã được xóa!")
    .setDescription("Ảnh kết hôn của bạn đã được xóa thành công.")
    .setColor("RED")
    .setFooter(`Số xu hiện tại: ${user.xu}`);

  message.reply({ embeds: [embed] });
  break;
}
        
      case 'gives': {
  const target = message.mentions.users.first();
  const amount = parseInt(args[1]);

  // Kiểm tra định dạng và dữ liệu nhập vào
  if (!target || isNaN(amount) || amount <= 0) {
    message.reply("Hãy nhập đúng định dạng: `egives @user số_xu`");
    break;
  }

  const receiver = await getUser(target.id);

  // Kiểm tra xem người dùng có cố gắng chuyển xu cho chính mình không
  if (user.id === target.id) {
    message.reply("Bạn không thể chuyển xu cho chính mình!");
    break;
  }

  // Kiểm tra số xu có đủ để chuyển không
  if (user.xu < amount) {
    message.reply("Bạn không đủ xu để thực hiện giao dịch!");
    break;
  }

  // Thực hiện giao dịch: trừ xu của người gửi và cộng xu cho người nhận
  user.xu -= amount;
  receiver.xu += amount;

  await user.save();
  await receiver.save();

  // Tạo thông báo thành công với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Giao dịch thành công!")
    .setDescription(`Bạn đã chuyển ${amount} xu cho ${target.tag}.`)
    .addField("Số xu hiện tại của bạn", user.xu, true)
    .addField("Số xu hiện tại của ${target.tag}", receiver.xu, true)
    .setColor("GREEN")
    .setFooter(`Giao dịch thực hiện lúc: ${new Date().toLocaleString()}`);

  message.reply({ embeds: [embed] });
  break;
}

      case 'love': {
  const now = new Date();

  // Kiểm tra xem người dùng có thể sử dụng lệnh này lại hay không (mỗi giờ chỉ có thể dùng 1 lần)
  if (user.lastLove && now - user.lastLove < 3600000) {
    const timeLeft = Math.ceil((3600000 - (now - user.lastLove)) / 60000);
    message.reply(`Bạn chỉ có thể sử dụng lệnh này sau ${timeLeft} phút nữa.`);
    break;
  }

  // Cập nhật thời gian sử dụng lệnh và tăng điểm yêu thương
  user.lastLove = now;
  user.lovePoints += 1;
  await user.save();

  // Tạo thông báo với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Điểm yêu thương đã được thu thập!")
    .setDescription(`Chúc mừng! Bạn đã được 1 điểm yêu thương.`)
    .addField("Điểm yêu thương hiện tại", user.lovePoints, true)
    .setColor("RED")
    .setFooter(`Cập nhật lúc: ${new Date().toLocaleString()}`);

  message.reply({ embeds: [embed] });
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

  case 'top': {
  // Lấy tất cả người dùng từ cơ sở dữ liệu (ví dụ như MongoDB)
  const users = await User.find().sort({ xu: -1 }).limit(10); // Giới hạn 10 người dùng có số xu cao nhất

  if (users.length === 0) {
    message.reply("Không có người dùng nào trong hệ thống.");
    break;
  }

  // Tạo một danh sách với tên và số xu của người chơi
  const topList = users.map((user, index) => 
    `${index + 1}. ${user.username}: ${user.xu} xu`
  ).join('\n');

  // Tạo Embed để hiển thị thông tin
  const topMessage = new MessageEmbed()
    .setTitle('Top Người Dùng Có Số Xu Cao Nhất')
    .setDescription(topList)
    .setColor('#ff9900') // Màu vàng cho nổi bật
    .setFooter('Được cung cấp bởi Bot của bạn'); // Chân trang

  // Gửi Embed ra kênh
  message.channel.send({ embeds: [topMessage] });
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
  // Kiểm tra quyền admin
  if (!isAdmin(message.member)) {
    message.reply("Bạn không có quyền sử dụng lệnh này!");
    break;
  }

  const keyword = args[0]; // Từ khóa cần xóa
  if (!keyword) {
    message.reply("Hãy nhập từ khóa cần xóa: `edelreply từ_khóa`");
    break;
  }

  // Tìm và xóa trả lời tự động tương ứng với từ khóa
  const deleted = await AutoReply.findOneAndDelete({ keyword });

  // Tạo thông báo với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Kết quả xóa trả lời tự động")
    .setColor(deleted ? "GREEN" : "RED")
    .setDescription(
      deleted
        ? `Đã xóa trả lời tự động cho từ khóa **"${keyword}"**.`
        : `Không tìm thấy trả lời tự động cho từ khóa **"${keyword}"**.`
    )
    .setFooter(`Yêu cầu từ: ${message.author.tag}`);

  // Gửi thông báo
  message.reply({ embeds: [embed] });
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
    message.reply("Hãy nhập đúng định dạng: `eaddreply từ_khóa nội_dung_trả_lời`");
    break;
  }

  // Kiểm tra xem từ khóa đã tồn tại chưa
  const exists = await AutoReply.findOne({ keyword });
  if (exists) {
    message.reply("Từ khóa đã tồn tại!");
    break;
  }

  // Thêm trả lời tự động mới
  await AutoReply.create({ keyword, reply });

  // Tạo thông báo với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Thêm trả lời tự động thành công")
    .setColor("GREEN")
    .setDescription(`Đã thêm trả lời tự động cho từ khóa **"${keyword}"**. Khi gặp từ khóa này, bot sẽ trả lời: "${reply}".`)
    .setFooter(`Yêu cầu từ: ${message.author.tag}`);

  // Gửi thông báo
  message.reply({ embeds: [embed] });
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

  // Tạo danh sách trả lời tự động
  const replyList = replies.map(r => `- **"${r.keyword}"** → "${r.reply}"`).join('\n');
  
  // Chia danh sách thành nhiều phần nếu quá dài
  const chunks = replyList.match(/[\s\S]{1,1900}/g); 

  chunks.forEach(chunk => {
    const embed = new MessageEmbed()
      .setTitle("Danh sách trả lời tự động")
      .setColor("BLUE")
      .setDescription(chunk)
      .setFooter(`Yêu cầu từ: ${message.author.tag}`);

    message.channel.send({ embeds: [embed] });
  });

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
    message.reply("Hãy nhập đúng định dạng: `edelxu @user số_xu`");
    break;
  }

  const receiver = await getUser(target.id);
  if (receiver.xu < amount) {
    message.reply("Người dùng này không có đủ xu để trừ!");
    break;
  }

  // Trừ xu của người dùng
  receiver.xu -= amount;
  await receiver.save();

  // Tạo thông báo với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Trừ xu thành công")
    .setColor("RED")
    .setDescription(`Đã trừ **${amount} xu** từ **${target.tag}**.\nSố xu hiện tại của họ: **${receiver.xu}**`)
    .setFooter(`Yêu cầu từ: ${message.author.tag}`);

  // Gửi thông báo
  message.reply({ embeds: [embed] });
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
    message.reply("Hãy nhập đúng định dạng: `eaddxu @user số_xu`");
    break;
  }

  const receiver = await getUser(target.id);

  // Thêm xu cho người dùng
  receiver.xu += amount;
  await receiver.save();

  // Tạo thông báo với MessageEmbed
  const embed = new MessageEmbed()
    .setTitle("Thêm xu thành công")
    .setColor("GREEN")
    .setDescription(`Đã thêm **${amount} xu** cho **${target.tag}**.\nSố xu hiện tại của họ: **${receiver.xu}**`)
    .setFooter(`Yêu cầu từ: ${message.author.tag}`);

  // Gửi thông báo
  message.reply({ embeds: [embed] });
  break;
}

case 'resetalldulieugwwennn': {
  if (!isAdmin(message.member)) {
    message.reply("Bạn không có quyền sử dụng lệnh này!");
    break;
  }

  // Xác nhận việc reset toàn bộ dữ liệu
  const confirmation = args[0];
  if (confirmation !== 'confirm') {
    message.reply("Để xác nhận reset toàn bộ dữ liệu, vui lòng sử dụng lệnh: `eresetalldulieugwwennn confirm`.");
    break;
  }

  // Tiến hành reset số dư xu và dữ liệu kết hôn của tất cả người dùng
  const users = await User.find(); // Giả sử User là mô hình lưu trữ thông tin người dùng
  if (users.length === 0) {
    message.reply("Không có người dùng nào trong hệ thống.");
    break;
  }

  // Lặp qua tất cả người dùng và reset xu và xóa toàn bộ dữ liệu kết hôn
  for (const user of users) {
    user.xu = 0; // Đặt lại xu về 0
    user.marriedTo = null; // Xóa thông tin kết hôn
    user.marriedImage = null; // Xóa ảnh kết hôn
    user.lovePoints = 0; // Reset điểm yêu thương
    await user.save(); // Lưu lại thay đổi
  }

  message.reply("Đã xóa hoàn toàn dữ liệu kết hôn và reset số dư xu của tất cả người dùng.");
  break;
}


case 'helps': {
  const helpMessage = new MessageEmbed()
    .setTitle('Danh sách lệnh hiện có:')
    .setDescription(`
**Danh sách lệnh:**
- \`exu\`: Kiểm tra số dư xu của bạn.
- \`etop\`: Top xu 
- \`etx\`: Chơi tài xỉu cách chơi etx xu tai/xiu.
- \`edaily\`: Nhận xu ngẫu nhiên từ 10,000 đến 50,000 mỗi ngày.
- \`egives\`: Chuyển xu cho người dùng khác.
- \`elove\`: Tăng 1 điểm yêu thương (mỗi giờ sử dụng được 1 lần).
- \`epmarry\`: Hiển thị thông tin hôn nhân của bạn.
- \`emarry\`: Cầu hôn một người dùng khác (cần 5,000,000 xu và cả hai phải đồng ý).
- \`exu\`: Xóa ảnh khỏi thông tin hôn nhân của bạn.
- \`edelimage\`: Thêm ảnh vào thông tin hôn nhân của bạn.
- \`edivorce\`: Ly hôn (cần 500,000 xu để ly hôn).
- \`eaddreply\`: Thêm trả lời tự động (admin).
- \`edelreply\`: Xóa trả lời tự động (admin).
- \`elistreply\`: Xem danh sách trả lời tự động (admin).
- \`eaddxu\`: Thêm xu cho người dùng (admin).
- \`edelxu\`: Trừ xu của người dùng (admin).
    `)
    .setColor('#7289da') // Màu sắc của Embed (màu Discord xanh)
    .setFooter('Được cung cấp bởi Bot của bạn'); // Chân trang

  // Gửi tin nhắn với Embed
  message.channel.send({ embeds: [helpMessage] });
  break;
}
    } // Đóng switch

  } catch (err) {
    console.error(err);
    message.reply('Đã xảy ra lỗi khi xử lý lệnh.');
  }
}); // Đóng messageCreate

client.login(process.env.BOT_TOKEN);
