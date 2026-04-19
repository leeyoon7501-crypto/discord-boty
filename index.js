require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");
const axios = require("axios");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const BLACK_ROLE_NAME = "BLACKLISTED";

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= DB =================
// ranking
let ranking = [];
if (fs.existsSync("ranking.json")) {
  try {
    ranking = JSON.parse(fs.readFileSync("ranking.json"));
  } catch {
    ranking = [];
  }
}
while (ranking.length < 10) ranking.push(null);

function saveRanking() {
  fs.writeFileSync("ranking.json", JSON.stringify(ranking, null, 2));
}

// blacklist
let db = { active: {}, history: [] };

if (fs.existsSync("blacklist.json")) {
  try {
    db = JSON.parse(fs.readFileSync("blacklist.json"));
  } catch {}
}

function saveBlacklist() {
  fs.writeFileSync("blacklist.json", JSON.stringify(db, null, 2));
}

// ================= ROBLOX API =================
async function getRobloxData(username) {
  try {
    const userRes = await axios.post(
      "https://users.roblox.com/v1/usernames/users",
      { usernames: [username], excludeBannedUsers: true }
    );

    const id = userRes.data.data[0]?.id;
    if (!id) return null;

    const avatarRes = await axios.get(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=150x150&format=Png`
    );

    return avatarRes.data.data[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

// ================= COMMANDS =================
const commands = [

  // ===== RANKING =====
  new SlashCommandBuilder()
    .setName("랭킹")
    .setDescription("랭킹 UI"),

  new SlashCommandBuilder()
    .setName("랭킹등록")
    .setDescription("플레이어 등록")
    .addIntegerOption(o =>
      o.setName("순위").setDescription("1~10").setRequired(true))
    .addUserOption(o =>
      o.setName("유저").setDescription("디스코드 유저").setRequired(true))
    .addStringOption(o =>
      o.setName("로블록스").setDescription("닉네임").setRequired(true))
    .addStringOption(o =>
      o.setName("스테이지").setDescription("스테이지").setRequired(true))
    .addStringOption(o =>
      o.setName("별명").setDescription("표시 이름").setRequired(true)),

  new SlashCommandBuilder()
    .setName("랭킹삭제")
    .setDescription("삭제")
    .addIntegerOption(o =>
      o.setName("순위").setDescription("1~10").setRequired(true)),

  new SlashCommandBuilder()
    .setName("랭킹정리")
    .setDescription("빈칸 정리"),

  // ===== BLACKLIST =====
  new SlashCommandBuilder()
    .setName("블랙리스트")
    .setDescription("유저 블랙리스트")
    .addUserOption(o =>
      o.setName("유저").setDescription("대상").setRequired(true))
    .addStringOption(o =>
      o.setName("사유").setDescription("사유").setRequired(true)),

  new SlashCommandBuilder()
    .setName("언블랙리스트")
    .setDescription("해제")
    .addUserOption(o =>
      o.setName("유저").setDescription("대상").setRequired(true))
    .addStringOption(o =>
      o.setName("사유").setDescription("사유").setRequired(true)),

  new SlashCommandBuilder()
    .setName("블랙리스트목록")
    .setDescription("현재 블랙리스트"),

  new SlashCommandBuilder()
    .setName("블랙리스트기록")
    .setDescription("기록 보기")
];

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Commands registered");
});

// ================= RANKING UI =================
function createRankingUI(page = 0) {
  const start = page * 5;
  const end = start + 5;

  const row = new ActionRowBuilder();

  for (let i = start; i < end; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`rank_${i}`)
        .setLabel(ranking[i] ? `${i + 1}. ${ranking[i].name}` : `${i + 1}. EMPTY`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`prev_${page}`)
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId(`next_${page}`)
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1)
  );

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 RANKING")
        .setDescription(`페이지 ${page + 1}/2`)
        .setColor(0x00ffcc)
    ],
    components: [row, nav]
  };
}

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {

  // ================= SLASH =================
  if (interaction.isChatInputCommand()) {

    const name = interaction.commandName;

    // ===== RANKING =====
    if (name === "랭킹") {
      return interaction.reply(createRankingUI(0));
    }

    if (name === "랭킹등록") {

      const rank = interaction.options.getInteger("순위") - 1;
      const user = interaction.options.getUser("유저");
      const roblox = interaction.options.getString("로블록스");
      const stage = interaction.options.getString("스테이지");
      const nick = interaction.options.getString("별명");

      const avatar = await getRobloxData(roblox);

      ranking[rank] = {
        name: nick,
        discord: user.username,
        roblox,
        stage,
        avatar
      };

      saveRanking();

      return interaction.reply({ content: "✅ 등록 완료", ephemeral: true });
    }

    if (name === "랭킹삭제") {
      const rank = interaction.options.getInteger("순위") - 1;
      ranking[rank] = null;
      saveRanking();
      return interaction.reply({ content: "삭제 완료", ephemeral: true });
    }

    if (name === "랭킹정리") {
      ranking = ranking.filter(x => x !== null);
      while (ranking.length < 10) ranking.push(null);
      saveRanking();
      return interaction.reply({ content: "정리 완료", ephemeral: true });
    }

    // ===== BLACKLIST (관리자만) =====
    const member = interaction.member;

    if (
      name.startsWith("블랙") &&
      !member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return interaction.reply({ content: "❌ 관리자만 가능", ephemeral: true });
    }

    const guild = interaction.guild;
    const blackRole = guild.roles.cache.find(r => r.name === BLACK_ROLE_NAME);

    if (!blackRole && name.startsWith("블랙")) {
      return interaction.reply({ content: "❌ 역할 없음", ephemeral: true });
    }

    if (name === "블랙리스트") {

      const user = interaction.options.getUser("유저");
      const reason = interaction.options.getString("사유");
      const mem = await guild.members.fetch(user.id);

      if (db.active[user.id]) {
        return interaction.reply({ content: "이미 블랙", ephemeral: true });
      }

      db.active[user.id] = {
        roles: mem.roles.cache.map(r => r.id).filter(id => id !== guild.id),
        oldNick: mem.nickname || user.username,
        name: user.username,
        reason,
        time: Date.now()
      };

      db.history.push({ type: "BLACK", user: user.username, reason, time: Date.now() });

      saveBlacklist();

      await mem.roles.set([blackRole]);
      try { await mem.setNickname("[BLACKLISTED]"); } catch {}

      return interaction.reply(`🚫 ${user.username} 블랙됨`);
    }

    if (name === "언블랙리스트") {

      const user = interaction.options.getUser("유저");
      const reason = interaction.options.getString("사유");
      const mem = await guild.members.fetch(user.id);

      const data = db.active[user.id];
      if (!data) {
        return interaction.reply({ content: "❌ 없음", ephemeral: true });
      }

      await mem.roles.set(data.roles);
      try { await mem.setNickname(data.oldNick); } catch {}

      db.history.push({ type: "UNBLACK", user: user.username, reason, time: Date.now() });

      delete db.active[user.id];
      saveBlacklist();

      return interaction.reply(`✅ 복구 완료`);
    }

    if (name === "블랙리스트목록") {
      const list =
        Object.values(db.active)
          .map(x => `• ${x.name} (${x.reason})`)
          .join("\n") || "없음";

      return interaction.reply({ content: list, ephemeral: true });
    }

    if (name === "블랙리스트기록") {
      const list =
        db.history.slice(-10)
          .map(x => `${x.type} - ${x.user}`)
          .join("\n") || "없음";

      return interaction.reply({ content: list, ephemeral: true });
    }
  }

  // ================= BUTTONS =================
  if (interaction.isButton()) {

    const id = interaction.customId;

    if (id.startsWith("prev_") || id.startsWith("next_")) {
      const page = parseInt(id.split("_")[1]);
      const newPage = id.startsWith("prev_") ? page - 1 : page + 1;
      return interaction.update(createRankingUI(newPage));
    }

    if (id.startsWith("rank_")) {
      const idx = parseInt(id.split("_")[1]);
      const data = ranking[idx];

      if (!data)
        return interaction.reply({ content: "EMPTY", ephemeral: true });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(data.name)
            .setThumbnail(data.avatar)
            .setDescription(
`디스코드: ${data.discord}
로블록스: ${data.roblox}
스테이지: ${data.stage}`
            )
        ],
        ephemeral: true
      });
    }
  }
});

// ================= LOGIN =================
client.login(TOKEN);
