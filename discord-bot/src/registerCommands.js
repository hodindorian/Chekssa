// One-off script: registers /envoyer with Discord. Run again any time the
// command's definition changes (options added/renamed/etc).
//
//   DISCORD_BOT_TOKEN=... DISCORD_CLIENT_ID=... DISCORD_GUILD_ID=... npm run register-commands
//
// DISCORD_GUILD_ID is optional but recommended: guild-scoped commands show
// up instantly, global ones can take up to an hour to propagate.

import "dotenv/config";
import { REST, Routes } from "discord.js";
import { envoyerCommand } from "./commands.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("DISCORD_BOT_TOKEN et DISCORD_CLIENT_ID sont requis.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);
const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);

try {
  await rest.put(route, { body: [envoyerCommand.toJSON()] });
  console.log(
    guildId
      ? `Commande /${envoyerCommand.name} enregistrée sur le serveur ${guildId} (immédiat).`
      : `Commande /${envoyerCommand.name} enregistrée globalement (jusqu'à 1h pour apparaître partout).`
  );
  process.exit(0);
} catch (err) {
  if (err.code === 50001) {
    console.error(
      "Accès refusé (50001) : le bot n'a probablement pas été invité sur ce serveur avec le scope " +
        "'applications.commands' (en plus de 'bot'), ou DISCORD_GUILD_ID ne correspond pas au bon serveur. " +
        "Régénère l'URL d'invitation dans OAuth2 > URL Generator avec les deux scopes cochés et ré-autorise."
    );
  } else {
    console.error("Échec de l'enregistrement de la commande :", err.message || err);
  }
  process.exit(1);
}
