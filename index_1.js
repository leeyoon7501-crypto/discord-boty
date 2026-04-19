require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require("discord.js");

const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const BLACK_ROLE_NAME = "BLACKLISTED";

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= DB =================
let db = { active: {}, history: [] };

if (fs.existsSync("blacklist.json")) {
  try {
    db = JSON.parse(fs.readFileSync("blacklist.json"));
  } catch {}
}

function save() {
  fs.writeFileSync("blacklist.json", JSON.stringify(db, null, 2));
}

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("블랙리스트")
    .setDescription("유저 블랙리스트")
    .addUserOption(o =>
      o.setName("유저").setDescription("대상").setRequired(true))
    .addStringOption(o =>
      o.setName("사유").setDescription("블랙 사유").setRequired(true)),

  new SlashCommandBuilder()
    .setName("언블랙리스트")
    .setDescription("해제")
    .addUserOption(o =>
      o.setName("유저").setDescription("대상").setRequired(true))
    .addStringOption(o =>
      o.setName("사유").setDescription("해제 사유").setRequired(true)),

  new SlashCommandBuilder()
    .setName("블랙리스트목록")
    .setDescription("현재 목록"),

  new SlashCommandBuilder()
    .setName("블랙리스트기록")
    .setDescription("과거 기록")
];

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Commands registered");
});

// ================= INTERACTION =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: "❌ 관리자만 가능", ephemeral: true });
  }

  const guild = interaction.guild;
  const blackRole = guild.roles.cache.find(r => r.name === BLACK_ROLE_NAME);

  if (!blackRole) {
    return interaction.reply({ content: "❌ BLACKLISTED 역할 없음", ephemeral: true });
  }

  // 블랙리스트
  if (interaction.commandName === "블랙리스트") {

    const user = interaction.options.getUser("유저");
    const reason = interaction.options.getString("사유");
    const member = await guild.members.fetch(user.id);

    if (db.active[user.id]) {
      return interaction.reply({ content: "이미 블랙리스트", ephemeral: true });
    }

    const roles = member.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => r.id);

    db.active[user.id] = {
      roles,
      oldNick: member.nickname || user.username,
      name: user.username,
      reason,
      time: Date.now()
    };

    db.history.push({ type: "BLACKLIST", user: user.username, reason, time: Date.now() });
    save();

    await member.roles.set([blackRole]);
    try { await member.setNickname("[BLACKLISTED]"); } catch {}

    try {
      await user.send(`🚫 블랙리스트\n사유: ${reason}`);
    } catch {}

    return interaction.reply(`🚫 ${user.username} 블랙됨`);
  }

  // 언블랙리스트
  if (interaction.commandName === "언블랙리스트") {

    const user = interaction.options.getUser("유저");
    const reason = interaction.options.getString("사유");
    const member = await guild.members.fetch(user.id);

    const data = db.active[user.id];
    if (!data) {
      return interaction.reply({ content: "❌ 블랙 아님", ephemeral: true });
    }

    await member.roles.set(data.roles);
    try { await member.setNickname(data.oldNick); } catch {}

    db.history.push({ type: "UNBLACKLIST", user: user.username, reason, time: Date.now() });

    delete db.active[user.id];
    save();

    try {
      await user.send(`✅ 블랙 해제됨\n사유: ${reason}`);
    } catch {}

    return interaction.reply(`✅ ${user.username} 복구됨`);
  }

  if (interaction.commandName === "블랙리스트목록") {
    const list = Object.values(db.active).map(x => `• ${x.name} (${x.reason})`).join("\n") || "없음";
    return interaction.reply({ content: list, ephemeral: true });
  }

  if (interaction.commandName === "블랙리스트기록") {
    const list = db.history.slice(-10).map(x => `${x.type} - ${x.user} (${x.reason})`).join("\n") || "없음";
    return interaction.reply({ content: list, ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(TOKEN);