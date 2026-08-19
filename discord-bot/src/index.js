import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { socketClient } from "./socketClient.js";
import { buildImageMedia, buildLocalVideoMedia, CLIP_SECONDS } from "./media.js";
import { parseVideoUrl } from "./videoLinks.js";
import { resolveTwitterVideo } from "./twitterVideo.js";
import { COMMAND_NAME } from "./commands.js";

const DEFAULT_CODE = process.env.DEFAULT_SESSION_CODE || "REPS2.0";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN manquant.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Connecté à Discord en tant que ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== COMMAND_NAME) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const media = await resolveMedia(interaction);
    const code = interaction.options.getString("code") || DEFAULT_CODE;
    await socketClient.broadcast(code, media, []);
    await interaction.editReply(`Envoyé sur **${code}** ✅`);
  } catch (err) {
    console.error("[/envoyer]", err);
    await interaction.editReply(`❌ ${err.message || "Échec de l'envoi."}`);
  }
});

async function resolveMedia(interaction) {
  const attachment = interaction.options.getAttachment("fichier");
  const link = interaction.options.getString("lien");
  const debut = interaction.options.getInteger("debut");

  if (!attachment && !link) {
    throw new Error("Fournis un fichier ou un lien.");
  }
  if (attachment && link) {
    throw new Error("Un seul à la fois : fichier OU lien, pas les deux.");
  }

  if (attachment) {
    const contentType = attachment.contentType || "";
    if (contentType.startsWith("video/")) {
      return buildLocalVideoMedia(attachment.url, debut ?? 0);
    }
    if (contentType.startsWith("image/")) {
      return buildImageMedia(attachment.url, contentType);
    }
    throw new Error("Type de fichier non supporté (image, GIF ou vidéo uniquement).");
  }

  const parsed = parseVideoUrl(link);
  if (!parsed) {
    throw new Error("Lien non reconnu (YouTube, TikTok ou X/Twitter).");
  }

  if (parsed.platform === "youtube") {
    const start = debut ?? parsed.startFromUrl ?? 0;
    return { kind: "youtube", videoId: parsed.videoId, start, end: start + CLIP_SECONDS, aspectRatio: parsed.aspectRatio };
  }
  if (parsed.platform === "tiktok") {
    return { kind: "tiktok", videoId: parsed.videoId, aspectRatio: parsed.aspectRatio };
  }
  // twitter
  return { kind: "twitter", ...(await resolveTwitterVideo(parsed.tweetId)) };
}

await socketClient.connect();
await client.login(token);
