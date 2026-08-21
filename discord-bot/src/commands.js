import { SlashCommandBuilder } from "discord.js";

const DEFAULT_CODE = process.env.DEFAULT_SESSION_CODE || "REPS2.0";

export const COMMAND_NAME = "envoyer";

export const envoyerCommand = new SlashCommandBuilder()
  .setName(COMMAND_NAME)
  .setDescription("Envoyer une image, un GIF ou une vidéo sur une session Chekssa")
  .addAttachmentOption((opt) =>
    opt.setName("fichier").setDescription("Image, GIF ou vidéo à envoyer").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("lien").setDescription("Lien YouTube, TikTok ou X/Twitter").setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName("code").setDescription(`Code de session (défaut : ${DEFAULT_CODE})`).setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName("texte")
      .setDescription("Texte à afficher sur l'image (position fixe : bas, centré)")
      .setRequired(false)
  )
  .addIntegerOption((opt) =>
    opt
      .setName("debut")
      .setDescription("Timestamp de début en secondes (YouTube ou vidéo envoyée)")
      .setRequired(false)
      .setMinValue(0)
  );
