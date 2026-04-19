require("dotenv").config();
console.log("🚀 Blacklist system starting...");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const axios = require("axios");
const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1494706154280845526";
const GUILD_ID = "1352912222765977640";

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= DATA =================
let ranking = [];

if (fs.existsSync("ranking.json")) {
  try {
    ranking = JSON.parse(fs.readFileSync("ranking.json"));
  } catch {
    ranking = [];
  }
}

while (ranking.length < 10) ranking.push(null);

function save() {
  fs.writeFileSync("ranking.json", JSON.stringify(ranking, null, 2));
}

// ================= ROBLOX =================
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
  new SlashCommandBuilder()
    .setName("랭킹")
    .setDescription("랭킹 UI 보기"),

  new SlashCommandBuilder()
    .setName("랭킹등록")
    .setDescription("플레이어 등록")
    .addIntegerOption(o =>
      o.setName("순위").setDescription("1~10").setRequired(true))
    .addUserOption(o =>
      o.setName("유저").setDescription("디코 유저").setRequired(true))
    .addStringOption(o =>
      o.setName("로블록스").setDescription("로블록스 닉네임").setRequired(true))
    .addStringOption(o =>
      o.setName("스테이지").setDescription("스테이지").setRequired(true))
    .addStringOption(o =>
      o.setName("별명").setDescription("표시 이름").setRequired(true)),

  new SlashCommandBuilder()
    .setName("랭킹삭제")
    .setDescription("랭킹 삭제")
    .addIntegerOption(o =>
      o.setName("순위").setDescription("삭제할 순위").setRequired(true)),

  new SlashCommandBuilder()
    .setName("랭킹정리")
    .setDescription("빈칸 정리")
];

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    console.log("🧹 Reset commands...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: [] }
    );

    console.log("📦 Registering...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands.map(c => c.toJSON()) }
    );

    console.log("✅ Done");
  } catch (e) {
    console.error(e);
  }
});

// ================= UI 함수 =================
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
        .setTitle("🏆 GN LEADERBOARD")
        .setDescription(`페이지 ${page + 1} / 2`)
        .setColor(0x00ffcc)
    ],
    components: [row, nav]
  };
}

// ================= INTERACTION =================
client.on("interactionCreate", async (interaction) => {
  try {

    // ================= SLASH =================
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "랭킹") {
        return interaction.reply(createRankingUI(0));
      }

      if (interaction.commandName === "랭킹등록") {

        await interaction.deferReply({ ephemeral: true });

        const rank = interaction.options.getInteger("순위") - 1;
        const user = interaction.options.getUser("유저");
        const roblox = interaction.options.getString("로블록스");
        const stage = interaction.options.getString("스테이지");
        const name = interaction.options.getString("별명");

        const avatar = await getRobloxData(roblox);

        ranking[rank] = {
          name,
          discord: user.username,
          roblox,
          stage,
          avatar
        };

        save();

        return interaction.editReply("✅ 등록 완료");
      }

      if (interaction.commandName === "랭킹삭제") {
        const rank = interaction.options.getInteger("순위") - 1;
        ranking[rank] = null;
        save();
        return interaction.reply({ content: "삭제 완료", ephemeral: true });
      }

      if (interaction.commandName === "랭킹정리") {
        ranking = ranking.filter(x => x !== null);
        while (ranking.length < 10) ranking.push(null);
        save();
        return interaction.reply({ content: "정리 완료", ephemeral: true });
      }
    }

    // ================= 버튼 =================
    if (interaction.isButton()) {

      const id = interaction.customId;

      // 페이지 이동
      if (id.startsWith("prev_") || id.startsWith("next_")) {
        const page = parseInt(id.split("_")[1]);
        const newPage = id.startsWith("prev_") ? page - 1 : page + 1;

        return interaction.update(createRankingUI(newPage));
      }

      // 카드
      if (id.startsWith("rank_")) {
        const idx = parseInt(id.split("_")[1]);
        const data = ranking[idx];

        if (!data)
          return interaction.reply({ content: "EMPTY", ephemeral: true });

        return interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle(`👤 ${data.name}`)
              .setColor(0x00ffcc)
              .setThumbnail(data.avatar)
              .setDescription(
`──────────────
💬 디스코드: ${data.discord}
🎮 로블록스: ${data.roblox}
📊 스테이지: ${data.stage}`
              )
          ]
        });
      }
    }

  } catch (err) {
    console.error("🔥 ERROR:", err);
  }
});

// ================= LOGIN =================
client.login(TOKEN)
  .then(() => console.log("LOGIN OK"))
  .catch(err => console.log("LOGIN FAIL", err));