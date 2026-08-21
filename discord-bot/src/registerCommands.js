import "dotenv/config";
import { envoyerCommand } from "./commands.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("DISCORD_BOT_TOKEN et DISCORD_CLIENT_ID sont requis.");
  process.exitCode = 1;
} else {
  const url = guildId
    ? `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${clientId}/commands`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([envoyerCommand.toJSON()]),
    });

    if (res.ok) {
      console.log(
        guildId
          ? `Commande /${envoyerCommand.name} enregistrée sur le serveur ${guildId} (immédiat).`
          : `Commande /${envoyerCommand.name} enregistrée globalement (jusqu'à 1h pour apparaître partout).`
      );
    } else {
      const body = await res.json().catch(() => ({}));
      if (body.code === 50001) {
        console.error(
          "Accès refusé (50001) : le bot n'a probablement pas été invité sur ce serveur avec le scope " +
            "'applications.commands' (en plus de 'bot'), ou DISCORD_GUILD_ID ne correspond pas au bon serveur. " +
            "Régénère l'URL d'invitation dans OAuth2 > URL Generator avec les deux scopes cochés et ré-autorise."
        );
      } else {
        console.error(`Échec de l'enregistrement (${res.status}) :`, body.message || JSON.stringify(body));
      }
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("Échec de l'enregistrement de la commande :", err.message || err);
    process.exitCode = 1;
  }
}
