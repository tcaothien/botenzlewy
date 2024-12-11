require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');

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
      case 'daily': {
        user.xu += 50000;
        await user.save();
        message.reply(`Bạn đã nhận được 50,000 xu! Số xu hiện tại: ${user.xu}`);
        break;
      }

      case 'transfer': {
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) {
          message.reply("Hãy nhập đúng định dạng: `e transfer @user số_xu`");
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

      case 'marry': {
        const target = message.mentions.users.first();
        if (!target) {
          message.reply("Hãy đề cập đến người bạn muốn kết hôn!");
          break;
        }

        const partner = await getUser(target.id);
        if (userId === target.id || user.marriedTo || partner.marriedTo) {
          message.reply("Bạn hoặc đối phương đã kết hôn!");
          break;
        }

        if (user.xu < 5000000) {
          message.reply("Bạn cần ít nhất 5,000,000 xu để kết hôn!");
          break;
        }

        user.xu -= 5000000;
        user.marriedTo = target.id;
        partner.marriedTo = userId;

        await user.save();
        await partner.save();

        message.reply(`Chúc mừng! Bạn đã kết hôn với ${target.tag}.`);
        break;
      }

      case 'divorce': {
        if (!user.marriedTo) {
          message.reply("Bạn chưa kết hôn với ai!");
          break;
        }

        if (user.xu < 5000000) {
          message.reply("Bạn cần ít nhất 5,000,000 xu để ly hôn!");
          break;
        }

        const partner = await getUser(user.marriedTo);
        user.xu -= 5000000;
        user.marriedTo = null;
        if (partner) partner.marriedTo = null;

        await user.save();
        if (partner) await partner.save();

        message.reply(`Bạn đã ly hôn thành công.`);
        break;
      }

      case 'status': {
        const partnerId = user.marriedTo;
        const partner = partnerId ? `<@${partnerId}>` : "Chưa kết hôn";
        message.reply(`**Trạng thái:**\n- Vợ/chồng: ${partner}\n- Điểm yêu thương: ${user.lovePoints}\n- Số xu: ${user.xu}`);
        break;
      }

      case 'love': {
        const cost = parseInt(args[0]);
        if (isNaN(cost) || cost <= 0 || user.xu < cost) {
          message.reply("Hãy nhập số xu hợp lệ để tăng điểm yêu thương!");
          break;
        }

        user.xu -= cost;
        user.lovePoints += Math.floor(cost / 1000);
        await user.save();
        message.reply(`Bạn đã tăng ${Math.floor(cost / 1000)} điểm yêu thương. Điểm yêu thương hiện tại: ${user.lovePoints}`);
        break;
      }

      case 'taixiu': {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || user.xu < bet) {
          message.reply("Hãy nhập số xu hợp lệ để cược: `e taixiu số_xu`");
          break;
        }

        const result = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        const win = Math.random() < 0.5;

        if (win) {
          user.xu += bet;
        } else {
          user.xu -= bet;
        }
        await user.save();

        message.reply(`Kết quả: ${result}. ${win ? `Bạn đã thắng ${bet} xu!` : `Bạn đã thua ${bet} xu!`} Số xu hiện tại: ${user.xu}`);
        break;
      }

      case 'listreply': {
        const replies = await AutoReply.find();
        if (replies.length === 0) {
          message.reply("Chưa có trả lời tự động nào.");
          break;
        }

        const replyList = replies.map(r => `- "${r.keyword}" → "${r.reply}"`).join('\n');
        const chunks = replyList.match(/[\s\S]{1,1900}/g); // Chia nhỏ tin nhắn
        chunks.forEach(chunk => message.channel.send(chunk));
        break;
      }

      case 'addreply': {
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

      case 'removereply': {
        const keyword = args[0];
        if (!keyword) {
          message.reply("Hãy nhập từ khóa cần xóa: `e removereply từ_khóa`");
          break;
        }

        const deleted = await AutoReply.findOneAndDelete({ keyword });
        message.reply(deleted ? `Đã xóa trả lời tự động cho từ khóa "${keyword}".` : "Không tìm thấy từ khóa!");
        break;
      }

      case 'help': {
        const helpMessage = `
**Danh sách lệnh:**
- \`e daily\`: Nhận 50,000 xu mỗi ngày.
- \`e transfer @user số_xu\`: Chuyển xu cho người khác.
- \`e marry @user\`: Kết hôn với người được tag (phí 5,000,000 xu).
- \`e divorce\`: Ly hôn (phí 5,000,000 xu).
- \`e status\`: Xem trạng thái kết hôn và điểm yêu thương.
- \`e love số_xu\`: Dùng xu để tăng điểm yêu thương.
- \`e taixiu số_xu\`: Cược tài xỉu.
- \`e listreply\`: Xem danh sách các trả lời tự động.
- \`e addreply từ_khóa nội_dung_trả_lời\`: Thêm trả lời tự động.
- \`e removereply từ_khóa\`: Xóa trả lời tự động.
- \`e help\`: Hiển thị danh sách các lệnh.
        `;
        message.reply(helpMessage);
        break;
      }
